// ── Razorpay Standard Checkout Routes ──
import { Router } from 'express';
import {
  createStandardRazorpayOrder,
  verifySignature,
  getRazorpayKeyId,
} from '../lib/razorpay.js';
import { invalidateDashboardCache } from './orders.js';
import { sendPushToBusiness } from '../lib/pushNotifications.js';

const router = Router();

// ── GET /config — Public Key ID (never returns secret) ──
router.get(['/config', '/razorpay-config'], (_req, res) => {
  const key_id = getRazorpayKeyId();
  res.json({
    key_id: key_id || null,
    isAvailable: Boolean(key_id),
    currency: 'INR',
  });
});

// ── POST /create-order (STEP 1: Backend - Create Order) ──
router.post('/create-order', async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt, notes } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount < 100) {
      return res.status(400).json({ error: 'Amount must be at least 100 paise (₹1)' });
    }

    const order = await createStandardRazorpayOrder({
      amount: numericAmount,
      currency,
      receipt,
      notes: notes || {},
    });

    res.status(200).json({
      order_id: order.order_id,
      amount: order.amount,
      currency: order.currency,
      key_id: order.key_id,
    });
  } catch (err) {
    console.error('[Razorpay API] create-order error:', err);
    const status = err.status || 500;
    res.status(status).json({
      error: err.message || 'Failed to create Razorpay order',
    });
  }
});

// ── POST /verify-payment (STEP 3: Backend - Verify Signature) ──
router.post('/verify-payment', async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      order_id = razorpay_order_id,
      payment_id = razorpay_payment_id,
      signature = razorpay_signature,
      appOrderId,
    } = req.body;

    // Validate presence of required signature fields
    if (!order_id || !payment_id || !signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters (order_id, payment_id, signature)',
      });
    }

    const isValid = verifySignature({
      order_id,
      payment_id,
      signature,
    });

    if (!isValid) {
      console.warn(`[Razorpay API] Signature mismatch for order ${order_id}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature. Verification failed.',
      });
    }

    // If an application order is linked, update it in the database
    let updatedAppOrder = null;
    const targetOrderId = appOrderId || req.body.orderId;
    if (req.prisma && targetOrderId) {
      try {
        const existing = await req.prisma.order.findUnique({
          where: { id: targetOrderId },
          include: { customer: { include: { user: true } } },
        });

        if (existing) {
          const newStatus = existing.status === 'received' ? 'accepted' : existing.status;
          updatedAppOrder = await req.prisma.order.update({
            where: { id: existing.id },
            data: {
              paymentStatus: 'verified',
              paymentUtr: payment_id,
              razorpayOrderId: order_id,
              razorpayPaymentId: payment_id,
              stripePaymentIntentId: payment_id,
              status: newStatus,
              paidAt: new Date(),
              paymentRejectReason: null,
            },
          });

          await req.prisma.orderStatusLog.create({
            data: {
              orderId: existing.id,
              status: 'payment_verified_razorpay',
            },
          });

          invalidateDashboardCache(existing.businessId);

          if (req.io) {
            req.io.to(`order:${existing.id}`).emit('payment-update', {
              orderId: existing.id,
              paymentStatus: 'verified',
              paymentUtr: payment_id,
              status: newStatus,
              pickupCode: existing.pickupCode,
              paidAt: new Date(),
            });

            req.io.to(`business:${existing.businessId}`).emit('payment-verified', {
              orderId: existing.id,
              pickupCode: existing.pickupCode,
              total: existing.total,
              action: 'verify',
              paymentStatus: 'verified',
              customerName: existing.customer?.user?.name || 'Customer',
            });
          }

          sendPushToBusiness(existing.businessId, {
            title: `✅ Payment Verified: #${existing.pickupCode}`,
            body: `Order #${existing.pickupCode} (₹${existing.total}) paid via Razorpay!`,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/favicon.png',
            tag: `verify-${existing.id}`,
            data: { url: '/orders', type: 'payment_verified', orderId: existing.id },
          }, req.prisma).catch(() => {});
        }
      } catch (dbErr) {
        console.warn('[Razorpay API] Note updating DB order:', dbErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      order_id,
      payment_id,
      appOrder: updatedAppOrder,
    });
  } catch (err) {
    console.error('[Razorpay API] verify-payment error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to verify payment',
    });
  }
});

export default router;
