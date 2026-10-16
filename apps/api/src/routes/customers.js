// ── Customer Routes (CRM) ──
// GET /customers — list, GET /customers/me — own profile,
// GET /customers/:id — detail, PATCH /customers/:id — update,
// POST /customers/bulk-message — bulk WhatsApp

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { requireBusinessScope } from '../middleware/businessScope.js';
import { sendWhatsAppBulk } from '../lib/whatsapp.js';

const router = Router();

// ── Schemas ──
const updateCustomerSchema = z.object({
  isPremium: z.boolean().optional(),
  birthday: z.string().datetime().optional(),
  loyaltyPoints: z.number().int().optional(),
});

const bulkMessageSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  customerIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID')).optional(),
  filter: z.enum(['all', 'premium', 'new', 'inactive']).optional(),
});

// ── GET /customers/me — customer's own profile ──
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await req.prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, phone: true, email: true, role: true, businessId: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const customer = await req.prisma.customer.findFirst({
      where: { userId: req.user.id },
      include: {
        business: { select: { name: true } },
      },
    });

    let businessName = 'Tea Bhatti';
    if (user.businessId) {
      const b = await req.prisma.business.findUnique({ where: { id: user.businessId }, select: { name: true } });
      if (b) businessName = b.name;
    } else if (customer?.business?.name) {
      businessName = customer.business.name;
    }

    res.json({
      id: customer?.id || user.id,
      userId: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email || 'N/A',
      role: user.role,
      businessName,
      totalOrders: customer?.totalOrders || 0,
      totalSpent: customer?.totalSpent || 0,
      loyaltyPoints: customer?.loyaltyPoints || 0,
      isPremium: customer?.isPremium || false,
      birthday: customer?.birthday || null,
      lastOrderAt: customer?.lastOrderAt || null,
      referralCode: customer?.referralCode || 'TB-VIP',
    });
  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ── GET /customers — list customers for business (owner/manager) ──
router.get('/',
  authenticate,
  authorize('owner', 'manager'),
  requireBusinessScope,
  async (req, res) => {
    try {
      const { filter, search, page = '1', limit = '20' } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const where = { businessId: req.businessId };
      const now = new Date();

      // Filters
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

      // Search by name or phone
      if (search) {
        where.user = {
          ...where.user,
          OR: [
            { name: { contains: search } },
            { phone: { contains: search } },
          ],
        };
      }

      const [customers, total] = await Promise.all([
        req.prisma.customer.findMany({
          where,
          include: {
            user: { select: { name: true, phone: true, email: true, createdAt: true } },
          },
          orderBy: { totalSpent: 'desc' },
          skip,
          take: parseInt(limit),
        }),
        req.prisma.customer.count({ where }),
      ]);

      res.json({
        customers,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
      });
    } catch (err) {
      console.error('Customers list error:', err);
      res.status(500).json({ error: 'Failed to fetch customers' });
    }
  }
);

// ── GET /customers/:id — customer detail with order history ──
router.get('/:id',
  authenticate,
  authorize('owner', 'manager'),
  requireBusinessScope,
  async (req, res) => {
    try {
      const customer = await req.prisma.customer.findFirst({
        where: { id: req.params.id, businessId: req.businessId },
        include: {
          user: { select: { name: true, phone: true, email: true, createdAt: true } },
          orders: {
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: {
              items: { include: { menuItem: { select: { name: true } } } },
            },
          },
          reviews: {
            include: { order: { select: { id: true, createdAt: true } } },
            orderBy: { order: { createdAt: 'desc' } },
          },
        },
      });

      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      res.json(customer);
    } catch (err) {
      console.error('Customer detail error:', err);
      res.status(500).json({ error: 'Failed to fetch customer details' });
    }
  }
);

// ── PATCH /customers/:id — update customer (mark premium, set birthday, etc.) ──
router.patch('/:id',
  authenticate,
  authorize('owner', 'manager'),
  requireBusinessScope,
  validate(updateCustomerSchema),
  async (req, res) => {
    try {
      const customer = await req.prisma.customer.findFirst({
        where: { id: req.params.id, businessId: req.businessId },
      });

      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      const data = {};
      if (req.body.isPremium !== undefined) data.isPremium = req.body.isPremium;
      if (req.body.birthday) data.birthday = new Date(req.body.birthday);
      if (req.body.loyaltyPoints !== undefined) data.loyaltyPoints = req.body.loyaltyPoints;

      const updated = await req.prisma.customer.update({
        where: { id: req.params.id },
        data,
        include: { user: { select: { name: true, phone: true } } },
      });

      res.json(updated);
    } catch (err) {
      console.error('Customer update error:', err);
      res.status(500).json({ error: 'Failed to update customer' });
    }
  }
);

// ── POST /customers/bulk-message — send WhatsApp to multiple customers ──
router.post('/bulk-message',
  authenticate,
  authorize('owner', 'manager'),
  requireBusinessScope,
  validate(bulkMessageSchema),
  async (req, res) => {
    try {
      const { message, customerIds, filter } = req.body;

      let customers;

      if (customerIds && customerIds.length > 0) {
        // Specific customers
        customers = await req.prisma.customer.findMany({
          where: { id: { in: customerIds }, businessId: req.businessId },
          include: { user: { select: { phone: true } } },
        });
      } else {
        // Filtered customers
        const where = { businessId: req.businessId };
        const now = new Date();

        if (filter === 'premium') where.isPremium = true;
        else if (filter === 'new') {
          const ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          where.user = { createdAt: { gte: ago } };
        } else if (filter === 'inactive') {
          const ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          where.OR = [{ lastOrderAt: null }, { lastOrderAt: { lt: ago } }];
        }

        customers = await req.prisma.customer.findMany({
          where,
          include: { user: { select: { phone: true } } },
        });
      }

      if (customers.length === 0) {
        return res.json({ message: 'No customers matched', sent: 0, failed: 0 });
      }

      const recipients = customers.map((c) => c.user.phone);
      const result = await sendWhatsAppBulk(recipients, message);

      res.json({
        message: 'Bulk message sent',
        totalCustomers: customers.length,
        ...result,
      });
    } catch (err) {
      console.error('Bulk message error:', err);
      res.status(500).json({ error: 'Failed to send bulk messages' });
    }
  }
);

export default router;
