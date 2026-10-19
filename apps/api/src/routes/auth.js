// ── Auth Routes ──
// POST /auth/register, /auth/login, /auth/refresh, /auth/logout, /auth/otp/send, /auth/otp/verify

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';
import { verifyPassword, hashPassword, sanitizeUserData } from '../lib/security.js';
import { sendWhatsAppMessage } from '../lib/baileys.js';
import { otpStore } from '../lib/otpStore.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 10 : 100, // Generous in development to prevent lockouts
  message: { error: 'Too many authentication attempts from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Phone Normalizer Helper ──
export function normalizePhone(rawPhone) {
  if (!rawPhone) return '';
  let cleaned = String(rawPhone).trim().replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('+91')) return cleaned;
  if (cleaned.startsWith('+')) return cleaned;
  if (/^\d{10}$/.test(cleaned)) return `+91${cleaned}`;
  if (/^0\d{10}$/.test(cleaned)) return `+91${cleaned.slice(1)}`;
  if (/^91\d{10}$/.test(cleaned)) return `+${cleaned}`;
  if (/^\d+$/.test(cleaned)) return `+91${cleaned}`;
  return cleaned;
}

// ── User Lookup Helper (Flexible Phone Search) ──
async function findUserByPhone(prisma, rawPhone) {
  if (!rawPhone) return null;
  const norm = normalizePhone(rawPhone);
  const plainDigits = norm.replace(/\D/g, '');
  const tenDigits = plainDigits.slice(-10);

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { phone: norm },
        { phone: String(rawPhone).trim() },
        { phone: tenDigits },
        { phone: `+91${tenDigits}` },
        { phone: `0${tenDigits}` }
      ]
    }
  });

  return users[0] || null;
}

// ── Schemas ──
const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(8, 'Phone number must be at least 8 digits'),
  email: z.string().email().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['customer', 'delivery_partner']).default('customer'),
  businessId: z.string().optional(),
});

const registerOwnerSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  phone: z.string().min(8, 'Phone number must be at least 8 digits'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  businessName: z.string().min(2, 'Business name is required'),
  industryType: z.string().min(2, 'Industry type is required'),
  address: z.string().min(5, 'Address is required'),
});

