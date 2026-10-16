import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim();
export const API_BASE = rawApiUrl
  ? (rawApiUrl.endsWith('/api/v1') ? rawApiUrl : `${rawApiUrl.replace(/\/+$/, '')}/api/v1`)
  : '/api/v1';

export const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || '').trim() ||
  (rawApiUrl ? rawApiUrl.replace(/\/api\/v1\/?$/, '') : '') ||
  (typeof window !== 'undefined' ? window.location.origin.replace(/:\d+$/, ':5000') : 'http://localhost:5000');

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setRefreshToken(null);
    localStorage.removeItem('cafeos_owner_token');
    localStorage.removeItem('cafeos_owner_refresh_token');
    localStorage.removeItem('cafeos_owner_user');
  }, []);

  const parseResponse = async (res) => {
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return { error: res.statusText || `Request failed (${res.status})` };
    }
  };

  // Attempt to refresh access token
  const refreshSession = useCallback(async (existingRefreshToken) => {
    const rToken = existingRefreshToken || refreshToken || localStorage.getItem('cafeos_owner_refresh_token');
    if (!rToken) return null;

    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rToken }),
      });
      const data = await parseResponse(res);
      if (!res.ok || !data.accessToken) {
        logout();
        return null;
      }

      setToken(data.accessToken);
      localStorage.setItem('cafeos_owner_token', data.accessToken);
      if (data.refreshToken) {
        setRefreshToken(data.refreshToken);
        localStorage.setItem('cafeos_owner_refresh_token', data.refreshToken);
      }
      return data.accessToken;
    } catch (e) {
      console.warn('Token refresh failed:', e);
      logout();
      return null;
    }
  }, [refreshToken, logout]);

  // Initial session verification & restore
  useEffect(() => {
    async function initAuth() {
      try {
        const savedToken = localStorage.getItem('cafeos_owner_token');
        const savedRefreshToken = localStorage.getItem('cafeos_owner_refresh_token');
        const savedUserStr = localStorage.getItem('cafeos_owner_user');

        if (!savedToken) {
          setLoading(false);
          return;
        }

        let parsedUser = null;
        try {
          if (savedUserStr) parsedUser = JSON.parse(savedUserStr);
        } catch (_) {}

        setToken(savedToken);
        setRefreshToken(savedRefreshToken);
        if (parsedUser) setUser(parsedUser);

        // Verify session live with /auth/me
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { 'Authorization': `Bearer ${savedToken}` },
        });

        if (res.ok) {
          const data = await parseResponse(res);
          if (data.user) {
            setUser(data.user);
            localStorage.setItem('cafeos_owner_user', JSON.stringify(data.user));
          }
          if (data.accessToken) {
            setToken(data.accessToken);
            localStorage.setItem('cafeos_owner_token', data.accessToken);
          }
          if (data.refreshToken) {
            setRefreshToken(data.refreshToken);
            localStorage.setItem('cafeos_owner_refresh_token', data.refreshToken);
          }
        } else if (res.status === 401 && savedRefreshToken) {
          // Token expired — attempt refresh
          const newToken = await refreshSession(savedRefreshToken);
          if (newToken) {
            const meRes = await fetch(`${API_BASE}/auth/me`, {
              headers: { 'Authorization': `Bearer ${newToken}` },
            });
            if (meRes.ok) {
              const meData = await parseResponse(meRes);
              if (meData.user) {
                setUser(meData.user);
                localStorage.setItem('cafeos_owner_user', JSON.stringify(meData.user));
              }
              if (meData.accessToken) {
                setToken(meData.accessToken);
                localStorage.setItem('cafeos_owner_token', meData.accessToken);
              }
              if (meData.refreshToken) {
                setRefreshToken(meData.refreshToken);
                localStorage.setItem('cafeos_owner_refresh_token', meData.refreshToken);
              }
            }
          }
        } else if (res.status === 401) {
          logout();
        }
      } catch (e) {
        console.warn('Auth initialization error:', e);
      } finally {
        setLoading(false);
      }
    }

    initAuth();
  }, [refreshSession, logout]);

  const login = async (phone, password) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    });
    const data = await parseResponse(res);
    if (!res.ok) throw new Error(data.error || 'Login failed');
    if (!['owner', 'manager', 'cashier'].includes(data.user?.role)) {
      throw new Error('Access denied — owner/manager account required');
    }
    setUser(data.user);
    setToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    localStorage.setItem('cafeos_owner_token', data.accessToken);
    if (data.refreshToken) {
      localStorage.setItem('cafeos_owner_refresh_token', data.refreshToken);
    }
    localStorage.setItem('cafeos_owner_user', JSON.stringify(data.user));
    return data;
  };

  const registerOwner = async (payload) => {
    const res = await fetch(`${API_BASE}/auth/register-owner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res);
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    setUser(data.user);
    setToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    localStorage.setItem('cafeos_owner_token', data.accessToken);
    if (data.refreshToken) {
      localStorage.setItem('cafeos_owner_refresh_token', data.refreshToken);
    }
    localStorage.setItem('cafeos_owner_user', JSON.stringify(data.user));
    return data;
  };

  // Resilient API helper with auto-token refresh & auth error handling
  const apiFetch = async (endpoint, options = {}) => {
    const { method = 'GET', body } = options;
    const currentToken = token || localStorage.getItem('cafeos_owner_token');
    const headers = { 'Content-Type': 'application/json' };
    if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;
    const config = { method, headers };
    if (body) config.body = JSON.stringify(body);

    let res = await fetch(`${API_BASE}${endpoint}`, config);

    // If 401 Unauthorized, attempt a single token refresh
    if (res.status === 401) {
      const newToken = await refreshSession();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        config.headers = headers;
        res = await fetch(`${API_BASE}${endpoint}`, config);
      } else {
        logout();
        throw new Error('Session expired. Please log in again.');
      }
    }

    const data = await parseResponse(res);
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      registerOwner,
      logout,
      isAuthenticated: !!token,
      apiFetch,
      refreshSession,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
