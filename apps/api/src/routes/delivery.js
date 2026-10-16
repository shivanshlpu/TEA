// ── Delivery Routes ──
// GET /delivery/assigned, PATCH /delivery/:orderId/location, 
// PATCH /delivery/:orderId/complete, GET /delivery/:orderId/route, 
// POST /delivery/assign (owner)

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { requireBusinessScope } from '../middleware/businessScope.js';

const router = Router();

// ── Schemas ──
const locationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

const assignSchema = z.object({
  orderId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID'),
  deliveryPartnerId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID'),
});

// Helper for access check
async function canAccessOrderForDelivery(req, orderId) {
  const order = await req.prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, businessId: true, deliveryPartnerId: true, status: true, total: true, customerId: true, deliveryAddress: true, customer: { select: { user: { select: { phone: true, name: true } } } }, business: { select: { address: true, name: true } } }
  });
  if (!order) return { error: 'Order not found', order: null };

  const isOwner = ['owner', 'manager', 'cashier'].includes(req.user.role) && (!req.user.businessId || order.businessId === req.user.businessId);
  const isPartner = req.user.role === 'delivery_partner' && (!order.deliveryPartnerId || order.deliveryPartnerId === req.user.id);

  if (!isOwner && !isPartner) {
    return { error: 'Not authorized for this order', order: null };
  }

  // Auto-assign delivery partner if unassigned
  if (req.user.role === 'delivery_partner' && !order.deliveryPartnerId) {
    await req.prisma.order.update({
      where: { id: orderId },
      data: { deliveryPartnerId: req.user.id },
    });
    order.deliveryPartnerId = req.user.id;
  }

  return { error: null, order };
}

// ── GET /delivery/assigned — Delivery Partner & Staff ──
// Lists active delivery orders (ready or out_for_delivery)
router.get('/assigned', authenticate, authorize('delivery_partner', 'owner', 'manager', 'cashier'), async (req, res) => {
  try {
    const where = {
      orderType: 'delivery',
      status: { in: ['ready', 'out_for_delivery'] },
    };

    if (req.user.businessId) {
      where.businessId = req.user.businessId;
    }

    if (req.user.role === 'delivery_partner') {
      where.OR = [
        { deliveryPartnerId: req.user.id },
        { deliveryPartnerId: null },
      ];
    }

    const orders = await req.prisma.order.findMany({
      where,
      include: {
        business: { select: { name: true, address: true, phoneNumber: true } },
        customer: { include: { user: { select: { name: true, phone: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(orders);
  } catch (err) {
    console.error('Assigned orders fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch assigned orders' });
  }
});

// ── PATCH /delivery/:orderId/location — Delivery Partner or Owner ──
// Updates the live tracking location
router.patch('/:orderId/location', authenticate, authorize('delivery_partner', 'owner', 'manager'), validate(locationSchema), async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const { orderId } = req.params;

    const { error, order } = await canAccessOrderForDelivery(req, orderId);
    if (error) return res.status(403).json({ error });

    const tracking = await req.prisma.deliveryTracking.create({
      data: {
        orderId,
        latitude: lat,
        longitude: lng,
      },
    });

    // Emit live location update to the order's Socket.io room (for the customer)
    req.io.to(`order:${orderId}`).emit('delivery-location-update', {
      orderId,
      lat,
      lng,
      updatedAt: tracking.updatedAt,
    });

    res.json({ message: 'Location updated', tracking });
  } catch (err) {
    console.error('Location update error:', err);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// ── PATCH /delivery/:orderId/complete — Delivery Partner or Owner ──
// Marks the order as delivered
router.patch('/:orderId/complete', authenticate, authorize('delivery_partner', 'owner', 'manager'), async (req, res) => {
  try {
    const { orderId } = req.params;

    const { error, order } = await canAccessOrderForDelivery(req, orderId);
    if (error) return res.status(403).json({ error });

    if (!['ready', 'out_for_delivery'].includes(order.status)) return res.status(400).json({ error: 'Order must be ready or out for delivery' });

    const updated = await req.prisma.$transaction(async (tx) => {
      const ord = await tx.order.update({
        where: { id: orderId },
        data: { status: 'delivered' },
      });

      await tx.orderStatusLog.create({
        data: { orderId: ord.id, status: 'delivered' },
      });

      // Update customer stats
      await tx.customer.update({
        where: { id: ord.customerId },
        data: {
          totalOrders: { increment: 1 },
          totalSpent: { increment: ord.total },
          loyaltyPoints: { increment: Math.floor(ord.total / 10) },
          lastOrderAt: new Date(),
        },
      });

      return ord;
    }, { maxWait: 10000, timeout: 20000 });

    // Push socket events
    req.io.to(`order:${updated.id}`).emit('order-status-update', {
      orderId: updated.id,
      status: 'delivered',
      timestamp: new Date(),
    });
    
    req.io.to(`business:${updated.businessId}`).emit('order-updated', {
      orderId: updated.id,
      status: 'delivered',
    });

    res.json({ message: 'Order marked as delivered', order: updated });
  } catch (err) {
    console.error('Order complete error:', err);
    res.status(500).json({ error: 'Failed to complete delivery' });
  }
});

// ── GET /delivery/:orderId/route — Delivery Partner or Owner ──
// Gets the route info (customer address)
router.get('/:orderId/route', authenticate, authorize('delivery_partner', 'owner', 'manager'), async (req, res) => {
  try {
    const { orderId } = req.params;

    const { error, order } = await canAccessOrderForDelivery(req, orderId);
    if (error) return res.status(403).json({ error });

    res.json(order);
  } catch (err) {
    console.error('Route fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch route' });
  }
});

// ── POST /delivery/assign — Owner/Manager only ──
router.post('/assign', authenticate, authorize('owner', 'manager'), requireBusinessScope, validate(assignSchema), async (req, res) => {
  try {
    const { orderId, deliveryPartnerId } = req.body;

    const order = await req.prisma.order.findFirst({
      where: { id: orderId, businessId: req.businessId },
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.orderType !== 'delivery') return res.status(400).json({ error: 'Order is not a delivery order' });

    // Validate delivery partner exists and is a delivery partner for this business
    // For simplicity, we just check if the user is a delivery_partner
    const partner = await req.prisma.user.findFirst({
      where: { id: deliveryPartnerId, role: 'delivery_partner', businessId: req.businessId }
    });

    if (!partner) return res.status(400).json({ error: 'Invalid delivery partner' });

    const updated = await req.prisma.order.update({
      where: { id: orderId },
      data: { deliveryPartnerId },
    });

    res.json({ message: 'Order assigned to delivery partner', order: updated });
  } catch (err) {
    console.error('Assign partner error:', err);
    res.status(500).json({ error: 'Failed to assign delivery partner' });
  }
});

export default router;
