// ── API Helper ──
const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim();
function normalizeApiBase(url) {
  if (!url) return '/api/v1';
  const clean = url.replace(/\/+$/, '');
  if (clean.endsWith('/api/v1')) return clean;
  if (clean.endsWith('/api')) return `${clean}/v1`;
  return `${clean}/api/v1`;
}
export const API_BASE = normalizeApiBase(rawApiUrl);

export const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || '').trim() ||
  (rawApiUrl ? rawApiUrl.replace(/\/api(\/v1)?\/?$/, '') : '') ||
  (typeof window !== 'undefined' ? window.location.origin.replace(/:\d+$/, ':5000') : 'http://localhost:5000');

let isRefreshing = false;
let refreshQueue = [];

async function request(endpoint, options = {}, isRetry = false) {
  let { method = 'GET', body, token } = options;

  // Fallback to token stored in localStorage if not explicitly passed
  if (!token && typeof window !== 'undefined') {
    token = localStorage.getItem('cafeos_token') || undefined;
  }

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const config = { method, headers };
  if (body) config.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${endpoint}`, config);
  
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    data = { error: res.statusText || `Request failed with status ${res.status}` };
  }

  // Handle Token Expiration with Automatic Refresh
  if (res.status === 401 && (data.error === 'Token expired' || data.code === 'TOKEN_EXPIRED' || data.error === 'Invalid token') && !isRetry) {
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('cafeos_refresh') : null;
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        const refreshData = await refreshRes.json();
        if (refreshRes.ok && refreshData.accessToken) {
          localStorage.setItem('cafeos_token', refreshData.accessToken);
          if (refreshData.refreshToken) {
            localStorage.setItem('cafeos_refresh', refreshData.refreshToken);
          }
          window.dispatchEvent(new CustomEvent('auth-token-refreshed', { detail: refreshData.accessToken }));
          // Retry original request with the refreshed access token
          return request(endpoint, { ...options, token: refreshData.accessToken }, true);
        }
      } catch (refreshErr) {
        console.warn('Auto refresh failed:', refreshErr);
      }
    }

    // Refresh impossible or failed: clean up stale tokens
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cafeos_token');
      localStorage.removeItem('cafeos_refresh');
      localStorage.removeItem('cafeos_user');
      window.dispatchEvent(new Event('auth-expired'));
    }
    throw new Error('Your session has expired. Please log in again to continue.');
  }

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data;
}

// ── Client-Side SWR Cache (Memory + LocalStorage for 0ms Instant Startup) ──
const swrCache = new Map();

function getCached(key) {
  if (swrCache.has(key)) return swrCache.get(key);
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(`cafeos_swr_${key}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        swrCache.set(key, parsed);
        return parsed;
      }
    } catch (_) {}
  }
  return null;
}

function setCached(key, data) {
  swrCache.set(key, data);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`cafeos_swr_${key}`, JSON.stringify(data));
    } catch (_) {}
  }
}

export const api = {
  // Auth
  login: (body) => request('/auth/login', { method: 'POST', body }),
  register: (body) => request('/auth/register', { method: 'POST', body }),
  refresh: (body) => request('/auth/refresh', { method: 'POST', body }),

  // Business Config (SWR: 0ms Instant Startup from Cache + Background Revalidate)
  getDefaultBusiness: async () => {
    const cached = getCached('default_business');
    const fetchPromise = request('/settings/default-business')
      .then((data) => {
        if (data && data.id) setCached('default_business', data);
        return data;
      })
      .catch((err) => {
        if (cached) return cached;
        throw err;
      });

    // If cached, return immediately to unblock rendering, background fetch updates cache
    return cached || fetchPromise;
  },

  // Menu (SWR: 0ms Instant Catalog Display)
  getMenu: async (businessId, params = '') => {
    const cacheKey = `menu_${businessId || 'default'}_${params}`;
    const cached = getCached(cacheKey);

    const q = [];
    if (businessId && businessId !== 'undefined' && businessId !== 'null') {
      q.push(`businessId=${encodeURIComponent(businessId)}`);
    }
    if (params) {
      const cleanParams = params.replace(/^[&?]/, '');
      if (cleanParams) q.push(cleanParams);
    }
    const queryStr = q.length > 0 ? `?${q.join('&')}` : '';

    const fetchPromise = request(`/menu${queryStr}`)
      .then((data) => {
        if (data) setCached(cacheKey, data);
        return data;
      })
      .catch((err) => {
        if (cached) return cached;
        throw err;
      });

    return cached || fetchPromise;
  },

  getMenuItem: (id) => request(`/menu/${id}`),

  // Categories (SWR: 0ms Category Row Display)
  getCategories: async (businessId) => {
    const cacheKey = `categories_${businessId || 'default'}`;
    const cached = getCached(cacheKey);

    const query = (businessId && businessId !== 'undefined' && businessId !== 'null')
      ? `?businessId=${encodeURIComponent(businessId)}`
      : '';

    const fetchPromise = request(`/categories${query}`)
      .then((data) => {
        if (data) setCached(cacheKey, data);
        return data;
      })
      .catch((err) => {
        if (cached) return cached;
        throw err;
      });

    return cached || fetchPromise;
  },

  // Cart
  computeCart: (body) => request('/cart/compute', { method: 'POST', body }),

  // Orders
  createOrder: (body, token) => request('/orders', { method: 'POST', body, token }),
  getOrder: (id, token) => request(`/orders/${id}`, { token }),
  getOrders: (params, token) => request(`/orders?${params}`, { token }),
  cancelOrder: (id, token) => request(`/orders/${id}/cancel`, { method: 'PATCH', token }),
  cancelAndRefund: (id, token) => request(`/orders/${id}/cancel-refund`, { method: 'POST', token }),
  submitUtr: (id, body, token) => request(`/orders/${id}/payment/utr`, { method: 'POST', body, token }),
  trackOrder: (id) => request(`/orders/${id}/track`),
  createStripeIntent: (orderId, token) => request(`/orders/${orderId}/stripe-intent`, { method: 'POST', token }),
  confirmStripePayment: (orderId, body, token) => request(`/orders/${orderId}/stripe-confirm`, { method: 'POST', body, token }),
  getRazorpayConfig: () => request('/razorpay/config'),
  createRazorpayOrder: (orderId, token) => request(`/orders/${orderId}/razorpay-order`, { method: 'POST', token }),
  verifyRazorpayPayment: (orderId, body, token) => request(`/orders/${orderId}/razorpay-verify`, { method: 'POST', body, token }),
  createStandardOrder: (body) => request('/create-order', { method: 'POST', body }),
  verifyStandardPayment: (body) => request('/verify-payment', { method: 'POST', body }),
  getOrderReceipt: (orderId, token) => request(`/orders/${orderId}/receipt`, { token }),
  getOrderQr: (orderId, type) => request(`/orders/${orderId}/qr${type ? `?type=${type}` : ''}`),

  // Customer Profile
  getProfile: (token) => request('/customers/me', { token }),

  // Reviews
  submitReview: (body, token) => request('/reviews', { method: 'POST', body, token }),
  checkReview: (orderId, token) => request(`/reviews/check/${orderId}`, { token }),

  // Coupons
  validateCoupon: (body) => request('/coupons/validate', { method: 'POST', body }),
  getActiveCoupon: (businessId = '') => request(`/coupons/active${businessId ? `?businessId=${businessId}` : ''}`),
};

export default api;
