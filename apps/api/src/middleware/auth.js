// ── JWT Auth Middleware ──
// Verifies JWT access token, extracts role + businessId, attaches to req.user.

import jwt from 'jsonwebtoken';

// In-memory token revocation blacklist with auto-pruning
const revokedTokens = new Map(); // token -> expMs

export function revokeToken(token) {
  if (!token) return;
  try {
    const decoded = jwt.decode(token);
    const expMs = decoded?.exp ? decoded.exp * 1000 : Date.now() + 7 * 24 * 60 * 60 * 1000;
    revokedTokens.set(token, expMs);
  } catch (_) {
    revokedTokens.set(token, Date.now() + 7 * 24 * 60 * 60 * 1000);
  }
}

export function isTokenRevoked(token) {
  return revokedTokens.has(token);
}

// Prune expired blacklist entries every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [t, expMs] of revokedTokens.entries()) {
    if (now > expMs) revokedTokens.delete(t);
  }
}, 15 * 60 * 1000);

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
  if (isTokenRevoked(token)) {
    return res.status(401).json({ error: 'Token has been revoked upon logout', code: 'TOKEN_REVOKED' });
  }

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
