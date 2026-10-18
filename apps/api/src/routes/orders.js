// ── Order Routes ──
// POST /orders, GET /orders/:id, GET /orders, PATCH /orders/:id/status,
// PATCH /orders/:id/cancel, GET /orders/:id/track,
// POST /orders/:id/payment/utr, PATCH /orders/:id/payment/verify

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';
import { requireBusinessScope } from '../middleware/businessScope.js';
import { sendWhatsAppNotification, sendWhatsAppTemplate } from '../lib/whatsapp.js';
import { sendPickupSoonAlert, sendOrderReadyAlert } from '../lib/baileys.js';
import {
  createRazorpayOrder,
  verifyRazorpaySignature,
  verifyRazorpayWebhookSignature,
  processRazorpayRefund,
  getRazorpayKeyId,
} from '../lib/razorpay.js';
import { sendPushToBusiness } from '../lib/pushNotifications.js';
import QRCode from 'qrcode';
import cache from '../lib/cache.js';

export function invalidateDashboardCache(businessId) {
  if (!businessId) return;
  cache.del(`dashboard:${businessId}:stats`);
  cache.delPrefix(`reports:${businessId}`);
}

const router = Router();

// ── Verification Follow-up Reminder Tracker (Disabled per user request) ──
export function cancelVerificationFollowUp(orderId) {}

export function scheduleVerificationFollowUp(orderId, businessId, pickupCode, total, io, prisma) {
  // 10-second repeating reminders disabled so sound only occurs once upon incoming order/payment
}

// ── Schemas ──
const createOrderSchema = z.object({
  businessId: z.string().optional(),
  items: z.array(z.object({
    menuItemId: z.string().min(1),
    name: z.string().optional(),
    quantity: z.number().int().positive().default(1),
    addOns: z.array(z.object({
      name: z.string(),
      price: z.number().min(0),
    })).default([]),
  })).min(1),
  orderType: z.enum(['pickup', 'delivery']).default('pickup'),
  deliveryAddress: z.string().optional(),
  distanceKm: z.number().optional(),
  couponCode: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered']),
});

const utrSchema = z.object({
  utr: z.string().min(6, 'UTR must be at least 6 characters'),
});

// Status flow validation
const STATUS_FLOW = {
  received: ['accepted', 'preparing', 'cancelled'],
  accepted: ['preparing', 'ready', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['out_for_delivery', 'delivered'], // delivered directly if pickup
  out_for_delivery: ['delivered'],
  delivered: [],
  cancelled: [],
};

// ── POST /orders — create order ──
router.post('/', authenticate, validate(createOrderSchema), async (req, res) => {
  try {
    const { businessId, items, orderType, deliveryAddress, distanceKm, couponCode } = req.body;

    // Fetch business safely
    let business = null;
    if (businessId && /^[0-9a-fA-F]{24}$/.test(businessId)) {
      business = await req.prisma.business.findUnique({ where: { id: businessId } });
    }
    if (!business) {
      business = await req.prisma.business.findFirst();
    }
    if (!business) return res.status(404).json({ error: 'Business not found' });

    // Store Availability Check (Emergency Pause, Closed Days, Operating Hours)
    if (business.isAcceptingOrders === false) {
      const reason = business.closureReason || 'Temporarily not accepting orders. Please check back later.';
      return res.status(400).json({
        error: `Tea Bhatti is currently unable to accept orders: ${reason}`,
        isStoreClosed: true,
        closureReason: reason,
      });
    }

    // Check closed days & operating hours in IST (Asia/Kolkata)
    const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayName = daysOfWeek[nowIST.getDay()];

    if (Array.isArray(business.closedDays) && business.closedDays.includes(currentDayName)) {
      return res.status(400).json({
        error: `Tea Bhatti is closed on ${currentDayName}s. We look forward to serving you on our next working day!`,
        isStoreClosed: true,
        closureReason: `Closed on ${currentDayName}s`,
      });
    }

    if (business.openingTime && business.closingTime) {
      const [openH, openM] = business.openingTime.split(':').map(Number);
      const [closeH, closeM] = business.closingTime.split(':').map(Number);
      const currentMinutes = nowIST.getHours() * 60 + nowIST.getMinutes();
      const openMinutes = openH * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;

      let isOpen = false;
      if (openMinutes <= closeMinutes) {
        isOpen = currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
      } else {
        isOpen = currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
      }

      if (!isOpen) {
        return res.status(400).json({
          error: `Tea Bhatti is currently closed. Operating hours are ${business.openingTime} to ${business.closingTime}.`,
          isStoreClosed: true,
          closureReason: `Closed. Operating hours: ${business.openingTime} - ${business.closingTime}`,
        });
      }
    }

    // Enforce Pickup Only (Delivery Coming Soon)
    if (orderType === 'delivery') {
      return res.status(400).json({
        error: 'Home Delivery is Coming Soon! Currently offering fast Store Pickup with 20% advance booking.',
      });
    }

    // Find or create customer record
    let customer = await req.prisma.customer.findFirst({
      where: { userId: req.user.id, businessId: business.id },
    });
    if (!customer) {
      const referralCode = 'REF' + Math.random().toString(36).substring(2, 8).toUpperCase();
      customer = await req.prisma.customer.create({
        data: { userId: req.user.id, businessId: business.id, referralCode },
      });
    }

    // Known alias map for homepage items
    const ALIAS_MAP = {
      'bs-1': 'Tandoori Paneer Sandwich',
      'bs-2': 'Cheese Peppy Paneer',
      'bs-3': 'Cheese Butter Vadapav',
      'bs-4': 'Veggie Cheese Maggie',
      'bs-5': '1 Ch. Peppy Paneer Pizza',
      'bs-6': 'Veggie Cheese Corn',
    };

    // Pre-fetch all business menu items
    const allMenuItems = await req.prisma.menuItem.findMany({
      where: { businessId: business.id },
      include: { addOns: true },
    });

    let subtotal = 0;
    const orderItems = [];

    for (const cartItem of items) {
      // 1. Try finding by ID
      let menuItem = allMenuItems.find(m => m.id === cartItem.menuItemId);

      // 2. Try alias mapping or name matching
      if (!menuItem) {
        const targetName = (ALIAS_MAP[cartItem.menuItemId] || cartItem.name || '').toLowerCase();
        if (targetName) {
          menuItem = allMenuItems.find(m => 
            m.name.toLowerCase().includes(targetName) || targetName.includes(m.name.toLowerCase())
          );
        }
      }

      // 3. Fallback to first available item
      if (!menuItem && allMenuItems.length > 0) {
        menuItem = allMenuItems[0];
      }

      if (!menuItem) return res.status(400).json({ error: `Item not found in menu` });

      const discountedPrice = menuItem.price * (1 - (menuItem.discountPct || 0) / 100);
      let addOnTotal = 0;
      const validAddOns = [];

      for (const ao of (cartItem.addOns || [])) {
        const real = menuItem.addOns?.find(a => a.name === ao.name);
        if (real) {
          validAddOns.push({ name: real.name, price: real.price });
          addOnTotal += real.price;
        }
      }

      subtotal += (discountedPrice + addOnTotal) * cartItem.quantity;
      orderItems.push({
        menuItemId: menuItem.id,
        quantity: cartItem.quantity,
        priceEach: discountedPrice,
        addOns: JSON.stringify(validAddOns),
      });
    }

    const packingCharge = business.packingCharge || 0;
    const deliveryCharge = 0; // Pickups only

    // Coupon & Automatic Combo Discount
    let discount = 0;
    const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);

    if (couponCode) {
      const cleanCode = couponCode.toUpperCase();
      
      // Enforce single-use coupon per customer
      const alreadyUsed = await req.prisma.order.findFirst({
        where: { customerId: customer.id, couponCode: cleanCode, status: { not: 'cancelled' } },
      });
      if (alreadyUsed) {
        return res.status(400).json({ error: 'You have already used this coupon code. It is valid for one-time use only.' });
      }

      const coupon = await req.prisma.coupon.findFirst({
        where: {
          businessId, code: cleanCode,
          OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
        },
      });
      if (coupon) {
        if (coupon.discountType === 'percentage') discount = (subtotal * coupon.value) / 100;
        else if (coupon.discountType === 'fixed') discount = coupon.value;
        else if (coupon.discountType === 'free_delivery') discount = 0;
      }
    } else if (totalQuantity >= 4) {
      // Auto Combo Offer: 4 or more items gets 10% OFF
      discount = (subtotal * 10) / 100;
    }

    const gst = 0;
    const total = Math.round(subtotal - discount + packingCharge);

    // 20% advance upfront and remainder balance due at counter (strictly integers, sum = total)
    const advanceAmount = Math.round(total * 0.20);
    const balanceAmount = total - advanceAmount;
    const pickupCode = 'TB-' + Math.floor(1000 + Math.random() * 9000);
    const estimatedMinutes = 15; // Fast pickup preparation

    // Create order + items + status log
    const order = await req.prisma.order.create({
      data: {
        businessId: business.id,
        customerId: customer.id,
        orderType: 'pickup',
        status: 'received',
        subtotal: Math.round(subtotal),
        packingCharge,
        deliveryCharge: 0,
        gst: 0,
        discount: Math.round(discount),
        total,
        advanceAmount,
        balanceAmount,
        pickupCode,
        paymentStatus: 'pending',
        couponCode: couponCode?.toUpperCase() || null,
        deliveryAddress: null,
        distanceKm: 0,
        estimatedMinutes,
        items: { create: orderItems },
      },
      include: { items: { include: { menuItem: true } } },
    });

    // Update coupon usage count and customer tracker
    if (couponCode) {
      try {
        await req.prisma.coupon.updateMany({
          where: { businessId: business.id, code: couponCode.toUpperCase() },
          data: {
            usedCount: { increment: 1 },
            usedByCustomerIds: { push: customer.id },
          },
        });
      } catch (couponErr) {
        console.warn('Coupon usage record note:', couponErr.message);
      }
    }

    // Log initial status
    await req.prisma.orderStatusLog.create({
      data: { orderId: order.id, status: 'received' },
    });

    // Push real-time notification to owner dashboard
    req.io.to(`business:${business.id}`).emit('new-order', {
      orderId: order.id,
      total: order.total,
      orderType: order.orderType,
      itemCount: order.items.length,
      createdAt: order.createdAt,
    });
    invalidateDashboardCache(business.id);

    // Web Push alert to owner devices (background service worker push)
    sendPushToBusiness(business.id, {
      title: 'New Order Received! ☕',
      body: `Order #${order.pickupCode || order.id.slice(-6).toUpperCase()} for ₹${order.total} (${order.items.length} items)`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/favicon.png',
      tag: `order-${order.id}`,
      data: { url: '/orders', orderId: order.id },
    }, req.prisma).catch(e => console.warn('[Push] Background push error:', e.message));

    // Schedule 10-second follow-up notification if order remains unverified/pending
    scheduleVerificationFollowUp(order.id, business.id, order.pickupCode, order.total, req.io, req.prisma);

    // Fire & forget WhatsApp to Owner
    sendWhatsAppTemplate(
      business.whatsappNumber || business.phoneNumber,
      'new_order',
      {
        orderId: order.id,
        orderType: order.orderType,
        itemCount: order.items.length,
        total: order.total,
      }
    );

    // Normalize order items so client never crashes parsing addOns or price
    const normalizedItems = order.items.map(it => {
      let parsedAddOns = [];
      if (Array.isArray(it.addOns)) parsedAddOns = it.addOns;
      else if (typeof it.addOns === 'string') {
        try { parsedAddOns = JSON.parse(it.addOns); } catch (_) { parsedAddOns = []; }
      }
      return {
        ...it,
        name: it.menuItem?.name || 'Item',
        price: it.priceEach,
        addOns: parsedAddOns,
      };
    });

    res.status(201).json({
      ...order,
      items: normalizedItems,
    });
  } catch (err) {
    console.error('Order create error:', err);
    res.status(500).json({ error: 'Failed to create order: ' + err.message });
  }
});

