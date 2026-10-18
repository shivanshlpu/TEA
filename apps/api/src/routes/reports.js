// ── Sales & Business Reports Route — Tea Bhatti CafeOS ──
// Comprehensive aggregates for Daily, Weekly, Monthly, Yearly, and Custom Date Ranges.
// Calculates total revenue, orders volume, AOV, advance vs balance breakdown,
// top-selling items, time-series charts, and itemized orders statement.

import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { requireBusinessScope } from '../middleware/businessScope.js';
import cache from '../lib/cache.js';

const router = Router();

// Helper to calculate Indian Standard Time Date Boundaries
function getISTDateRange(range = 'today', customFrom = null, customTo = null) {
  // Current time in IST
  const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  
  let start = new Date(nowIST);
  let end = new Date(nowIST);

  switch (range) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;

    case 'yesterday':
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      break;

    case 'week':
      // Last 7 days
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;

    case 'month':
      // Last 30 days
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;

    case 'year':
      // Start of current calendar year
      start = new Date(nowIST.getFullYear(), 0, 1, 0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;

    case 'custom':
      if (customFrom) {
        start = new Date(customFrom);
        start.setHours(0, 0, 0, 0);
      } else {
        start.setHours(0, 0, 0, 0);
      }
      if (customTo) {
        end = new Date(customTo);
        end.setHours(23, 59, 59, 999);
      } else {
        end.setHours(23, 59, 59, 999);
      }
      break;

    default:
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

// ── GET /reports — Main Business Intelligence Report ──
router.get('/',
  authenticate,
  authorize('owner', 'manager', 'cashier'),
  requireBusinessScope,
  async (req, res) => {
    try {
      const { range = 'today', from, to, status } = req.query;
      const cacheKey = `reports:${req.businessId}:${range}:${from || ''}:${to || ''}:${status || ''}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cached);
      }

      const { start, end } = getISTDateRange(range, from, to);

      const where = {
        businessId: req.businessId,
        createdAt: {
          gte: start,
          lte: end,
        },
      };

      if (status && status !== 'all') {
        where.status = status;
      }

      // Fetch orders in the range (capped to 1,000 to prevent event loop blocking on free tier)
      const orders = await req.prisma.order.findMany({
        where,
        take: 1000,
        include: {
          customer: {
            include: {
              user: {
                select: { name: true, phone: true, email: true },
              },
            },
          },
          items: {
            include: {
              menuItem: {
                select: { name: true, price: true, categoryId: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Calculate Metrics
      const totalOrders = orders.length;
      const deliveredOrders = orders.filter(o => o.status === 'delivered');
      const cancelledOrders = orders.filter(o => o.status === 'cancelled');
      const inProgressOrders = orders.filter(o => ['received', 'accepted', 'preparing', 'ready', 'out_for_delivery'].includes(o.status));
      const validOrders = orders.filter(o => o.status !== 'cancelled');

      // Gross sales for valid orders
      const totalRevenue = validOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      const deliveredRevenue = deliveredOrders.reduce((sum, o) => sum + (o.total || 0), 0);

      // Advance Collected (20%)
      const advanceCollected = orders
        .filter(o => ['advance_paid', 'fully_paid', 'verified'].includes(o.paymentStatus) || ['accepted', 'preparing', 'ready', 'delivered'].includes(o.status))
        .reduce((sum, o) => sum + (o.advanceAmount || Math.round(o.total * 0.2)), 0);

      // Balance Settled (80%)
      const balanceSettled = deliveredOrders.reduce((sum, o) => sum + (o.balanceAmount || Math.round(o.total * 0.8)), 0);
      const balancePending = inProgressOrders.reduce((sum, o) => sum + (o.balanceAmount || Math.round(o.total * 0.8)), 0);

      // Average Order Value
      const averageOrderValue = validOrders.length > 0 ? Math.round(totalRevenue / validOrders.length) : 0;

      // Top Selling Items Aggregation
      const itemMap = {};
      orders.forEach(order => {
        if (order.status === 'cancelled') return;
        (order.items || []).forEach(item => {
          const name = item.menuItem?.name || 'Item';
          if (!itemMap[name]) {
            itemMap[name] = { name, quantity: 0, revenue: 0 };
          }
          itemMap[name].quantity += item.quantity || 1;
          itemMap[name].revenue += (item.priceEach || 0) * (item.quantity || 1);
        });
      });

      const topItems = Object.values(itemMap)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);

      // Time Series (Grouping by day YYYY-MM-DD for charts)
      const dayMap = {};
      orders.forEach(order => {
        const istDate = new Date(order.createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
        if (!dayMap[istDate]) {
          dayMap[istDate] = { date: istDate, orders: 0, revenue: 0, delivered: 0, cancelled: 0 };
        }
        dayMap[istDate].orders += 1;
        if (order.status !== 'cancelled') {
          dayMap[istDate].revenue += order.total || 0;
        }
        if (order.status === 'delivered') {
          dayMap[istDate].delivered += 1;
        } else if (order.status === 'cancelled') {
          dayMap[istDate].cancelled += 1;
        }
      });

      const timeSeries = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));

      // Business info for report branding
      const business = await req.prisma.business.findUnique({
        where: { id: req.businessId },
        select: {
          name: true,
          address: true,
          phoneNumber: true,
          whatsappNumber: true,
          upiId: true,
          gstNumber: true,
        },
      });

      const reportPayload = {
        summary: {
          totalOrders,
          validOrders: validOrders.length,
          deliveredOrders: deliveredOrders.length,
          cancelledOrders: cancelledOrders.length,
          inProgressOrders: inProgressOrders.length,
          totalRevenue,
          deliveredRevenue,
          advanceCollected,
          balanceSettled,
          balancePending,
          averageOrderValue,
        },
        topItems,
        timeSeries,
        dateRange: {
          range,
          from: start.toISOString(),
          to: end.toISOString(),
          label: `${start.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' })} – ${end.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' })}`,
        },
        business: business || { name: 'Tea Bhatti', address: 'Near Medical College, Shahdol, MP' },
        orders: orders.map(o => ({
          id: o.id,
          pickupCode: o.pickupCode || 'TB-' + o.id.slice(-4).toUpperCase(),
          total: o.total,
          advanceAmount: o.advanceAmount || Math.round(o.total * 0.2),
          balanceAmount: o.balanceAmount || Math.round(o.total * 0.8),
          status: o.status,
          paymentStatus: o.paymentStatus,
          paymentUtr: o.paymentUtr,
          createdAt: o.createdAt,
          paidAt: o.paidAt,
          customerName: o.customer?.user?.name || 'Customer',
          customerPhone: o.customer?.user?.phone || '',
          itemsSummary: o.items.map(i => `${i.quantity}x ${i.menuItem?.name || 'Item'}`).join(', '),
          itemsCount: o.items.reduce((s, i) => s + i.quantity, 0),
        })),
        generatedAt: new Date().toISOString(),
      };

      cache.set(cacheKey, reportPayload, 30); // 30s TTL
      res.setHeader('X-Cache', 'MISS');
      res.json(reportPayload);
    } catch (err) {
      console.error('Reports fetch error:', err);
      res.status(500).json({ error: 'Failed to generate report: ' + err.message });
    }
  }
);

export default router;
