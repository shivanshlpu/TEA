// ── Category Routes ──
// GET /categories, POST /categories

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { requireBusinessScope, businessFromQuery } from '../middleware/businessScope.js';
import cache from '../lib/cache.js';

const router = Router();

const createCategorySchema = z.object({
  name: z.string().min(1),
  sortOrder: z.number().int().min(0).default(0),
});

// ── GET /categories — public, businessId from query (Cached) ──
router.get('/', businessFromQuery, async (req, res) => {
  try {
    const cacheKey = `categories:${req.businessId}`;
    res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=600, stale-while-revalidate=1200');

    const cached = cache.get(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    const categories = await req.prisma.category.findMany({
      where: { businessId: req.businessId },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { menuItems: true } },
      },
    });

    cache.set(cacheKey, categories, 300); // 5 min cache
    res.setHeader('X-Cache', 'MISS');
    res.json(categories);
  } catch (err) {
    console.error('Categories fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// ── POST /categories — owner only ──
router.post('/',
  authenticate,
  authorize('owner', 'manager'),
  requireBusinessScope,
  validate(createCategorySchema),
  async (req, res) => {
    try {
      const category = await req.prisma.category.create({
        data: {
          ...req.body,
          businessId: req.businessId,
        },
      });

      // Invalidate category cache & notify
      cache.del(`categories:${req.businessId}`);
      if (req.io) {
        req.io.to(`business:${req.businessId}`).emit('categories-updated', { businessId: req.businessId });
      }

      res.status(201).json(category);
    } catch (err) {
      console.error('Category create error:', err);
      res.status(500).json({ error: 'Failed to create category' });
    }
  }
);

export default router;
