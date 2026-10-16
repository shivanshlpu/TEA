// ── Review Routes ──
// POST /reviews — create review, GET /reviews — list reviews

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { requireBusinessScope } from '../middleware/businessScope.js';

const router = Router();

// ── Schemas ──
const createReviewSchema = z.object({
  orderId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID'),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

// ── POST /reviews — customer submits a review ──
router.post('/', authenticate, validate(createReviewSchema), async (req, res) => {
  try {
    const { orderId, rating, comment } = req.body;

    // Find the order and verify ownership
    const order = await req.prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'delivered') return res.status(400).json({ error: 'Can only review delivered orders' });
    if (order.customer.userId !== req.user.id) return res.status(403).json({ error: 'Not your order' });

    // Check if already reviewed
    const existing = await req.prisma.review.findUnique({ where: { orderId } });
    if (existing) return res.status(409).json({ error: 'Order already reviewed' });

    const review = await req.prisma.review.create({
      data: {
        orderId,
        customerId: order.customerId,
        rating,
        comment: comment || null,
      },
    });

    // Update menu item average ratings (simplified: average across all reviews for items in this order)
    const orderItems = await req.prisma.orderItem.findMany({
      where: { orderId },
      select: { menuItemId: true },
    });

    for (const item of orderItems) {
      const reviews = await req.prisma.review.findMany({
        where: {
          order: { items: { some: { menuItemId: item.menuItemId } } },
        },
        select: { rating: true },
      });
      const avgRating = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
      await req.prisma.menuItem.update({
        where: { id: item.menuItemId },
        data: { rating: Math.round(avgRating * 10) / 10 },
      });
    }

    res.status(201).json(review);
  } catch (err) {
    console.error('Review create error:', err);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// ── GET /reviews — list reviews (filterable by businessId) ──
router.get('/', async (req, res) => {
  try {
    const { businessId, page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (businessId) {
      where.order = { businessId };
    }

    const [reviews, total] = await Promise.all([
      req.prisma.review.findMany({
        where,
        include: {
          customer: {
            include: { user: { select: { name: true } } },
          },
          order: {
            select: {
              id: true,
              createdAt: true,
              total: true,
              items: { include: { menuItem: { select: { name: true } } } },
            },
          },
        },
        orderBy: { order: { createdAt: 'desc' } },
        skip,
        take: parseInt(limit),
      }),
      req.prisma.review.count({ where }),
    ]);

    // Compute average rating
    const allRatings = await req.prisma.review.findMany({
      where,
      select: { rating: true },
    });
    const avgRating = allRatings.length > 0
      ? Math.round((allRatings.reduce((s, r) => s + r.rating, 0) / allRatings.length) * 10) / 10
      : 0;

    res.json({
      reviews,
      total,
      avgRating,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    console.error('Reviews list error:', err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// ── GET /reviews/check/:orderId — check if an order has been reviewed ──
router.get('/check/:orderId', authenticate, async (req, res) => {
  try {
    const review = await req.prisma.review.findUnique({
      where: { orderId: req.params.orderId },
    });
    res.json({ reviewed: !!review, review: review || null });
  } catch (err) {
    console.error('Review check error:', err);
    res.status(500).json({ error: 'Failed to check review status' });
  }
});

export default router;
