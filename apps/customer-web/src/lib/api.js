// ── API Helper ──
const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim();
export const API_BASE = rawApiUrl
  ? (rawApiUrl.endsWith('/api/v1') ? rawApiUrl : `${rawApiUrl.replace(/\/+$/, '')}/api/v1`)
  : '/api/v1';

export const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || '').trim() ||
  (rawApiUrl ? rawApiUrl.replace(/\/api\/v1\/?$/, '') : '') ||
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

export const api = {
  // Auth
  login: (body) => request('/auth/login', { method: 'POST', body }),
  register: (body) => request('/auth/register', { method: 'POST', body }),
  refresh: (body) => request('/auth/refresh', { method: 'POST', body }),

  // Business Config
  getDefaultBusiness: () => request('/settings/default-business'),

  // Menu (public)
  getMenu: (businessId, params = '') => request(`/menu?businessId=${businessId}${params}`),
  getMenuItem: (id) => request(`/menu/${id}`),
  getCategories: (businessId) => request(`/categories?businessId=${businessId}`),

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
  getOrderReceipt: (orderId, token) => request(`/orders/${orderId}/receipt`, { token }),
  getOrderQr: (orderId) => request(`/orders/${orderId}/qr`),

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
