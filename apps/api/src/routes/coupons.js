// ── Coupon Routes ──
// GET /coupons, POST /coupons, PUT /coupons/:id, DELETE /coupons/:id, POST /coupons/validate

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';
import { requireBusinessScope } from '../middleware/businessScope.js';

const router = Router();

// ── Schemas ──
const createCouponSchema = z.object({
  code: z.string().min(3).max(20).transform(s => s.toUpperCase()),
  discountType: z.enum(['percentage', 'fixed', 'free_delivery']),
  value: z.number().positive(),
  expiresAt: z.string().datetime().optional(),
  usageLimit: z.number().int().positive().optional(),
});

const updateCouponSchema = z.object({
  code: z.string().min(3).max(20).transform(s => s.toUpperCase()).optional(),
  discountType: z.enum(['percentage', 'fixed', 'free_delivery']).optional(),
  value: z.number().positive().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
});

const validateCouponSchema = z.object({
  code: z.string().min(1),
  businessId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID'),
  subtotal: z.number().positive().optional(),
});

// ── GET /coupons — list all for business ──
router.get('/',
  authenticate,
  authorize('owner', 'manager'),
  requireBusinessScope,
  async (req, res) => {
    try {
      const coupons = await req.prisma.coupon.findMany({
        where: { businessId: req.businessId },
        orderBy: { expiresAt: 'desc' },
      });

      // Compute usage count and unique user redemptions from orders
      const couponsWithUsage = await Promise.all(
        coupons.map(async (coupon) => {
          const usedOrders = await req.prisma.order.findMany({
            where: { businessId: req.businessId, couponCode: coupon.code, status: { not: 'cancelled' } },
            select: { customerId: true, total: true, discount: true, createdAt: true },
          });
          const usedCount = usedOrders.length;
          const uniqueCustomerIds = new Set(usedOrders.map(o => o.customerId));
          const uniqueUsersCount = uniqueCustomerIds.size;
          const totalDiscountGiven = usedOrders.reduce((sum, o) => sum + (o.discount || 0), 0);

          return { 
            ...coupon, 
            usedCount, 
            uniqueUsersCount,
            totalDiscountGiven: Math.round(totalDiscountGiven * 100) / 100,
          };
        })
      );

      res.json(couponsWithUsage);
    } catch (err) {
      console.error('Coupons list error:', err);
      res.status(500).json({ error: 'Failed to fetch coupons' });
    }
  }
);

// ── POST /coupons — create coupon ──
router.post('/',
  authenticate,
  authorize('owner', 'manager'),
  requireBusinessScope,
  validate(createCouponSchema),
  async (req, res) => {
    try {
      // Check for duplicate code
      const existing = await req.prisma.coupon.findFirst({
        where: { businessId: req.businessId, code: req.body.code },
      });
      if (existing) {
        return res.status(409).json({ error: 'A coupon with this code already exists' });
      }

      const coupon = await req.prisma.coupon.create({
        data: {
          businessId: req.businessId,
          code: req.body.code,
          discountType: req.body.discountType,
          value: req.body.value,
          expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
          usageLimit: req.body.usageLimit || null,
        },
      });

      res.status(201).json(coupon);
    } catch (err) {
      console.error('Coupon create error:', err);
      res.status(500).json({ error: 'Failed to create coupon' });
    }
  }
);

// ── PUT /coupons/:id — update coupon ──
router.put('/:id',
  authenticate,
  authorize('owner', 'manager'),
  requireBusinessScope,
  validate(updateCouponSchema),
  async (req, res) => {
    try {
      const coupon = await req.prisma.coupon.findFirst({
        where: { id: req.params.id, businessId: req.businessId },
      });
      if (!coupon) return res.status(404).json({ error: 'Coupon not found' });

      const data = {};
      if (req.body.code) data.code = req.body.code;
      if (req.body.discountType) data.discountType = req.body.discountType;
      if (req.body.value !== undefined) data.value = req.body.value;
      if (req.body.expiresAt !== undefined) data.expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
      if (req.body.usageLimit !== undefined) data.usageLimit = req.body.usageLimit;

      const updated = await req.prisma.coupon.update({
        where: { id: req.params.id },
        data,
      });

      res.json(updated);
    } catch (err) {
      console.error('Coupon update error:', err);
      res.status(500).json({ error: 'Failed to update coupon' });
    }
  }
);

