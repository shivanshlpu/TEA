// ── JWT Auth Middleware ──
// Verifies JWT access token, extracts role + businessId, attaches to req.user.

import jwt from 'jsonwebtoken';

/**
 * Authenticate — requires a valid JWT in Authorization header.
 * Attaches { id, role, businessId } to req.user.
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      role: decoded.role,
      businessId: decoded.businessId,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Authorize — restricts access to specific roles.
 * Usage: authorize('owner', 'manager')
 */
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: roles,
        current: req.user.role,
      });
    }
    next();
  };
}

/**
 * Optional auth — if token present, decode it; if not, continue without user.
 * Useful for public endpoints that behave differently when logged in (e.g., cart).
 */
export function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = {
        id: decoded.id,
        role: decoded.role,
        businessId: decoded.businessId,
      };
    } catch {
      // Token invalid/expired — proceed without user
    }
  }
  next();
}