// ── GET /orders/:id — get order detail (scoped to user) ──
router.get('/:id', authenticate, async (req, res) => {
  try {
    const order = await req.prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: { include: { menuItem: true } },
        statusLogs: { orderBy: { timestamp: 'asc' } },
        business: { select: { name: true, phoneNumber: true } },
        customer: { select: { userId: true } },
      },
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Access control: customers can only see their own orders
    if (req.user.role === 'customer') {
      if (order.customer?.userId !== req.user.id) {
        return res.status(403).json({ error: 'You do not have access to this order' });
      }
    } else {
      // Owner/staff: can only see orders from their own business
      let userBizId = req.user.businessId;
      let bizExists = null;
      if (userBizId && /^[0-9a-fA-F]{24}$/.test(userBizId)) {
        bizExists = await req.prisma.business.findUnique({ where: { id: userBizId }, select: { id: true } });
      }
      if (!bizExists) {
        const defaultBiz = await req.prisma.business.findFirst({ select: { id: true } });
        userBizId = defaultBiz?.id;
      }
      if (userBizId && order.businessId && order.businessId !== userBizId) {
        return res.status(403).json({ error: 'Order does not belong to your business' });
      }
    }

    res.json(order);
  } catch (err) {
    console.error('Order fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// ── GET /orders — list orders (owner: all for business, customer: own orders) ──
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, from, to, page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};

    if (req.user.role === 'owner' || req.user.role === 'manager' || req.user.role === 'cashier') {
      let bizId = req.user.businessId;
      let bizExists = null;

      // 1. Verify if the businessId from token actually exists in DB
      if (bizId && /^[0-9a-fA-F]{24}$/.test(bizId)) {
        bizExists = await req.prisma.business.findUnique({
          where: { id: bizId },
          select: { id: true },
        });
      }

      // 2. If token businessId is stale/null, check user record in DB
      if (!bizExists) {
        const u = await req.prisma.user.findUnique({
          where: { id: req.user.id },
          select: { businessId: true },
        });
        if (u?.businessId && /^[0-9a-fA-F]{24}$/.test(u.businessId)) {
          bizExists = await req.prisma.business.findUnique({
            where: { id: u.businessId },
            select: { id: true },
          });
          if (bizExists) bizId = u.businessId;
        }
      }

      // 3. Ultimate fallback: active first business in database
      if (!bizExists) {
        const defaultBiz = await req.prisma.business.findFirst({ select: { id: true } });
        if (defaultBiz) {
          bizId = defaultBiz.id;
          bizExists = defaultBiz;
          // Synchronize user record
          await req.prisma.user.update({
            where: { id: req.user.id },
            data: { businessId: defaultBiz.id },
          }).catch(() => {});
        }
      }

      if (bizId) {
        where.businessId = bizId;
      }
    } else {
      // Customer: find their customer records
      const customers = await req.prisma.customer.findMany({
        where: { userId: req.user.id },
        select: { id: true },
      });
      where.customerId = { in: customers.map(c => c.id) };
    }

    if (status) where.status = status;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [orders, total] = await Promise.all([
      req.prisma.order.findMany({
        where,
        include: {
          items: { include: { menuItem: { select: { name: true, imageUrl: true } } } },
          customer: { include: { user: { select: { name: true, phone: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      req.prisma.order.count({ where }),
    ]);

    res.json({ orders, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error('Orders list error:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// ── PATCH /orders/:id/status — update order status (owner/staff) ──
router.patch('/:id/status',
  authenticate,
  authorize('owner', 'manager', 'cashier', 'chef', 'delivery_partner'),
  validate(updateStatusSchema),
  async (req, res) => {
    try {
      const order = await req.prisma.order.findUnique({ where: { id: req.params.id } });
      if (!order) return res.status(404).json({ error: 'Order not found' });

      // Validate status flow
      const allowed = STATUS_FLOW[order.status];
      if (!allowed || !allowed.includes(req.body.status)) {
        return res.status(400).json({
          error: `Cannot move from "${order.status}" to "${req.body.status}"`,
          allowedTransitions: allowed,
        });
      }

      // Auto-verify advance payment when order is accepted/processed
      const shouldVerifyPayment = ['accepted', 'preparing', 'ready', 'delivered'].includes(req.body.status) &&
        ['pending', 'utr_submitted'].includes(order.paymentStatus);

      const updateTx = async () => {
        return await req.prisma.$transaction(async (tx) => {
          const updateData = { status: req.body.status };
          if (shouldVerifyPayment) {
            updateData.paymentStatus = 'verified';
            if (!order.paidAt) updateData.paidAt = new Date();
          }

          const ord = await tx.order.update({
            where: { id: req.params.id },
            data: updateData,
            include: { 
              items: { include: { menuItem: true } },
              customer: { include: { user: true } },
              business: true 
            },
          });

          await tx.orderStatusLog.create({
            data: { orderId: ord.id, status: req.body.status },
          });

          if (shouldVerifyPayment) {
            await tx.orderStatusLog.create({
              data: { orderId: ord.id, status: 'payment_verified' },
            });
          }

          // On delivered: update customer stats + loyalty points
          if (req.body.status === 'delivered') {
            const updatedCustomer = await tx.customer.update({
              where: { id: ord.customerId },
              data: {
                totalOrders: { increment: 1 },
                totalSpent: { increment: ord.total },
                loyaltyPoints: { increment: Math.floor(ord.total / 10) }, // ₹100 spent → 10 points
                lastOrderAt: new Date(),
              },
            });

            // Referral reward: check if this is the customer's first delivered order
            if (updatedCustomer.totalOrders === 1) {
              const referral = await tx.referral.findFirst({
                where: { refereeId: ord.customerId, rewardIssued: false },
              });
              if (referral) {
                // Award 50 points to both referrer and referee
                const REFERRAL_BONUS = 50;
                await tx.customer.update({
                  where: { id: referral.referrerId },
                  data: { loyaltyPoints: { increment: REFERRAL_BONUS } },
                });
                await tx.customer.update({
                  where: { id: referral.refereeId },
                  data: { loyaltyPoints: { increment: REFERRAL_BONUS } },
                });
                await tx.referral.update({
                  where: { id: referral.id },
                  data: { rewardIssued: true },
                });
              }
            }
          }

          return ord;
        }, { maxWait: 10000, timeout: 20000 });
      };

      let updated;
      try {
        updated = await updateTx();
      } catch (txErr) {
        if (txErr.code === 'P2034') {
          // Retry once on write conflict
          updated = await updateTx();
        } else {
          throw txErr;
        }
      }

      // Push status update via Socket.io
      req.io.to(`order:${updated.id}`).emit('order-status-update', {
        orderId: updated.id,
        status: updated.status,
        paymentStatus: updated.paymentStatus,
        timestamp: new Date(),
      });

      // If payment was verified, emit payment-update event too
      if (shouldVerifyPayment) {
        req.io.to(`order:${updated.id}`).emit('payment-update', {
          orderId: updated.id,
          paymentStatus: updated.paymentStatus,
          status: updated.status,
        });
      }

      // Also notify business room
      req.io.to(`business:${updated.businessId}`).emit('order-updated', {
        orderId: updated.id,
        status: updated.status,
        paymentStatus: updated.paymentStatus,
      });
      invalidateDashboardCache(updated.businessId);

      // Clear any pending verification follow-up timer
      cancelVerificationFollowUp(updated.id);

      // WhatsApp to customer based on status
      const customerPhone = updated.customer.user.phone;
      const baseUrl = process.env.CUSTOMER_WEB_URL || 'http://localhost:5173';
      const templateData = {
        orderId: updated.id,
        total: updated.total,
        businessName: updated.business.name,
        businessAddress: updated.business.address,
        trackingUrl: `${baseUrl}/order/${updated.id}`,
        reviewUrl: `${baseUrl}/order/${updated.id}`,
      };

      if (updated.status === 'accepted') {
        sendWhatsAppTemplate(customerPhone, 'order_accepted', templateData);
      } else if (updated.status === 'ready' && updated.orderType === 'pickup') {
        sendWhatsAppTemplate(customerPhone, 'order_ready', templateData);
      } else if (updated.status === 'out_for_delivery') {
        sendWhatsAppTemplate(customerPhone, 'out_for_delivery', templateData);
      } else if (updated.status === 'delivered') {
        sendWhatsAppTemplate(customerPhone, 'order_delivered', templateData);
      }

      res.json(updated);
    } catch (err) {
      console.error('Status update error:', err);
      res.status(500).json({ error: 'Failed to update status' });
    }
  }
);

// ── PATCH /orders/:id/cancel ──
router.patch('/:id/cancel', authenticate, async (req, res) => {
  try {
    const order = await req.prisma.order.findUnique({
      where: { id: req.params.id },
      include: { customer: { select: { userId: true } } },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Access control
    if (req.user.role === 'customer') {
      if (order.customer?.userId !== req.user.id) {
        return res.status(403).json({ error: 'You do not have permission to cancel this order' });
      }
    } else if (['owner', 'manager', 'cashier'].includes(req.user.role)) {
      if (req.user.businessId && order.businessId && req.user.businessId !== order.businessId) {
        return res.status(403).json({ error: 'Order does not belong to your business' });
      }
    } else {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    if (['preparing', 'ready', 'delivered'].includes(order.status)) {
      return res.status(400).json({
        error: 'Order preparation has already started. Online cancellation is closed. If you still wish to cancel, please call Tea Bhatti at +91 7000748920 to request it. Please note: No refunds can be provided once preparation has begun.',
        callToCancel: true,
        phone: '+917000748920',
      });
    }

    // Customer cancellation is strictly limited to first 5 minutes of placing order
    if (req.user.role === 'customer') {
      const orderAgeMs = Date.now() - new Date(order.createdAt).getTime();
      const FIVE_MINUTES_MS = 5 * 60 * 1000;
      if (orderAgeMs > FIVE_MINUTES_MS) {
        return res.status(400).json({
          error: 'Orders can only be cancelled within the first 5 minutes of placing. If you need assistance, please call Tea Bhatti at +91 7000748920. No refunds can be provided once preparation has begun.',
          callToCancel: true,
          phone: '+917000748920',
        });
      }
    }

    if (!['received', 'accepted'].includes(order.status)) {
      return res.status(400).json({ error: 'Order can only be cancelled before kitchen preparation starts.' });
    }

    const isStaff = ['owner', 'manager', 'cashier'].includes(req.user.role);
    const cancelledBy = isStaff ? 'admin' : 'customer';
    const refundCode = order.refundCode || `REF-TB-${(order.pickupCode ? order.pickupCode.replace(/^TB-/, '') : order.id.slice(-6)).toUpperCase()}`;
    const hadFullPayment = ['fully_paid', 'paid_online'].includes(order.paymentStatus);
    const refundAmount = hadFullPayment
      ? (order.total || order.advanceAmount || 0)
      : (order.advanceAmount || Math.round(order.total * 0.20));
    const hadPayment = ['verified', 'advance_paid', 'paid_online', 'fully_paid'].includes(order.paymentStatus);

    let refundStatus = hadPayment ? 'pending' : 'none';
    let paymentStatus = hadPayment ? 'refunded' : order.paymentStatus;
    let refundedAt = null;

    if (hadPayment && order.razorpayPaymentId) {
      try {
        const refundResult = await processRazorpayRefund({
          paymentId: order.razorpayPaymentId,
          amount: refundAmount,
          notes: {
            orderId: order.id,
            refundCode,
            cancelledBy,
            reason: `Order cancelled by ${cancelledBy} before preparation`,
          },
        });
        refundStatus = 'refunded';
        refundedAt = new Date();
        console.log(`[Razorpay] Automatic refund processed: ${refundResult.id}`);
      } catch (rErr) {
        console.warn(`[Razorpay] Refund processing warning on cancel: ${rErr.message}`);
        refundStatus = 'pending';
      }
    }

    const updated = await req.prisma.$transaction(async (tx) => {
      const ord = await tx.order.update({
        where: { id: req.params.id },
        data: {
          status: 'cancelled',
          cancelledBy,
          refundCode,
          refundStatus,
          refundAmount: hadPayment ? refundAmount : 0,
          paymentStatus,
          refundedAt,
        },
      });
      await tx.orderStatusLog.create({
        data: { orderId: ord.id, status: hadPayment && refundStatus === 'refunded' ? 'cancelled_refund_processed' : 'cancelled' },
      });
      return ord;
    });

    cancelVerificationFollowUp(updated.id);

    req.io.to(`order:${updated.id}`).emit('order-status-update', {
      orderId: updated.id,
      status: 'cancelled',
      cancelledBy,
      refundCode,
      message: cancelledBy === 'admin'
        ? 'Your order has been cancelled by the admin. A 100% full refund has been initiated to your original payment method (credited within 5-7 working days as per standard banking clearance).'
        : undefined,
      timestamp: new Date(),
    });
    req.io.to(`business:${updated.businessId}`).emit('order-updated', {
      orderId: updated.id,
      status: 'cancelled',
      cancelledBy,
      refundCode,
    });
    invalidateDashboardCache(updated.businessId);

    res.json(updated);
  } catch (err) {
    console.error('Cancel error:', err);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

// ── PATCH /orders/:id/refund-complete — Owner/Staff marks refund as completed ──
router.patch('/:id/refund-complete', authenticate, async (req, res) => {
  try {
    const isStaff = ['owner', 'manager', 'cashier'].includes(req.user.role);
    if (!isStaff) {
      return res.status(403).json({ error: 'Only staff can mark refunds as completed' });
    }

    const order = await req.prisma.order.findUnique({
      where: { id: req.params.id },
      include: { customer: { include: { user: true } }, business: true },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Validate business match if staff has businessId
    if (req.user.businessId && order.businessId && req.user.businessId !== order.businessId) {
      return res.status(403).json({ error: 'Order does not belong to your business' });
    }

    if (order.refundStatus === 'refunded' || order.refundStatus === 'completed') {
      return res.status(400).json({
        error: `Refund is already marked as completed (Reference: ${order.refundCode || 'N/A'}).`,
      });
    }

    const refundAmount = Number(req.body.refundAmount) || order.refundAmount || order.total || order.advanceAmount || 0;
    const refundCode = order.refundCode || `REF-TB-${(order.pickupCode ? order.pickupCode.replace(/^TB-/, '') : order.id.slice(-6)).toUpperCase()}`;
    const now = new Date();

    const updated = await req.prisma.$transaction(async (tx) => {
      const ord = await tx.order.update({
        where: { id: req.params.id },
        data: {
          refundStatus: 'refunded',
          refundAmount,
          refundedAt: now,
          paymentStatus: 'refunded',
          refundCode,
        },
      });
      await tx.orderStatusLog.create({
        data: {
          orderId: ord.id,
          status: `refund_completed_₹${refundAmount}`,
        },
      });
      return ord;
    });

    // Real-time notification to customer room
    req.io.to(`order:${updated.id}`).emit('order-status-update', {
      orderId: updated.id,
      status: updated.status,
      cancelledBy: updated.cancelledBy,
      refundStatus: 'refunded',
      refundAmount,
      refundedAt: now,
      refundCode,
      message: `Your refund of ₹${refundAmount} has been completed! Reference Code: ${refundCode}.`,
      timestamp: now,
    });

    req.io.to(`order:${updated.id}`).emit('payment-update', {
      orderId: updated.id,
      paymentStatus: 'refunded',
      refundStatus: 'refunded',
      refundAmount,
      refundedAt: now,
      status: updated.status,
    });

    // Real-time notification to business room
    req.io.to(`business:${updated.businessId}`).emit('order-updated', {
      orderId: updated.id,
      status: updated.status,
      refundStatus: 'refunded',
      refundAmount,
      refundedAt: now,
      refundCode,
    });

    invalidateDashboardCache(updated.businessId);

    // Send push notification to business if available
    sendPushToBusiness(updated.businessId, {
      title: 'Refund Completed ✅',
      body: `Order #${order.pickupCode || order.id.slice(-4).toUpperCase()} refund of ₹${refundAmount} marked as completed.`,
      icon: '/icons/icon-192x192.png',
      tag: `refund-${updated.id}`,
    }, req.prisma).catch(() => {});

    res.json({
      success: true,
      message: `Refund of ₹${refundAmount} marked as completed successfully.`,
      order: updated,
    });
  } catch (err) {
    console.error('Refund complete error:', err);
    res.status(500).json({ error: 'Failed to mark refund complete' });
  }
});

// ── GET /orders/:id/track — tracking data ──
router.get('/:id/track', optionalAuth, async (req, res) => {
  try {
    const order = await req.prisma.order.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, status: true, orderType: true, createdAt: true,
        businessId: true,
        paymentStatus: true,
        paymentUtr: true,
        paymentRejectReason: true,
        cancelledBy: true,
        refundCode: true,
        refundStatus: true,
        refundAmount: true,
        refundedAt: true,
        customer: { select: { userId: true } },
        statusLogs: { orderBy: { timestamp: 'asc' } },
        deliveryTracking: { orderBy: { updatedAt: 'desc' }, take: 1 },
        business: { select: { name: true, phoneNumber: true } },
      },
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Authorization: if user is authenticated as customer, verify ownership
    if (req.user && req.user.role === 'customer') {
      if (order.customer?.userId !== req.user.id) {
        return res.status(403).json({ error: 'You do not have access to track this order' });
      }
    }

    res.json(order);
  } catch (err) {
    console.error('Track error:', err);
    res.status(500).json({ error: 'Failed to fetch tracking' });
  }
});

// ── POST /orders/:id/payment/utr — customer submits UTR ──
router.post('/:id/payment/utr', authenticate, validate(utrSchema), async (req, res) => {
  try {
    const order = await req.prisma.order.findUnique({
      where: { id: req.params.id },
      include: { customer: { select: { userId: true } } },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Ensure only the customer who placed the order or staff can submit UTR
    if (req.user.role === 'customer' && order.customer?.userId !== req.user.id) {
      return res.status(403).json({ error: 'You do not have access to submit payment for this order' });
    }

    if (!['pending', 'failed', 'rejected', 'utr_submitted'].includes(order.paymentStatus)) {
      return res.status(400).json({ error: 'Payment already verified or completed' });
    }

    const cleanUtr = String(req.body.utr || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (cleanUtr.length < 6 || cleanUtr.length > 30) {
      return res.status(400).json({ error: 'Please enter a valid 12-digit UTR or transaction reference number' });
    }

    // Prevent duplicate UTR submission across verified orders (anti-fraud guard)
    const duplicateUtr = await req.prisma.order.findFirst({
      where: {
        paymentUtr: cleanUtr,
        id: { not: order.id },
        paymentStatus: { in: ['verified', 'advance_paid', 'paid_online', 'fully_paid'] },
      },
    });
    if (duplicateUtr) {
      return res.status(400).json({ error: 'This UTR / Transaction ID has already been recorded for another order.' });
    }

    const updated = await req.prisma.order.update({
      where: { id: req.params.id },
      data: {
        paymentUtr: cleanUtr,
        paymentStatus: 'utr_submitted',
        paymentRejectReason: null,
      },
      include: { customer: { include: { user: true } } },
    });

    await req.prisma.orderStatusLog.create({
      data: { orderId: updated.id, status: 'payment_utr_submitted' },
    });

    // Notify owner room
    req.io.to(`business:${updated.businessId}`).emit('payment-submitted', {
      orderId: updated.id,
      pickupCode: updated.pickupCode,
      utr: cleanUtr,
      total: updated.total,
      advanceAmount: updated.advanceAmount,
      customerName: updated.customer?.user?.name,
      customerPhone: updated.customer?.user?.phone,
    });

    // Web Push alert to owner devices (background service worker push)
    sendPushToBusiness(updated.businessId, {
      title: 'UTR Payment Submitted! 💰',
      body: `Customer ${updated.customer?.user?.name || 'Guest'} submitted UTR #${cleanUtr} for Token #${updated.pickupCode || updated.id.slice(-4).toUpperCase()} (₹${updated.total})`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/favicon.png',
      tag: `utr-${updated.id}`,
      requireInteraction: true,
      data: { url: '/orders', type: 'utr_submitted', orderId: updated.id, pickupCode: updated.pickupCode },
    }, req.prisma).catch(e => console.warn('[Push] Background push error on UTR submit:', e.message));

    // Schedule 10-second follow-up notification if UTR remains unverified
    scheduleVerificationFollowUp(updated.id, updated.businessId, updated.pickupCode, updated.total, req.io, req.prisma);

    // Notify customer order room
    req.io.to(`order:${updated.id}`).emit('payment-update', {
      orderId: updated.id,
      paymentStatus: 'utr_submitted',
      paymentUtr: cleanUtr,
      paymentRejectReason: null,
    });

    // Notify owner room of updated order list
    req.io.to(`business:${updated.businessId}`).emit('order-updated', {
      orderId: updated.id,
      status: updated.status,
      paymentStatus: 'utr_submitted',
    });

    res.json({
      success: true,
      message: 'UTR reference submitted. Verifying transaction...',
      paymentStatus: updated.paymentStatus,
      paymentUtr: updated.paymentUtr,
    });
  } catch (err) {
    console.error('UTR submit error:', err);
    res.status(500).json({ error: 'Failed to submit UTR' });
  }
});

// ── PATCH /orders/:id/payment/verify — owner verifies UTR ──
router.patch('/:id/payment/verify',
  authenticate,
  authorize('owner', 'manager', 'cashier'),
  async (req, res) => {
    try {
      const { action, reason } = req.body; // 'verify' or 'reject'
      const order = await req.prisma.order.findUnique({
        where: { id: req.params.id },
        include: { customer: { include: { user: true } }, business: true },
      });
      if (!order) return res.status(404).json({ error: 'Order not found' });
      if (req.user.businessId && order.businessId && req.user.businessId !== order.businessId) {
        return res.status(403).json({ error: 'Order does not belong to your business' });
      }

      const newPaymentStatus = action === 'verify' ? 'verified' : 'rejected';
      const defaultRejectMsg = 'UTR or reference is incorrect. Please check your UPI app and re-enter the 12-digit UTR.';
      const rejectReason = action === 'reject'
        ? (reason && !reason.includes('rejected by cafe') ? reason : defaultRejectMsg)
        : null;
      // When payment is verified by owner, order automatically advances to accepted
      const newOrderStatus = action === 'verify' && order.status === 'received' ? 'accepted' : order.status;

      const updated = await req.prisma.order.update({
        where: { id: req.params.id },
        data: {
          paymentStatus: newPaymentStatus,
          paymentRejectReason: rejectReason,
          status: newOrderStatus,
          paidAt: action === 'verify' ? new Date() : order.paidAt,
        },
      });

      await req.prisma.orderStatusLog.create({
        data: {
          orderId: updated.id,
          status: action === 'verify' ? 'payment_verified' : 'payment_rejected',
        },
      });

      // Real-time notification to customer
      req.io.to(`order:${updated.id}`).emit('payment-update', {
        orderId: updated.id,
        paymentStatus: newPaymentStatus,
        paymentRejectReason: rejectReason,
        status: updated.status,
      });

      req.io.to(`order:${updated.id}`).emit('order-status-update', {
        orderId: updated.id,
        status: updated.status,
        paymentStatus: newPaymentStatus,
        paymentRejectReason: rejectReason,
        timestamp: new Date(),
      });

      // Real-time notification to owner room
      req.io.to(`business:${updated.businessId}`).emit('order-updated', {
        orderId: updated.id,
        status: updated.status,
        paymentStatus: newPaymentStatus,
        paymentRejectReason: rejectReason,
      });

      req.io.to(`business:${updated.businessId}`).emit('payment-verified', {
        orderId: updated.id,
        pickupCode: order.pickupCode,
        total: order.total,
        action,
        status: updated.status,
        paymentStatus: newPaymentStatus,
        paymentRejectReason: rejectReason,
      });
      invalidateDashboardCache(updated.businessId);

      sendPushToBusiness(updated.businessId, {
        title: action === 'verify' ? 'Payment Verified! ✅' : 'Payment Rejected ❌',
        body: `Order #${order.pickupCode || order.id.slice(-4).toUpperCase()} payment ${action === 'verify' ? 'verified' : 'rejected'} (₹${order.total})`,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/favicon.png',
        tag: `verify-${updated.id}`,
        requireInteraction: true,
        data: { url: '/orders', type: 'payment_verified', orderId: updated.id },
      }, req.prisma).catch(e => console.warn('[Push] Background push error on verify:', e.message));

      // Cancel any pending 10-second follow-up timer since payment is now resolved
      cancelVerificationFollowUp(updated.id);

      res.json({
        success: true,
        message: `Payment ${newPaymentStatus === 'verified' ? 'verified & order accepted' : 'rejected'}`,
        paymentStatus: updated.paymentStatus,
        status: updated.status,
      });
    } catch (err) {
      console.error('Payment verify error:', err);
      res.status(500).json({ error: 'Failed to verify payment' });
    }
  }
);

// ── GET /orders/razorpay/config — Fetch public Razorpay Key ID ──
router.get('/razorpay/config', optionalAuth, (req, res) => {
  const keyId = getRazorpayKeyId();
  res.json({
    keyId: keyId || null,
    isAvailable: Boolean(keyId),
    currency: 'INR',
  });
});

// ── POST /orders/:id/razorpay-order — Create Razorpay Order ──
router.post('/:id/razorpay-order', authenticate, async (req, res) => {
  try {
    const order = await req.prisma.order.findUnique({
      where: { id: req.params.id },
      include: { customer: { include: { user: true } } },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (req.user.role === 'customer' && order.customer?.userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized access to this order' });
    }

    if (['verified', 'advance_paid', 'paid_online', 'fully_paid'].includes(order.paymentStatus)) {
      return res.status(400).json({ error: 'Order payment is already verified and confirmed' });
    }

    const requestedAmount = req.body?.amount ? Number(req.body.amount) : null;
    const payAmount = (requestedAmount && requestedAmount > 0)
      ? requestedAmount
      : (order.advanceAmount && order.advanceAmount > 0 ? order.advanceAmount : Math.round(order.total * 0.20));

    const rzpOrder = await createRazorpayOrder({
      orderId: order.id,
      amount: payAmount,
      pickupCode: order.pickupCode,
      businessId: order.businessId,
      notes: {
        customerName: order.customer?.user?.name || req.user.name,
        customerPhone: order.customer?.user?.phone || req.user.phone || '',
      },
    });

    await req.prisma.order.update({
      where: { id: order.id },
      data: { razorpayOrderId: rzpOrder.id },
    });

    res.json({
      success: true,
      razorpayOrderId: rzpOrder.id,
      amount: rzpOrder.amount, // in paise
      currency: rzpOrder.currency,
      keyId: rzpOrder.keyId,
      orderId: order.id,
      pickupCode: order.pickupCode,
      total: order.total,
    });
  } catch (err) {
    console.error('[Razorpay] Order creation error:', err);
    res.status(500).json({ error: err.message || 'Failed to create Razorpay order' });
  }
});

// ── POST /orders/:id/razorpay-verify — Verify Razorpay Payment Signature ──
router.post('/:id/razorpay-verify', authenticate, async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ error: 'Missing payment signature verification parameters' });
    }

    const isValid = verifyRazorpaySignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    if (!isValid) {
      console.warn(`[Razorpay] Invalid signature detected for order ${req.params.id}`);
      return res.status(400).json({ error: 'Payment signature verification failed' });
    }

    const order = await req.prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        customer: { include: { user: true } },
        items: { include: { menuItem: true } },
        business: true,
      },
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Update order status to verified & advance to accepted
    const newOrderStatus = order.status === 'received' ? 'accepted' : order.status;
    const updated = await req.prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'verified',
        paymentUtr: razorpayPaymentId,
        razorpayPaymentId,
        razorpayOrderId,
        status: newOrderStatus,
        paidAt: new Date(),
        paymentRejectReason: null,
      },
      include: {
        customer: { include: { user: true } },
        items: { include: { menuItem: true } },
        business: true,
      },
    });

    await req.prisma.orderStatusLog.create({
      data: {
        orderId: updated.id,
        status: 'payment_verified_razorpay',
      },
    });

    invalidateDashboardCache(updated.businessId);

    // Notify customer
    req.io.to(`order:${updated.id}`).emit('payment-update', {
      orderId: updated.id,
      paymentStatus: 'verified',
      paymentUtr: razorpayPaymentId,
      status: updated.status,
      pickupCode: updated.pickupCode,
      paidAt: updated.paidAt,
    });

    req.io.to(`order:${updated.id}`).emit('order-status-update', {
      orderId: updated.id,
      status: updated.status,
      paymentStatus: 'verified',
      pickupCode: updated.pickupCode,
      updatedAt: new Date(),
    });

    // Notify owner/dashboard
    req.io.to(`business:${updated.businessId}`).emit('payment-verified', {
      orderId: updated.id,
      pickupCode: updated.pickupCode,
      total: updated.total,
      action: 'verify',
      paymentStatus: 'verified',
      customerName: updated.customer?.user?.name || 'Customer',
    });

    sendPushToBusiness(updated.businessId, {
      title: `✅ Payment Received: #${updated.pickupCode}`,
      body: `Order #${updated.pickupCode} paid ₹${updated.total} via Razorpay. Order accepted!`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/favicon.png',
      tag: `verify-${updated.id}`,
      data: { url: '/orders', type: 'payment_verified', orderId: updated.id },
    }, req.prisma).catch(e => console.warn('[Push] Background push error on razorpay verify:', e.message));

    res.json({
      success: true,
      message: 'Payment verified successfully via Razorpay',
      order: updated,
    });
  } catch (err) {
    console.error('[Razorpay] Payment verification error:', err);
    res.status(500).json({ error: 'Failed to verify Razorpay payment' });
  }
});


// ── GET /orders/:id/receipt — Fetch payment receipt ──
router.get('/:id/receipt', authenticate, async (req, res) => {
  try {
    const order = await req.prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: { include: { menuItem: true } },
        business: true,
        customer: { include: { user: true } },
      },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Access control: customer can only view own receipt; owner/manager can view for their business
    if (req.user.role === 'customer') {
      if (order.customer?.userId !== req.user.id) {
        return res.status(403).json({ error: 'You do not have access to view this receipt' });
      }
    } else if (['owner', 'manager', 'cashier'].includes(req.user.role)) {
      if (req.user.businessId && order.businessId && req.user.businessId !== order.businessId) {
        return res.status(403).json({ error: 'Receipt does not belong to your business' });
      }
    } else {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const advanceAmount = order.advanceAmount || Math.round(order.total * 0.20 * 100) / 100;
    const balanceAmount = order.balanceAmount || Math.round((order.total - advanceAmount) * 100) / 100;

    const receipt = {
      receiptNumber: `REC-TB-${order.id.slice(-6).toUpperCase()}`,
      orderId: order.id,
      pickupCode: order.pickupCode || 'TB-READY',
      createdAt: order.createdAt,
      paidAt: order.paidAt || order.createdAt,
      customerName: order.customer?.user?.name || 'Customer',
      customerPhone: order.customer?.user?.phone || '',
      businessName: order.business?.name || 'Tea Bhatti',
      businessAddress: order.business?.address || 'Near Medical College, Shahdol, MP',
      businessPhone: order.business?.phoneNumber || '+919009149694',
      items: order.items.map(item => ({
        name: item.menuItem?.name || 'Item',
        quantity: item.quantity,
        priceEach: item.priceEach,
        total: item.priceEach * item.quantity,
      })),
      subtotal: order.subtotal,
      discount: order.discount,
      packingCharge: order.packingCharge,
      gst: order.gst,
      total: order.total,
      amountPaidNow: ['advance_paid', 'fully_paid', 'verified'].includes(order.paymentStatus) ? advanceAmount : 0,
      balanceDueAtShop: order.paymentStatus === 'fully_paid' ? 0 : balanceAmount,
      paymentStatus: order.paymentStatus,
      transactionId: order.razorpayPaymentId || order.paymentUtr || 'N/A',
      pickupInstructions: 'Show this receipt / Pickup Code at Tea Bhatti counter. Pay remaining 80% balance when collecting.',
    };

    res.json(receipt);
  } catch (err) {
    console.error('Receipt error:', err);
    res.status(500).json({ error: 'Failed to fetch receipt' });
  }
});

// ── POST /orders/:id/collect-balance — Owner marks balance collected & completes pickup ──
router.post('/:id/collect-balance',
  authenticate,
  authorize('owner', 'manager', 'cashier'),
  async (req, res) => {
    try {
      const order = await req.prisma.order.findUnique({
        where: { id: req.params.id },
        include: { customer: true, business: true },
      });
      if (!order) return res.status(404).json({ error: 'Order not found' });

      const updated = await req.prisma.order.update({
        where: { id: req.params.id },
        data: {
          paymentStatus: 'fully_paid',
          status: 'delivered', // Completed
        },
        include: { customer: { include: { user: true } }, items: { include: { menuItem: true } } },
      });

      await req.prisma.orderStatusLog.create({
        data: { orderId: updated.id, status: 'pickup_completed_balance_collected' },
      });

      // Update customer total orders & spent
      await req.prisma.customer.update({
        where: { id: updated.customerId },
        data: {
          totalOrders: { increment: 1 },
          totalSpent: { increment: updated.total },
          loyaltyPoints: { increment: Math.floor(updated.total / 10) },
          lastOrderAt: new Date(),
        },
      });

      req.io.to(`order:${updated.id}`).emit('order-status-update', {
        orderId: updated.id,
        status: 'delivered',
        paymentStatus: 'fully_paid',
        timestamp: new Date(),
      });
      req.io.to(`business:${updated.businessId}`).emit('order-updated', {
        orderId: updated.id,
        status: 'delivered',
        paymentStatus: 'fully_paid',
      });

      res.json({
        success: true,
        message: `Remaining balance of ₹${order.balanceAmount} collected. Pickup order completed!`,
        order: updated,
      });
    } catch (err) {
      console.error('Collect balance error:', err);
      res.status(500).json({ error: 'Failed to collect balance' });
    }
  }
);

// ── POST /orders/:id/cancel-refund — Cancel order with immediate refund ──
router.post('/:id/cancel-refund', authenticate, async (req, res) => {
  try {
    const order = await req.prisma.order.findUnique({
      where: { id: req.params.id },
      include: { business: true, customer: { select: { userId: true } } },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Access control
    if (req.user.role === 'customer') {
      if (order.customer?.userId !== req.user.id) {
        return res.status(403).json({ error: 'You do not have permission to cancel this order' });
      }
    } else if (['owner', 'manager', 'cashier'].includes(req.user.role)) {
      if (req.user.businessId && order.businessId && req.user.businessId !== order.businessId) {
        return res.status(403).json({ error: 'Order does not belong to your business' });
      }
    } else {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    if (['preparing', 'ready', 'delivered'].includes(order.status)) {
      return res.status(400).json({
        error: 'Order preparation has already started. Online cancellation is closed. If you still wish to cancel, please call Tea Bhatti at +91 7000748920 to request it. Please note: No refunds can be provided once preparation has begun.',
        callToCancel: true,
        phone: '+917000748920',
      });
    }

    // Customer cancellation is strictly limited to first 5 minutes of placing order
    if (req.user.role === 'customer') {
      const orderAgeMs = Date.now() - new Date(order.createdAt).getTime();
      const FIVE_MINUTES_MS = 5 * 60 * 1000;
      if (orderAgeMs > FIVE_MINUTES_MS) {
        return res.status(400).json({
          error: 'Orders can only be cancelled within the first 5 minutes of placing. If you need assistance, please call Tea Bhatti at +91 7000748920. No refunds can be provided once preparation has begun.',
          callToCancel: true,
          phone: '+917000748920',
        });
      }
    }

    if (!['received', 'accepted'].includes(order.status)) {
      return res.status(400).json({ error: 'Order can only be cancelled before kitchen preparation starts.' });
    }

    const hadAdvance = ['advance_paid', 'paid_online', 'verified', 'utr_submitted'].includes(order.paymentStatus);
    const advanceAmount = order.advanceAmount || Math.round(order.total * 0.20 * 100) / 100;
    const refundCode = `REF-TB-${order.id.slice(-6).toUpperCase()}`;

    const isStaff = ['owner', 'manager', 'cashier'].includes(req.user.role);
    const cancelledBy = isStaff ? 'admin' : 'customer';

    let refundResult = null;
    if (hadAdvance && order.razorpayPaymentId) {
      try {
        refundResult = await processRazorpayRefund({
          paymentId: order.razorpayPaymentId,
          amount: advanceAmount,
          notes: {
            orderId: order.id,
            refundCode,
            cancelledBy,
            reason: isStaff ? 'order_cancelled_by_admin' : 'order_cancelled_by_customer',
          },
        });
        console.log(`[Razorpay] Automatic cancel refund processed: ${refundResult.id}`);
      } catch (rErr) {
        console.warn(`[Razorpay] Refund warning on cancel-refund: ${rErr.message}`);
      }
    }

    const updated = await req.prisma.order.update({
      where: { id: req.params.id },
      data: {
        status: 'cancelled',
        cancelledBy,
        refundCode,
        paymentStatus: hadAdvance ? 'refunded' : order.paymentStatus,
        refundStatus: hadAdvance ? 'refunded' : 'none',
        refundAmount: hadAdvance ? advanceAmount : 0,
        refundedAt: hadAdvance ? new Date() : null,
      },
    });

    await req.prisma.orderStatusLog.create({
      data: {
        orderId: updated.id,
        status: hadAdvance ? 'cancelled_refund_processed' : 'cancelled',
      },
    });

    req.io.to(`order:${updated.id}`).emit('order-status-update', {
      orderId: updated.id,
      status: 'cancelled',
      cancelledBy: updated.cancelledBy,
      refundCode: updated.refundCode,
      refundStatus: updated.refundStatus,
      refundAmount: updated.refundAmount,
      message: cancelledBy === 'admin'
        ? 'Your order has been cancelled by the admin. A 100% full refund has been initiated to your original payment method (credited within 5-7 working days as per standard banking clearance).'
        : undefined,
      timestamp: new Date(),
    });
    req.io.to(`business:${updated.businessId}`).emit('order-updated', {
      orderId: updated.id,
      status: 'cancelled',
      cancelledBy: updated.cancelledBy,
      refundCode: updated.refundCode,
      refundStatus: updated.refundStatus,
    });

    res.json({
      success: true,
      message: 'Order has been cancelled.',
      refundCode: updated.refundCode,
      refundStatus: updated.refundStatus,
      refundAmount: updated.refundAmount,
      refundId: refundResult?.refundId || null,
      displayMessage: hadAdvance
        ? `₹${advanceAmount} advance refund has been processed. Reference Code: ${refundCode}. You and Tea Bhatti can track this refund using this code.`
        : 'Order cancelled successfully.',
    });
  } catch (err) {
    console.error('Cancel & refund error:', err);
    res.status(500).json({ error: 'Failed to cancel order and process refund' });
  }
});

// ── POST /orders/:id/refund — Owner initiates order refund ──
router.post('/:id/refund',
  authenticate,
  authorize('owner', 'manager'),
  async (req, res) => {
    try {
      const order = await req.prisma.order.findUnique({
        where: { id: req.params.id },
        include: { business: true, customer: { include: { user: true } } },
      });
      if (!order) return res.status(404).json({ error: 'Order not found' });

      // Duplicate prevention: cannot refund if already refunded
      if (order.refundStatus === 'refunded') {
        return res.status(400).json({
          error: `Order is already refunded (Ref: ${order.refundCode}, Amount: ₹${order.refundAmount}).`,
        });
      }

      // Check payment eligibility
      const isPaid = ['advance_paid', 'fully_paid', 'verified', 'paid_online'].includes(order.paymentStatus);
      if (!isPaid && (!order.paymentUtr || order.paymentStatus === 'failed')) {
        return res.status(400).json({ error: 'No confirmed payment found on this order to refund.' });
      }

      // Max refundable calculation
      const maxRefundable = order.paymentStatus === 'fully_paid' 
        ? order.total 
        : (order.advanceAmount || Math.round(order.total * 0.20));

      const reqAmount = req.body.amount ? Number(req.body.amount) : maxRefundable;
      if (reqAmount <= 0 || reqAmount > maxRefundable) {
        return res.status(400).json({
          error: `Invalid refund amount. Must be between ₹1 and max paid amount ₹${maxRefundable}.`,
        });
      }

      const refundCode = `REF-TB-${order.id.slice(-6).toUpperCase()}`;

      let refundResult = null;
      if (order.razorpayPaymentId) {
        try {
          refundResult = await processRazorpayRefund({
            paymentId: order.razorpayPaymentId,
            amount: reqAmount,
            notes: { orderId: order.id, refundCode, reason: req.body.reason || 'owner_initiated_refund' },
          });
          console.log(`[Razorpay] Refund processed successfully: ${refundResult.id}`);
        } catch (rErr) {
          console.warn(`[Razorpay] Refund API warning: ${rErr.message}`);
        }
      }

      const updated = await req.prisma.order.update({
        where: { id: req.params.id },
        data: {
          status: 'cancelled',
          refundStatus: 'refunded',
          refundAmount: reqAmount,
          refundedAt: new Date(),
          refundCode,
          paymentStatus: 'refunded',
        },
      });

      await req.prisma.orderStatusLog.create({
        data: {
          orderId: updated.id,
          status: `refund_issued_₹${reqAmount}`,
        },
      });

      req.io.to(`order:${updated.id}`).emit('order-status-update', {
        orderId: updated.id,
        status: 'cancelled',
        refundStatus: 'refunded',
        refundAmount: reqAmount,
        refundCode,
        timestamp: new Date(),
      });

      req.io.to(`business:${updated.businessId}`).emit('order-updated', {
        orderId: updated.id,
        status: 'cancelled',
        refundStatus: 'refunded',
        refundAmount: reqAmount,
        refundCode,
      });

      res.json({
        success: true,
        message: `Refund of ₹${reqAmount} initiated successfully.`,
        refundCode,
        refundAmount: reqAmount,
        refundStatus: 'refunded',
        order: updated,
      });
    } catch (err) {
      console.error('Owner refund error:', err);
      res.status(500).json({ error: 'Failed to process refund: ' + err.message });
    }
  }
);

// ── POST /orders/:id/notify-ready-soon — Send Ready notification 10 minutes before finish ──
router.post('/:id/notify-ready-soon',
  authenticate,
  authorize('owner', 'manager', 'cashier'),
  async (req, res) => {
    try {
      const order = await req.prisma.order.findUnique({
        where: { id: req.params.id },
        include: {
          customer: { include: { user: true } },
          business: true,
        },
      });
      if (!order) return res.status(404).json({ error: 'Order not found' });

      const updated = await req.prisma.order.update({
        where: { id: req.params.id },
        data: {
          readySoon: true,
          readySoonAt: new Date(),
        },
      });

      await req.prisma.orderStatusLog.create({
        data: { orderId: order.id, status: 'ready_in_10_minutes' },
      });

      // Socket.io push to customer room
      req.io.to(`order:${order.id}`).emit('order-ready-soon', {
        orderId: order.id,
        pickupCode: order.pickupCode,
        readySoon: true,
        readySoonAt: new Date(),
        message: 'Your order will be fresh & ready in 10 minutes! Please head to Tea Bhatti counter.',
      });

      req.io.to(`business:${order.businessId}`).emit('order-updated', {
        orderId: order.id,
        readySoon: true,
      });

      // WhatsApp alert to customer
      const customerPhone = order.customer?.user?.phone;
      if (customerPhone) {
        sendWhatsAppNotification(
          customerPhone,
          `Tea Bhatti Alert: Your order #${order.pickupCode || order.id.slice(-6)} will be hot & ready in 10 minutes! Please head over to the counter (Near Medical College, Shahdol) to collect it.`
        );
      }

      res.json({
        success: true,
        message: 'Ready notification sent to customer (10 minutes remaining).',
        readySoon: true,
      });
    } catch (err) {
      console.error('Ready notification error:', err);
      res.status(500).json({ error: 'Failed to send ready notification' });
    }
  }
);

// ── GET /orders/:id/qr — Generate dynamic UPI deep links and QR Code ──
router.get('/:id/qr', async (req, res) => {
  try {
    const order = await req.prisma.order.findUnique({
      where: { id: req.params.id },
      include: { business: true },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const business = order.business || {};
    const upiId = business.upiId || 'teabhatti@upi';

    // Exact amount calculation:
    // If pending advance: exact 20% advance amount (strictly integer)
    // If advance paid: exact remaining balance amount (strictly integer)
    let exactAmount = Math.round(order.total);
    let label = 'Full Payment';

    if (order.paymentStatus === 'pending') {
      exactAmount = Math.round(order.advanceAmount || (order.total * 0.20));
      label = '20% Advance Booking';
    } else if (order.paymentStatus === 'advance_paid') {
      const adv = Math.round(order.advanceAmount || (order.total * 0.20));
      exactAmount = Math.round(order.balanceAmount || (order.total - adv));
      label = 'Remaining Balance at Counter';
    }

    const note = `Tea Bhatti ${order.pickupCode || order.id.slice(-6)}`;
    const businessName = business.name || 'Tea Bhatti';

    const encodedUpiId = encodeURIComponent(upiId);
    const encodedName = encodeURIComponent(businessName);
    const formattedAmount = String(exactAmount);
    const encodedNote = encodeURIComponent(note);

    // Standard Universal UPI Deep Link
    const upiUri = `upi://pay?pa=${encodedUpiId}&pn=${encodedName}&am=${formattedAmount}&tn=${encodedNote}&cu=INR`;
    
    // App-specific UPI deep links for direct redirect
    const phonepeUri = `phonepe://pay?pa=${encodedUpiId}&pn=${encodedName}&am=${formattedAmount}&tn=${encodedNote}&cu=INR`;
    const gpayUri = `tez://upi/pay?pa=${encodedUpiId}&pn=${encodedName}&am=${formattedAmount}&tn=${encodedNote}&cu=INR`;
    const paytmUri = `paytmmp://pay?pa=${encodedUpiId}&pn=${encodedName}&am=${formattedAmount}&tn=${encodedNote}&cu=INR`;
    const bhimUri = `bhim://pay?pa=${encodedUpiId}&pn=${encodedName}&am=${formattedAmount}&tn=${encodedNote}&cu=INR`;
    const supermoneyUri = `supermoney://upi/pay?pa=${encodedUpiId}&pn=${encodedName}&am=${formattedAmount}&tn=${encodedNote}&cu=INR`;
    const credUri = `credpay://upi/pay?pa=${encodedUpiId}&pn=${encodedName}&am=${formattedAmount}&tn=${encodedNote}&cu=INR`;

    let qrDataUrl = '';
    try {
      qrDataUrl = await QRCode.toDataURL(upiUri, {
        width: 340,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#2A170A',
          light: '#FFFFFF',
        },
      });
    } catch (qrErr) {
      console.warn('QR Data URL error, generating SVG fallback:', qrErr.message);
    }

    res.json({
      orderId: order.id,
      pickupCode: order.pickupCode,
      businessName,
      upiId,
      exactAmount,
      label,
      upiUri,
      phonepeUri,
      gpayUri,
      paytmUri,
      bhimUri,
      supermoneyUri,
      credUri,
      qrDataUrl,
    });
  } catch (err) {
    console.error('QR generation error:', err);
    res.status(500).json({ error: 'Failed to generate payment QR code' });
  }
});

// ── POST /orders/:id/notify-pickup-soon & /orders/:id/notify-ready-soon — 10-Minute Advance Pickup WhatsApp Alert ──
const handleNotifyPickupSoon = async (req, res) => {
    try {
      const order = await req.prisma.order.findFirst({
        where: { id: req.params.id, businessId: req.businessId },
        include: {
          customer: { include: { user: { select: { phone: true, name: true } } } },
        },
      });

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const customerPhone = order.customer?.user?.phone;
      if (!customerPhone) {
        return res.status(400).json({ error: 'Customer phone number not available' });
      }

      // 1. Send WhatsApp via Baileys
      try {
        await sendPickupSoonAlert(customerPhone, order);
      } catch (waErr) {
        console.warn('Baileys pickup soon notification note:', waErr.message);
      }

      // 2. Real-time push to customer screen
      req.io.to(`order:${order.id}`).emit('order-ready-soon', {
        orderId: order.id,
        minutes: 10,
        message: 'Your order is almost finished! Please head over to the counter in ~10 minutes.',
      });

      res.json({
        success: true,
        message: '10-minute advance pickup notification sent to customer via WhatsApp and app.',
      });
    } catch (err) {
      console.error('Notify pickup soon error:', err);
      res.status(500).json({ error: 'Failed to send pickup notification' });
    }
};

router.post('/:id/notify-pickup-soon', authenticate, authorize('owner', 'manager'), requireBusinessScope, handleNotifyPickupSoon);
router.post('/:id/notify-ready-soon', authenticate, authorize('owner', 'manager'), requireBusinessScope, handleNotifyPickupSoon);

export default router;
