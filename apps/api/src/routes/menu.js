// ── Menu Routes ──
// GET /menu, GET /menu/:id, POST /menu, PUT /menu/:id, DELETE /menu/:id, PATCH /menu/:id/availability

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { requireBusinessScope, businessFromQuery } from '../middleware/businessScope.js';
import cache from '../lib/cache.js';

const router = Router();

// ── Schemas ──
const createMenuItemSchema = z.object({
  categoryId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID'),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  discountPct: z.number().min(0).max(100).default(0),
  imageUrl: z.string().url().optional(),
  isVeg: z.boolean(),
  isAvailable: z.boolean().default(true),
  addOns: z.array(z.object({
    name: z.string().min(1),
    price: z.number().min(0),
  })).optional(),
});

const updateMenuItemSchema = createMenuItemSchema.partial();

// ── Helper to invalidate menu caches & notify real-time clients ──
function invalidateMenuCache(req, businessId) {
  cache.delPrefix(`menu:${businessId}`);
  if (req.io) {
    req.io.to(`business:${businessId}`).emit('menu-updated', { businessId });
  }
}

// ── GET /menu — public, businessId from query (Cached) ──
router.get('/', businessFromQuery, async (req, res) => {
  try {
    const { categoryId, isVeg, minPrice, maxPrice, sortBy, search, availableOnly } = req.query;

    // Cache key incorporates all query filter permutations
    const cacheKey = `menu:${req.businessId}:${JSON.stringify(req.query)}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    const where = {
      businessId: req.businessId,
    };

    if (availableOnly === 'true') {
      where.isAvailable = true;
    }

    if (categoryId) where.categoryId = categoryId;
    if (req.query.category) {
      where.category = {
        name: { equals: req.query.category, mode: 'insensitive' }
      };
    }
    if (isVeg !== undefined) where.isVeg = isVeg === 'true';
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    // Sort options
    let orderBy = { name: 'asc' };
    if (sortBy === 'price_low') orderBy = { price: 'asc' };
    if (sortBy === 'price_high') orderBy = { price: 'desc' };
    if (sortBy === 'rating') orderBy = { rating: 'desc' };
    if (sortBy === 'name') orderBy = { name: 'asc' };

    const items = await req.prisma.menuItem.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        addOns: true,
      },
      orderBy,
    });

    const responsePayload = { items, total: items.length, businessId: req.businessId };
    cache.set(cacheKey, responsePayload, 180); // 3 min cache

    res.setHeader('X-Cache', 'MISS');
    res.json(responsePayload);
  } catch (err) {
    console.error('Menu fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

// ── GET /menu/:id — public (Cached) ──
router.get('/:id', async (req, res) => {
  try {
    const cacheKey = `menu-item:${req.params.id}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    const item = await req.prisma.menuItem.findUnique({
      where: { id: req.params.id },
      include: {
        category: { select: { id: true, name: true } },
        addOns: true,
      },
    });

    if (!item) return res.status(404).json({ error: 'Menu item not found' });

    cache.set(cacheKey, item, 300);
    res.setHeader('X-Cache', 'MISS');
    res.json(item);
  } catch (err) {
    console.error('Menu item fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch menu item' });
  }
});

// ── POST /menu — owner only ──
router.post('/',
  authenticate,
  authorize('owner', 'manager'),
  requireBusinessScope,
  validate(createMenuItemSchema),
  async (req, res) => {
    try {
      const { addOns, ...itemData } = req.body;

      const item = await req.prisma.menuItem.create({
        data: {
          ...itemData,
          businessId: req.businessId,
          addOns: addOns ? {
            create: addOns.map(a => ({ name: a.name, price: a.price })),
          } : undefined,
        },
        include: { category: true, addOns: true },
      });

      invalidateMenuCache(req, req.businessId);
      res.status(201).json(item);
    } catch (err) {
      console.error('Menu create error:', err);
      res.status(500).json({ error: 'Failed to create menu item' });
    }
  }
);

// ── PUT /menu/:id — owner only ──
router.put('/:id',
  authenticate,
  authorize('owner', 'manager'),
  requireBusinessScope,
  validate(updateMenuItemSchema),
  async (req, res) => {
    try {
      const { addOns, ...itemData } = req.body;

      // Verify item belongs to this business
      const existing = await req.prisma.menuItem.findFirst({
        where: { id: req.params.id, businessId: req.businessId },
      });
      if (!existing) return res.status(404).json({ error: 'Menu item not found' });

      // Update item
      const item = await req.prisma.menuItem.update({
        where: { id: req.params.id },
        data: itemData,
        include: { category: true, addOns: true },
      });

      // Update add-ons if provided (replace strategy)
      if (addOns) {
        await req.prisma.addOn.deleteMany({ where: { menuItemId: item.id } });
        await Promise.all(
          addOns.map(a => req.prisma.addOn.create({
            data: { menuItemId: item.id, name: a.name, price: a.price },
          }))
        );
      }

      const updated = await req.prisma.menuItem.findUnique({
        where: { id: item.id },
        include: { category: true, addOns: true },
      });

      invalidateMenuCache(req, req.businessId);
      cache.del(`menu-item:${item.id}`);
      res.json(updated);
    } catch (err) {
      console.error('Menu update error:', err);
      res.status(500).json({ error: 'Failed to update menu item' });
    }
  }
);

// ── DELETE /menu/:id — owner only ──
router.delete('/:id',
  authenticate,
  authorize('owner', 'manager'),
  requireBusinessScope,
  async (req, res) => {
    try {
      const existing = await req.prisma.menuItem.findFirst({
        where: { id: req.params.id, businessId: req.businessId },
      });
      if (!existing) return res.status(404).json({ error: 'Menu item not found' });

      // Delete add-ons first, then item
      await req.prisma.addOn.deleteMany({ where: { menuItemId: req.params.id } });
      await req.prisma.menuItem.delete({ where: { id: req.params.id } });

      invalidateMenuCache(req, req.businessId);
      cache.del(`menu-item:${req.params.id}`);
      res.json({ message: 'Menu item deleted' });
    } catch (err) {
      console.error('Menu delete error:', err);
      res.status(500).json({ error: 'Failed to delete menu item' });
    }
  }
);

// ── PATCH /menu/:id/availability — quick toggle ──
router.patch('/:id/availability',
  authenticate,
  authorize('owner', 'manager', 'cashier'),
  requireBusinessScope,
  async (req, res) => {
    try {
      const existing = await req.prisma.menuItem.findFirst({
        where: { id: req.params.id, businessId: req.businessId },
      });
      if (!existing) return res.status(404).json({ error: 'Menu item not found' });

      const item = await req.prisma.menuItem.update({
        where: { id: req.params.id },
        data: { isAvailable: !existing.isAvailable },
      });

      invalidateMenuCache(req, req.businessId);
      cache.del(`menu-item:${req.params.id}`);
      res.json({ id: item.id, name: item.name, isAvailable: item.isAvailable });
    } catch (err) {
      console.error('Availability toggle error:', err);
      res.status(500).json({ error: 'Failed to toggle availability' });
    }
  }
);

export default router;