// ── DELETE /coupons/:id — delete coupon ──
router.delete('/:id',
  authenticate,
  authorize('owner', 'manager'),
  requireBusinessScope,
  async (req, res) => {
    try {
      const coupon = await req.prisma.coupon.findFirst({
        where: { id: req.params.id, businessId: req.businessId },
      });
      if (!coupon) return res.status(404).json({ error: 'Coupon not found' });

      await req.prisma.coupon.delete({ where: { id: req.params.id } });
      res.json({ message: 'Coupon deleted' });
    } catch (err) {
      console.error('Coupon delete error:', err);
      res.status(500).json({ error: 'Failed to delete coupon' });
    }
  }
);

// ── GET /coupons/active — public endpoint for homepage promotional offer banner ──
router.get('/active', async (req, res) => {
  try {
    const { businessId } = req.query;
    const where = {
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    };
    if (businessId) where.businessId = businessId;

    const coupons = await req.prisma.coupon.findMany({
      where,
      orderBy: { value: 'desc' },
      take: 1,
    });

    if (!coupons || coupons.length === 0) {
      // Sensible default fallback
      return res.json({
        active: true,
        code: 'TASTE10',
        title: 'Order 4+ Items,',
        discountType: 'percentage',
        value: 10,
        highlightText: 'Get 10% Off!',
        minItems: 4,
        subtitle: 'Automatic combo discount applied at checkout',
      });
    }

    const c = coupons[0];
    const highlightText = c.discountType === 'percentage' 
      ? `Get ${c.value}% Off!`
      : `Get ₹${c.value} Off!`;

    res.json({
      active: true,
      id: c.id,
      code: c.code,
      title: 'Order 4+ Items,',
      discountType: c.discountType,
      value: c.value,
      highlightText,
      minItems: 4,
      subtitle: `Use code ${c.code} or order 4+ items for instant discount`,
      expiresAt: c.expiresAt,
    });
  } catch (err) {
    console.error('Active coupon fetch error:', err);
    res.json({
      active: true,
      code: 'TASTE10',
      title: 'Order 4+ Items,',
      discountType: 'percentage',
      value: 10,
      highlightText: 'Get 10% Off!',
      minItems: 4,
      subtitle: 'Automatic combo discount applied at checkout',
    });
  }
});

// ── POST /coupons/validate — validate a coupon code (public/optionalAuth for customer checkout) ──
router.post('/validate', optionalAuth, validate(validateCouponSchema), async (req, res) => {
  try {
    const { code, businessId, subtotal } = req.body;

    const coupon = await req.prisma.coupon.findFirst({
      where: {
        businessId,
        code: code.toUpperCase(),
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      },
    });

    if (!coupon) {
      return res.status(404).json({ valid: false, error: 'Invalid or expired coupon code' });
    }

    // Check single-use per customer if user is authenticated
    if (req.user) {
      const customer = await req.prisma.customer.findFirst({
        where: { userId: req.user.id, businessId }
      });
      if (customer) {
        const alreadyUsed = await req.prisma.order.findFirst({
          where: { customerId: customer.id, couponCode: coupon.code, status: { not: 'cancelled' } }
        });
        if (alreadyUsed) {
          return res.status(400).json({ valid: false, error: 'You have already used this coupon code' });
        }
      }
    }

    // Check usage limit
    if (coupon.usageLimit) {
      const usedCount = await req.prisma.order.count({
        where: { businessId, couponCode: coupon.code, status: { not: 'cancelled' } },
      });
      if (usedCount >= coupon.usageLimit) {
        return res.status(400).json({ valid: false, error: 'Coupon usage limit reached' });
      }
    }

    // Calculate discount
    let discount = 0;
    if (subtotal) {
      if (coupon.discountType === 'percentage') discount = (subtotal * coupon.value) / 100;
      else if (coupon.discountType === 'fixed') discount = coupon.value;
      // free_delivery discount is applied at order level
    }

    res.json({
      valid: true,
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        value: coupon.value,
      },
      estimatedDiscount: Math.round(discount * 100) / 100,
    });
  } catch (err) {
    console.error('Coupon validate error:', err);
    res.status(500).json({ error: 'Failed to validate coupon' });
  }
});

export default router;
