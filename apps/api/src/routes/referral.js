// ── Referral Routes ──
// GET /referral/code — get or generate my referral code
// POST /referral/apply — apply a referral code

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import crypto from 'crypto';

const router = Router();

// ── Schema ──
const applyReferralSchema = z.object({
  code: z.string().min(4).max(12),
  businessId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID'),
});

/**
 * Generate a unique referral code: first 3 letters of name + 4 random chars
 */
function generateReferralCode(name) {
  const prefix = (name || 'USR').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}${suffix}`;
}

// ── GET /referral/code — get my referral code (auto-generate if missing) ──
router.get('/code', authenticate, async (req, res) => {
  try {
    const customer = await req.prisma.customer.findFirst({
      where: { userId: req.user.id },
      include: { user: { select: { name: true } } },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer profile not found. Place an order first.' });
    }

    // Generate code if missing
    if (!customer.referralCode) {
      let code;
      let attempts = 0;
      do {
        code = generateReferralCode(customer.user.name);
        const existing = await req.prisma.customer.findUnique({ where: { referralCode: code } });
        if (!existing) break;
        attempts++;
      } while (attempts < 5);

      await req.prisma.customer.update({
        where: { id: customer.id },
        data: { referralCode: code },
      });

      return res.json({ referralCode: code });
    }

    res.json({ referralCode: customer.referralCode });
  } catch (err) {
    console.error('Referral code error:', err);
    res.status(500).json({ error: 'Failed to get referral code' });
  }
});

// ── POST /referral/apply — apply someone's referral code ──
router.post('/apply', authenticate, validate(applyReferralSchema), async (req, res) => {
  try {
    const { code, businessId } = req.body;

    // Find the referrer by code
    const referrer = await req.prisma.customer.findUnique({
      where: { referralCode: code.toUpperCase() },
    });

    if (!referrer) {
      return res.status(404).json({ error: 'Invalid referral code' });
    }

    // Find or create the referee customer
    let referee = await req.prisma.customer.findFirst({
      where: { userId: req.user.id, businessId },
    });

    if (!referee) {
      const referralCode = 'REF' + Math.random().toString(36).substring(2, 8).toUpperCase();
      referee = await req.prisma.customer.create({
        data: { userId: req.user.id, businessId, referralCode },
      });
    }

    // Can't refer yourself
    if (referee.id === referrer.id) {
      return res.status(400).json({ error: 'You cannot use your own referral code' });
    }

    // Check if already referred
    const existingReferral = await req.prisma.referral.findFirst({
      where: { refereeId: referee.id },
    });

    if (existingReferral) {
      return res.status(409).json({ error: 'You have already applied a referral code' });
    }

    // Create referral record (reward will be issued on first delivered order)
    const referral = await req.prisma.referral.create({
      data: {
        referrerId: referrer.id,
        refereeId: referee.id,
        rewardIssued: false,
      },
    });

    res.status(201).json({
      message: 'Referral code applied! Both you and your friend will earn bonus points after your first delivered order.',
      referral,
    });
  } catch (err) {
    console.error('Apply referral error:', err);
    res.status(500).json({ error: 'Failed to apply referral code' });
  }
});

export default router;