const loginSchema = z.object({
  phone: z.string().min(8, 'Phone number is required'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// ── Helpers ──
function generateTokens(user) {
  const accessToken = jwt.sign(
    { id: user.id, role: user.role, businessId: user.businessId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );
  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '365d' }
  );
  return { accessToken, refreshToken };
}

// ── POST /auth/register ──
router.post('/register', validate(registerSchema), async (req, res) => {
  try {
    const { name, phone: rawPhone, email, password, role, businessId } = req.body;
    const phone = normalizePhone(rawPhone);

    const existing = await findUserByPhone(req.prisma, rawPhone);
    const passwordHash = await hashPassword(password);

    let user;
    if (existing) {
      if (existing.role === 'owner' || existing.role === 'admin') {
        return res.status(403).json({ error: 'Administrative accounts cannot be registered via public signup' });
      }
      if (existing.passwordHash) {
        return res.status(409).json({ error: 'An account with this phone number already exists. Please log in.' });
      }
      // If user exists without a password (e.g. guest record), complete their profile
      user = await req.prisma.user.update({
        where: { id: existing.id },
        data: {
          name: name || existing.name,
          phone,
          passwordHash,
          role: 'customer',
          businessId: businessId || existing.businessId,
        },
      });
    } else {
      user = await req.prisma.user.create({
        data: { name, phone, email, passwordHash, role: 'customer', businessId: businessId || null },
      });
    }

    // If customer and businessId provided, create Customer record if missing
    if (user.role === 'customer' && businessId) {
      const custExists = await req.prisma.customer.findFirst({
        where: { userId: user.id, businessId }
      });
      if (!custExists) {
        const referralCode = 'REF' + Math.random().toString(36).substring(2, 8).toUpperCase();
        await req.prisma.customer.create({
          data: { userId: user.id, businessId, referralCode },
        });
      }
    }

    const tokens = generateTokens(user);

    res.status(201).json({
      message: 'Registration successful',
      user: { id: user.id, name: user.name, phone: user.phone, role: user.role, businessId: user.businessId },
      ...tokens,
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── GET /auth/businesses (Public list for delivery partner signup) ──
router.get('/businesses', async (req, res) => {
  try {
    const businesses = await req.prisma.business.findMany({
      select: {
        id: true,
        name: true,
        address: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(businesses);
  } catch (err) {
    console.error('Fetch businesses error:', err);
    res.status(500).json({ error: 'Failed to fetch businesses' });
  }
});

// ── POST /auth/register-owner (Permanently Disabled: Fixed Owner Account) ──
router.post('/register-owner', async (req, res) => {
  return res.status(403).json({
    error: 'Owner self-registration is permanently disabled. Please use authorized owner credentials.'
  });
});

// ── POST /auth/login ──
router.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  try {
    const { phone: rawPhone, password } = req.body;

    const user = await findUserByPhone(req.prisma, rawPhone);
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid phone or password' });
    }

    const validPassword = await verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid phone or password' });
    }

    const tokens = generateTokens(user);

    let customer = null;
    if (user.role === 'customer') {
      customer = await req.prisma.customer.findFirst({ where: { userId: user.id } });
    }

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        businessId: user.businessId,
        customerId: customer?.id || null,
      },
      ...tokens,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── POST /auth/refresh ──
router.post('/refresh', validate(refreshSchema), async (req, res) => {
  try {
    const { refreshToken } = req.body;

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await req.prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const tokens = generateTokens(user);
    res.json({ message: 'Token refreshed', ...tokens });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Refresh token expired — please log in again' });
    }
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// ── POST /auth/logout ──
router.post('/logout', authenticate, (_req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// ── GET /auth/me — Validate session & return fresh user profile ──
router.get('/me', authenticate, async (req, res) => {
  try {
    let user = await req.prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        businessId: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'User session not found or expired. Please log in again.' });
    }

    // Verify user.businessId is a valid existing business
    let biz = null;
    if (user.businessId && /^[0-9a-fA-F]{24}$/.test(user.businessId)) {
      biz = await req.prisma.business.findUnique({ where: { id: user.businessId } });
    }
    if (!biz && ['owner', 'manager', 'cashier'].includes(user.role)) {
      biz = await req.prisma.business.findFirst();
      if (biz) {
        user.businessId = biz.id;
        await req.prisma.user.update({
          where: { id: user.id },
          data: { businessId: biz.id },
        }).catch(() => {});
      }
    }

    const tokens = generateTokens(user);

    res.json({ user, ...tokens });
  } catch (err) {
    console.error('Session verify error:', err);
    res.status(500).json({ error: 'Failed to verify session' });
  }
});

// ── POST /auth/forgot-password/request-otp ──
// Customer requests WhatsApp OTP to reset their password.
// Performs an ultra-fast O(1) indexed query on User table. Strictly rejects non-registered numbers.
router.post('/forgot-password/request-otp', authLimiter, async (req, res) => {
  try {
    const rawPhone = req.body.phone;
    const cleanDigits = String(rawPhone || '').replace(/\D/g, '').slice(-10);

    if (cleanDigits.length !== 10) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number' });
    }

    // Ultra-fast indexed query with minimal projection (0ms delay)
    let user = await req.prisma.user.findFirst({
      where: {
        OR: [
          { phone: `+91${cleanDigits}` },
          { phone: cleanDigits },
          { phone: `0${cleanDigits}` },
          { phone: `+${cleanDigits}` },
          { phone: `91${cleanDigits}` },
        ],
      },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
      },
    });

    // Fallback if phone was saved with formatting (e.g. +91 9009149694)
    if (!user) {
      user = await req.prisma.user.findFirst({
        where: {
          phone: { endsWith: cleanDigits },
        },
        select: {
          id: true,
          name: true,
          phone: true,
          role: true,
        },
      });
    }

    if (!user) {
      return res.status(404).json({
        error: 'This mobile number is not registered with Tea Bhatti. Password reset is only available for existing registered accounts. Please create a new account or check your number.',
      });
    }

    // Generate secure OTP & enforce 45s resend cooldown
    const { otp, resetToken, cooldownSeconds } = otpStore.createOtp(cleanDigits, user);
    if (cooldownSeconds) {
      return res.status(429).json({
        error: `Please wait ${cooldownSeconds} seconds before requesting a new OTP.`,
        cooldownSeconds,
      });
    }

    // Deliver OTP directly to customer via WhatsApp
    const waMessage = 
      `🔐 *Tea Bhatti Cafe — Password Reset OTP*\n\n` +
      `Hello *${user.name || 'Valued Customer'}*,\n\n` +
      `Your One-Time Password (OTP) to reset your account password is:\n\n` +
      `👉 *${otp}*\n\n` +
      `⏳ This code is valid for *10 minutes*.\n` +
      `Please enter this code on the website to set your new password.\n\n` +
      `_Never share your OTP with anyone._`;

    let waSent = false;
    try {
      await sendWhatsAppMessage(cleanDigits, waMessage);
      waSent = true;
    } catch (waErr) {
      console.warn(`[OTP WhatsApp Delivery Warning] Could not send via Baileys to +91${cleanDigits}:`, waErr.message);
      console.log(`🔑 [OTP FALLBACK LOG] Active OTP for +91${cleanDigits} is: ${otp}`);
    }

    res.json({
      success: true,
      message: waSent 
        ? 'OTP sent successfully to your WhatsApp number' 
        : 'OTP generated. Please check your WhatsApp.',
      phone: `+91 ******${cleanDigits.slice(-4)}`,
      name: user.name,
      ...(process.env.NODE_ENV !== 'production' ? { devOtp: otp } : {}),
    });
  } catch (err) {
    console.error('Request OTP error:', err);
    res.status(500).json({ error: 'Failed to send OTP. Please try again later.' });
  }
});

// ── POST /auth/forgot-password/verify-otp ──
// Customer verifies their 6-digit WhatsApp OTP
router.post('/forgot-password/verify-otp', authLimiter, async (req, res) => {
  try {
    const { phone, otp } = req.body;
    const cleanDigits = String(phone || '').replace(/\D/g, '').slice(-10);

    if (cleanDigits.length !== 10) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number' });
    }

    if (!otp || String(otp).trim().length !== 6) {
      return res.status(400).json({ error: 'Please enter the complete 6-digit OTP' });
    }

    const result = otpStore.verifyOtp(cleanDigits, otp);
    if (!result.valid) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      message: 'OTP verified successfully! You can now set your new password.',
      resetToken: result.resetToken,
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

// ── POST /auth/forgot-password/reset ──
// Customer sets their new password with verified OTP or resetToken
router.post('/forgot-password/reset', authLimiter, async (req, res) => {
  try {
    const { phone, resetToken, otp, newPassword } = req.body;
    const cleanDigits = String(phone || '').replace(/\D/g, '').slice(-10);

    if (cleanDigits.length !== 10) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number' });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const tokenOrOtp = resetToken || otp;
    const result = otpStore.consumeReset(cleanDigits, tokenOrOtp);
    if (!result.valid) {
      return res.status(400).json({ error: result.error || 'Invalid or expired reset session. Please request a new OTP.' });
    }

    // Encrypt new password using bcrypt
    const passwordHash = await hashPassword(newPassword);

    const updatedUser = await req.prisma.user.update({
      where: { id: result.userId },
      data: { passwordHash },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        businessId: true,
      },
    });

    // Automatically authenticate the user and return session tokens
    const tokens = generateTokens(updatedUser);
    const customer = await req.prisma.customer.findFirst({
      where: { userId: updatedUser.id },
      select: { id: true },
    });

    res.json({
      success: true,
      message: 'Your password has been reset successfully! Logging you in...',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        phone: updatedUser.phone,
        role: updatedUser.role,
        businessId: updatedUser.businessId,
        customerId: customer?.id || null,
      },
      ...tokens,
    });
  } catch (err) {
    console.error('Password reset error:', err);
    res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  }
});

export default router;
