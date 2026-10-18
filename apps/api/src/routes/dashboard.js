// ── Dashboard Routes ──
// GET /dashboard/summary — owner dashboard live counters

import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { requireBusinessScope } from '../middleware/businessScope.js';
import cache from '../lib/cache.js';

const router = Router();

// ── GET /dashboard/summary & /dashboard/stats — today's stats ──
router.get(['/summary', '/stats'],
  authenticate,
  authorize('owner', 'manager'),
  requireBusinessScope,
  async (req, res) => {
    try {
      const cacheKey = `dashboard:${req.businessId}:stats`;
      const cached = cache.get(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cached);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [
        todayOrders,
        pendingCount,
        preparingCount,
        deliveredCount,
        cancelledCount,
        todayRevenue,
        totalCustomers,
      ] = await Promise.all([
        req.prisma.order.count({
          where: { businessId: req.businessId, createdAt: { gte: today } },
        }),
        req.prisma.order.count({
          where: { businessId: req.businessId, status: { in: ['received', 'accepted'] } },
        }),
        req.prisma.order.count({
          where: { businessId: req.businessId, status: 'preparing' },
        }),
        req.prisma.order.count({
          where: {
            businessId: req.businessId,
            status: 'delivered',
            createdAt: { gte: today },
          },
        }),
        req.prisma.order.count({
          where: {
            businessId: req.businessId,
            status: 'cancelled',
            createdAt: { gte: today },
          },
        }),
        req.prisma.order.aggregate({
          where: {
            businessId: req.businessId,
            status: 'delivered',
            createdAt: { gte: today },
          },
          _sum: { total: true },
        }),
        req.prisma.customer.count({
          where: { businessId: req.businessId },
        }),
      ]);

      // Recent orders (last 10)
      const recentOrders = await req.prisma.order.findMany({
        where: { businessId: req.businessId },
        include: {
          items: { include: { menuItem: { select: { name: true } } } },
          customer: { include: { user: { select: { name: true, phone: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      const responsePayload = {
        todayOrders,
        pendingCount,
        preparingCount,
        deliveredCount,
        cancelledCount,
        todayRevenue: todayRevenue._sum.total || 0,
        totalCustomers,
        recentOrders,
      };

      cache.set(cacheKey, responsePayload, 10); // 10s TTL
      res.setHeader('X-Cache', 'MISS');
      res.json(responsePayload);
    } catch (err) {
      console.error('Dashboard error:', err);
      res.status(500).json({ error: 'Failed to fetch dashboard' });
    }
  }
);

export default router;
