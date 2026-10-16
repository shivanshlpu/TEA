// ── Notification Routes ──
// POST /notifications/whatsapp/send — manual WhatsApp send (owner/manager)
// POST /notifications/whatsapp/bulk — bulk WhatsApp send (owner/manager)

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { requireBusinessScope } from '../middleware/businessScope.js';
import { sendWhatsAppNotification, sendWhatsAppBulk } from '../lib/whatsapp.js';

const router = Router();

// ── Schemas ──
const sendSchema = z.object({
  phone: z.string().min(10, 'Phone number is required'),
  message: z.string().min(1, 'Message is required'),
});

const bulkSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  filter: z.enum(['all', 'premium', 'new', 'inactive']).default('all'),
});

// ── POST /notifications/whatsapp/send — send to one number ──
router.post('/whatsapp/send',
  authenticate,
  authorize('owner', 'manager'),
  requireBusinessScope,
  validate(sendSchema),
  async (req, res) => {
    try {
      const { phone, message } = req.body;
      const success = await sendWhatsAppNotification(phone, message);

      if (success) {
        res.json({ message: 'WhatsApp message sent successfully' });
      } else {
        res.status(502).json({ error: 'Failed to send — WhatsApp gateway may be down' });
      }
    } catch (err) {
      console.error('WhatsApp send error:', err);
      res.status(500).json({ error: 'Failed to send WhatsApp message' });
    }
  }
);

// ── POST /notifications/whatsapp/bulk — send to filtered customer list ──
router.post('/whatsapp/bulk',
  authenticate,
  authorize('owner', 'manager'),
  requireBusinessScope,
  validate(bulkSchema),
  async (req, res) => {
    try {
      const { message, filter } = req.body;

      // Build customer filter
      const where = { businessId: req.businessId };
      const now = new Date();

      if (filter === 'premium') {
        where.isPremium = true;
      } else if (filter === 'new') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        where.user = { createdAt: { gte: thirtyDaysAgo } };
      } else if (filter === 'inactive') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        where.OR = [
          { lastOrderAt: null },
          { lastOrderAt: { lt: thirtyDaysAgo } },
        ];
      }

      const customers = await req.prisma.customer.findMany({
        where,
        include: { user: { select: { phone: true, name: true } } },
      });

      if (customers.length === 0) {
        return res.json({ message: 'No customers match the filter', sent: 0, failed: 0 });
      }

      const recipients = customers.map((c) => c.user.phone);
      const result = await sendWhatsAppBulk(recipients, message);

      res.json({
        message: `Bulk send complete`,
        totalCustomers: customers.length,
        ...result,
      });
    } catch (err) {
      console.error('Bulk WhatsApp error:', err);
      res.status(500).json({ error: 'Failed to send bulk WhatsApp messages' });
    }
  }
);

// ── Web Push Notification Endpoints ──
import { getVapidPublicKey, subscribeUser, unsubscribeUser, sendPushToBusiness } from '../lib/pushNotifications.js';

// GET /notifications/push/vapid-key — Get VAPID public key
router.get('/push/vapid-key', (_req, res) => {
  res.json({ publicKey: getVapidPublicKey() });
});

// POST /notifications/push/subscribe — Register service worker subscription
router.post('/push/subscribe', authenticate, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Valid subscription object required' });
    }
    const businessId = req.user.businessId || 'default';
    const result = subscribeUser(subscription, businessId, req.user.role);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Push subscribe error:', err);
    res.status(500).json({ error: 'Failed to save push subscription' });
  }
});

// POST /notifications/push/unsubscribe — Unregister subscription
router.post('/push/unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;
    const result = unsubscribeUser(endpoint);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Push unsubscribe error:', err);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

// POST /notifications/push/test — Send test push notification (owner only)
router.post('/push/test', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const businessId = req.user.businessId || 'default';
    const result = await sendPushToBusiness(businessId, {
      title: 'Tea Bhatti Test Alert ☕',
      body: 'Web Push is working perfectly on your device!',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/favicon.png',
      data: { url: '/orders' },
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Push test error:', err);
    res.status(500).json({ error: 'Failed to dispatch test push' });
  }
});

export default router;
