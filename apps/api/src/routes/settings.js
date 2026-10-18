// ── Settings Routes ──
// GET /settings, PUT /settings — business settings management

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';
import { requireBusinessScope } from '../middleware/businessScope.js';
import cache from '../lib/cache.js';

const router = Router();

// ── GET /default-business ──
// Public endpoint for new customers to auto-resolve active business settings & delivery radius (Cached).
router.get('/default-business', async (req, res) => {
  try {
    const cacheKey = 'settings:default-business';
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=180, stale-while-revalidate=300');

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
      whatsappNumber: business.whatsappNumber || business.phoneNumber,
      isAcceptingOrders: business.isAcceptingOrders !== undefined ? Boolean(business.isAcceptingOrders) : true,
      closureReason: business.closureReason || null,
      closedDays: Array.isArray(business.closedDays) ? business.closedDays : [],
    };

    cache.set(cacheKey, payload, 60); // 1 min cache for quick response to status toggles
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

// ── GET /store-status — Quick status check ──
router.get('/store-status', async (req, res) => {
  try {
    const business = await req.prisma.business.findFirst({
      select: {
        id: true,
        isAcceptingOrders: true,
        closureReason: true,
        openingTime: true,
        closingTime: true,
        closedDays: true,
      },
    });
    if (!business) return res.status(404).json({ error: 'Business not found' });
    res.json({
      isAcceptingOrders: business.isAcceptingOrders !== false,
      closureReason: business.closureReason || null,
      openingTime: business.openingTime,
      closingTime: business.closingTime,
      closedDays: Array.isArray(business.closedDays) ? business.closedDays : [],
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch store status' });
  }
});

// ── PATCH /store-status — Fast Emergency Toggle (Accepting Orders ON/OFF) ──
router.patch('/store-status', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const { isAcceptingOrders, closureReason } = req.body;
    let bizId = req.user.businessId;
    let business = null;
    if (bizId && /^[0-9a-fA-F]{24}$/.test(bizId)) {
      business = await req.prisma.business.findUnique({ where: { id: bizId } });
    }
    if (!business) {
      business = await req.prisma.business.findFirst();
    }
    if (!business) return res.status(404).json({ error: 'Business not found' });

    const updated = await req.prisma.business.update({
      where: { id: business.id },
      data: {
        isAcceptingOrders: Boolean(isAcceptingOrders),
        closureReason: isAcceptingOrders ? null : (closureReason ? String(closureReason).trim() : 'Store is temporarily closed'),
      },
    });

    cache.del('settings:default-business');

    // Notify all connected dashboard and customer sockets
    if (req.io) {
      req.io.emit('store-status-changed', {
        isAcceptingOrders: updated.isAcceptingOrders,
        closureReason: updated.closureReason,
      });
      req.io.to(`business:${updated.id}`).emit('settings-updated', updated);
    }

    res.json({
      success: true,
      isAcceptingOrders: updated.isAcceptingOrders,
      closureReason: updated.closureReason,
      message: updated.isAcceptingOrders 
        ? 'Tea Bhatti is now Online & accepting orders!' 
        : `Store turned OFF: ${updated.closureReason}`,
    });
  } catch (err) {
    console.error('Store status toggle error:', err);
    res.status(500).json({ error: 'Failed to update store status: ' + err.message });
  }
});

// ── GET /settings/notification-sound (and aliases) ──
router.get(['/notification-sound', '/custom-sound', '/sound'], optionalAuth, async (req, res) => {
  try {
    let bizId = req.user?.businessId || req.businessId;
    let business = null;
    if (bizId && /^[0-9a-fA-F]{24}$/.test(bizId)) {
      business = await req.prisma.business.findUnique({ where: { id: bizId } });
    }
    if (!business) {
      business = await req.prisma.business.findFirst();
    }
    if (!business) {
      business = await req.prisma.business.create({
        data: {
          name: 'Tea Bhatti',
          address: 'Near Medical College, Shahdol, Madhya Pradesh',
          phoneNumber: '+917000748920',
          notificationSoundType: 'chime',
        },
      });
    }

    res.json({
      soundType: business.notificationSoundType || 'chime',
      customNotificationName: business.customNotificationName || null,
      customNotificationData: business.customNotificationData || null,
    });
  } catch (err) {
    console.error('Notification sound fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch notification sound' });
  }
});

// Handler for updating notification sound (supports both PUT and POST, plus route aliases)
const handleNotificationSoundUpdate = async (req, res) => {
  try {
    const { soundType, customNotificationName, customNotificationData } = req.body || {};
    let bizId = req.user?.businessId || req.businessId;
    let business = null;
    if (bizId && /^[0-9a-fA-F]{24}$/.test(bizId)) {
      business = await req.prisma.business.findUnique({ where: { id: bizId } });
    }
    if (!business) {
      business = await req.prisma.business.findFirst();
    }
    if (!business) {
      business = await req.prisma.business.create({
        data: {
          name: 'Tea Bhatti',
          address: 'Near Medical College, Shahdol, Madhya Pradesh',
          phoneNumber: '+917000748920',
          notificationSoundType: 'custom',
        },
      });
    }

    // Validate payload size (under 4.5MB base64)
    if (customNotificationData && customNotificationData.length > 4.5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Custom ringtone audio file must be under 3MB' });
    }

    const dataToUpdate = {};
    if (soundType !== undefined) dataToUpdate.notificationSoundType = String(soundType);
    if (customNotificationName !== undefined) dataToUpdate.customNotificationName = customNotificationName ? String(customNotificationName) : null;
    if (customNotificationData !== undefined) dataToUpdate.customNotificationData = customNotificationData ? String(customNotificationData) : null;

    const updated = await req.prisma.business.update({
      where: { id: business.id },
      data: dataToUpdate,
    });

    console.log(`🎵 Custom ringtone updated for business ${business.id}: ${updated.notificationSoundType} (${updated.customNotificationName || 'none'})`);

    // Broadcast in real-time to ALL staff/owner devices connected via socket
    if (req.io) {
      const payload = {
        soundType: updated.notificationSoundType,
        customNotificationName: updated.customNotificationName,
        customNotificationData: updated.customNotificationData,
        businessId: business.id,
      };
      req.io.to(`business:${business.id}`).emit('notification-sound-updated', payload);
      req.io.emit('notification-sound-updated', payload);
    }

    res.json({
      success: true,
      soundType: updated.notificationSoundType,
      customNotificationName: updated.customNotificationName,
      customNotificationData: updated.customNotificationData,
    });
  } catch (err) {
    console.error('Notification sound update error:', err);
    res.status(500).json({ error: 'Failed to update notification sound: ' + err.message });
  }
};

// ── PUT & POST /settings/notification-sound — Upload/Update custom sound or sound type across all devices ──
router.put(['/notification-sound', '/custom-sound', '/sound'], authenticate, authorize('owner', 'manager'), handleNotificationSoundUpdate);
router.post(['/notification-sound', '/custom-sound', '/sound'], authenticate, authorize('owner', 'manager'), handleNotificationSoundUpdate);

// ── DELETE /settings/notification-sound — Remove custom sound and reset to chime ──
router.delete(['/notification-sound', '/custom-sound', '/sound'], authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    let bizId = req.user?.businessId || req.businessId;
    let business = null;
    if (bizId && /^[0-9a-fA-F]{24}$/.test(bizId)) {
      business = await req.prisma.business.findUnique({ where: { id: bizId } });
    }
    if (!business) {
      business = await req.prisma.business.findFirst();
    }
    if (!business) {
      business = await req.prisma.business.create({
        data: {
          name: 'Tea Bhatti',
          address: 'Near Medical College, Shahdol, Madhya Pradesh',
          phoneNumber: '+917000748920',
          notificationSoundType: 'chime',
        },
      });
    }

    const updated = await req.prisma.business.update({
      where: { id: business.id },
      data: {
        notificationSoundType: 'chime',
        customNotificationName: null,
        customNotificationData: null,
      },
    });

    if (req.io) {
      const payload = {
        soundType: 'chime',
        customNotificationName: null,
        customNotificationData: null,
        businessId: business.id,
      };
      req.io.to(`business:${business.id}`).emit('notification-sound-updated', payload);
      req.io.emit('notification-sound-updated', payload);
    }

    res.json({
      success: true,
      soundType: 'chime',
      customNotificationName: null,
      customNotificationData: null,
    });
  } catch (err) {
    console.error('Notification sound delete error:', err);
    res.status(500).json({ error: 'Failed to remove custom notification sound: ' + err.message });
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
  isAcceptingOrders: z.boolean().nullish(),
  closureReason: z.string().nullish(),
  closedDays: z.array(z.string()).nullish(),
  notificationSoundType: z.string().nullish(),
  soundType: z.string().nullish(),
  customNotificationName: z.string().nullish(),
  customNotificationData: z.string().nullish(),
}).passthrough();

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
        isAcceptingOrders,
        closureReason,
        closedDays,
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

      // Store Availability & Emergency Toggle
      if (isAcceptingOrders !== undefined) data.isAcceptingOrders = Boolean(isAcceptingOrders);
      if (closureReason !== undefined) data.closureReason = closureReason ? String(closureReason).trim() : null;
      if (closedDays !== undefined && Array.isArray(closedDays)) data.closedDays = closedDays;

      // Notification Sound & Custom Ringtone (Guarantees root /settings update works on all servers)
      if (req.body.notificationSoundType !== undefined) data.notificationSoundType = String(req.body.notificationSoundType);
      if (req.body.soundType !== undefined) data.notificationSoundType = String(req.body.soundType);
      if (req.body.customNotificationName !== undefined) data.customNotificationName = req.body.customNotificationName ? String(req.body.customNotificationName) : null;
      if (req.body.customNotificationData !== undefined) data.customNotificationData = req.body.customNotificationData ? String(req.body.customNotificationData) : null;

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
        if (data.notificationSoundType !== undefined || data.customNotificationData !== undefined) {
          const soundPayload = {
            soundType: updatedBusiness.notificationSoundType,
            customNotificationName: updatedBusiness.customNotificationName,
            customNotificationData: updatedBusiness.customNotificationData,
            businessId: business.id,
          };
          req.io.to(`business:${business.id}`).emit('notification-sound-updated', soundPayload);
          req.io.emit('notification-sound-updated', soundPayload);
        }
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
