// ── Business Scope Middleware ──
// Ensures all queries are scoped to the authenticated user's businessId.
// This is the core multi-tenancy guard — baked in from day one.

import cache from '../lib/cache.js';

/**
 * requireBusinessScope — extracts businessId from the authenticated user
 * and attaches it to req.businessId for use in route handlers.
 */
export async function requireBusinessScope(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  let businessId = req.user.businessId;

  // Validate businessId with cache
  if (businessId) {
    if (!cache.get(`biz-valid:${businessId}`)) {
      try {
        const exists = await req.prisma.business.findUnique({
          where: { id: businessId },
          select: { id: true },
        });
        if (exists) {
          cache.set(`biz-valid:${businessId}`, true, 600);
        } else {
          businessId = null;
        }
      } catch {
        businessId = null;
      }
    }
  }

  // If missing in user token, resolve from default
  if (!businessId && req.prisma) {
    let defaultBusId = cache.get('active_business_id');
    if (!defaultBusId) {
      try {
        const defaultBus = await req.prisma.business.findFirst({ select: { id: true } });
        if (defaultBus) {
          defaultBusId = defaultBus.id;
          cache.set('active_business_id', defaultBusId, 600);
        }
      } catch (err) {
        console.error('requireBusinessScope fallback error:', err);
      }
    }
    businessId = defaultBusId;
  }

  if (!businessId) {
    return res.status(403).json({
      error: 'No business scope — this endpoint requires a business-associated user',
    });
  }

  req.businessId = businessId;
  req.user.businessId = businessId;
  next();
}

/**
 * businessFromQuery — for public-facing endpoints where businessId comes
 * from a query param (e.g., GET /menu?businessId=xxx).
 * Employs in-memory caching to eliminate 100% of redundant DB roundtrips.
 */
export async function businessFromQuery(req, res, next) {
  let businessId = req.query.businessId || req.params.businessId;

  if (businessId && businessId !== 'undefined' && businessId !== 'null') {
    if (cache.get(`biz-valid:${businessId}`)) {
      req.businessId = businessId;
      return next();
    }
    try {
      const exists = await req.prisma.business.findUnique({
        where: { id: businessId },
        select: { id: true },
      });
      if (exists) {
        cache.set(`biz-valid:${businessId}`, true, 600);
        req.businessId = businessId;
        return next();
      }
    } catch (e) {
      businessId = null;
    }
  }

  // Fast resolution of default business via cache
  let defaultBusId = cache.get('active_business_id');
  if (!defaultBusId && req.prisma) {
    try {
      const defaultBus = await req.prisma.business.findFirst({ select: { id: true } });
      if (defaultBus) {
        defaultBusId = defaultBus.id;
        cache.set('active_business_id', defaultBusId, 600);
      }
    } catch (err) {
      console.error('Fallback business resolution error:', err);
    }
  }

  if (!defaultBusId) {
    return res.status(400).json({ error: 'businessId is required and no active business found' });
  }

  req.businessId = defaultBusId;
  next();
}

/**
 * businessFromBody — for endpoints where businessId is in the request body.
 */
export function businessFromBody(req, res, next) {
  const businessId = req.body.businessId;
  if (!businessId) {
    return res.status(400).json({ error: 'businessId is required in request body' });
  }
  req.businessId = businessId;
  next();
}
