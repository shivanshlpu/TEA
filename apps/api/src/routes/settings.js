// ── Settings Routes ──
// GET /settings, PUT /settings — business settings management

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { requireBusinessScope } from '../middleware/businessScope.js';
import cache from '../lib/cache.js';

const router = Router();

// ── GET /default-business ──
// Public endpoint for new customers to auto-resolve active business settings & delivery radius (Cached).
router.get('/default-business', async (req, res) => {
  try {
    const cacheKey = 'settings:default-business';
    const cached = cache.get(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    const business = await req.prisma.business.findFirst();
    if (!business) return res.status(404).json({ error: 'No business found' });

    const payload = {
      id: business.id,
      name: business.name,
      address: business.address,
      deliveryRadiusKm: business.deliveryRadiusKm,
      minOrderAmount: business.minOrderAmount,
      packingCharge: business.packingCharge,
      deliveryCharge: business.deliveryCharge,
      openingTime: business.openingTime,
      closingTime: business.closingTime,
      upiId: business.upiId,
      phoneNumber: business.phoneNumber,
    };

    cache.set(cacheKey, payload, 600); // 10 min cache
    res.setHeader('X-Cache', 'MISS');
    res.json(payload);
  } catch (err) {
    console.error('Default business fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch default business' });
  }
});

import { getWhatsAppStatus, logoutWhatsApp } from '../lib/baileys.js';

// ── GET /whatsapp-status ──
router.get('/whatsapp-status', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const status = getWhatsAppStatus();
    res.json(status);
  } catch (err) {
    console.error('WhatsApp status error:', err);
    res.json({ ready: false, qr: null, error: err.message });
  }
});

// ── POST /whatsapp/disconnect ──
router.post('/whatsapp/disconnect', authenticate, authorize('owner'), async (req, res) => {
  try {
    const result = await logoutWhatsApp();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset WhatsApp session' });
  }
});

const updateSettingsSchema = z.object({
  name: z.string().min(1).nullish(),
  industryType: z.string().nullish(),
  address: z.string().nullish(),
  openingTime: z.string().nullish(),
  closingTime: z.string().nullish(),
  deliveryRadiusKm: z.number().min(0).nullish(),
  minOrderAmount: z.number().min(0).nullish(),
  packingCharge: z.number().min(0).nullish(),
  deliveryCharge: z.number().min(0).nullish(),
  upiId: z.string().nullish(),
  qrCodeUrl: z.string().nullish(),
  gstNumber: z.string().nullish(),
  phoneNumber: z.string().nullish(),
  whatsappNumber: z.string().nullish(),
});

// ── GET /settings ──
router.get('/',
  authenticate,
  authorize('owner', 'manager'),
  requireBusinessScope,
  async (req, res) => {
    try {
      let business = await req.prisma.business.findUnique({
        where: { id: req.businessId },
      });
      if (!business) {
        business = await req.prisma.business.findFirst();
      }
      if (!business) return res.status(404).json({ error: 'Business not found' });
      res.json(business);
    } catch (err) {
      console.error('Settings fetch error:', err);
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  }
);

// ── PUT /settings ──
router.put('/',
  authenticate,
  authorize('owner'),
  requireBusinessScope,
  async (req, res) => {
    try {
      const data = {};
      const {
        name,
        industryType,
        address,
        openingTime,
        closingTime,
        deliveryRadiusKm,
        minOrderAmount,
        packingCharge,
        deliveryCharge,
        upiId,
        qrCodeUrl,
        gstNumber,
        phoneNumber,
        whatsappNumber,
      } = req.body;

      if (name !== undefined && name !== null) data.name = String(name).trim();
      if (industryType !== undefined && industryType !== null) data.industryType = String(industryType).trim();
      if (address !== undefined && address !== null) data.address = String(address).trim();
      if (openingTime !== undefined && openingTime !== null) data.openingTime = String(openingTime).trim();
      if (closingTime !== undefined && closingTime !== null) data.closingTime = String(closingTime).trim();
      
      // Store delivery / charges (paused or zero by default)
      if (deliveryRadiusKm !== undefined) data.deliveryRadiusKm = Number(deliveryRadiusKm) || 0;
      if (minOrderAmount !== undefined) data.minOrderAmount = Number(minOrderAmount) || 0;
      if (packingCharge !== undefined) data.packingCharge = Number(packingCharge) || 0;
      if (deliveryCharge !== undefined) data.deliveryCharge = Number(deliveryCharge) || 0;

      if (upiId !== undefined) data.upiId = upiId ? String(upiId).trim() : null;
      if (qrCodeUrl !== undefined) data.qrCodeUrl = qrCodeUrl ? String(qrCodeUrl).trim() : null;
      if (gstNumber !== undefined) data.gstNumber = gstNumber ? String(gstNumber).trim() : null;
      if (phoneNumber !== undefined && phoneNumber !== null) data.phoneNumber = String(phoneNumber).trim();
      if (whatsappNumber !== undefined && whatsappNumber !== null) data.whatsappNumber = String(whatsappNumber).trim();

      // Resolve business ID safely to prevent "No record was found for an update"
      let business = await req.prisma.business.findUnique({
        where: { id: req.businessId },
      });
      if (!business) {
        business = await req.prisma.business.findFirst();
      }
      if (!business) {
        return res.status(404).json({ error: 'No business record found to update' });
      }

      const updatedBusiness = await req.prisma.business.update({
        where: { id: business.id },
        data,
      });

      // Invalidate cached default-business & emit socket event
      cache.del('settings:default-business');
      if (req.io) {
        req.io.to(`business:${business.id}`).emit('settings-updated', updatedBusiness);
      }

      // Synchronize user record if it was pointing to an old businessId
      if (req.user?.id && req.user.businessId !== business.id) {
        await req.prisma.user.update({
          where: { id: req.user.id },
          data: { businessId: business.id },
        }).catch(() => {});
      }

      res.json(updatedBusiness);
    } catch (err) {
      console.error('Settings update error:', err);
      res.status(500).json({ error: 'Failed to update settings: ' + err.message });
    }
  }
);

export default router;
