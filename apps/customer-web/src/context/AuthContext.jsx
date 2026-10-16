// ── Auth Context ──
// Manages JWT tokens, user state, login/logout.

import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem('cafeos_token');
      const savedUser = localStorage.getItem('cafeos_user');
      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      }
    } catch (e) {
      console.warn('Failed to parse cached user session:', e);
      localStorage.removeItem('cafeos_token');
      localStorage.removeItem('cafeos_user');
    } finally {
      setLoading(false);
    }

    const handleRefreshed = (e) => {
      setToken(e.detail);
    };

    const handleExpired = () => {
      setToken(null);
      setUser(null);
    };

    window.addEventListener('auth-token-refreshed', handleRefreshed);
    window.addEventListener('auth-expired', handleExpired);

    return () => {
      window.removeEventListener('auth-token-refreshed', handleRefreshed);
      window.removeEventListener('auth-expired', handleExpired);
    };
  }, []);

  const login = async (phone, password) => {
    const data = await api.login({ phone, password });
    setUser(data.user);
    setToken(data.accessToken);
    localStorage.setItem('cafeos_token', data.accessToken);
    localStorage.setItem('cafeos_refresh', data.refreshToken);
    localStorage.setItem('cafeos_user', JSON.stringify(data.user));
    return data;
  };

  const register = async (userData) => {
    const data = await api.register(userData);
    setUser(data.user);
    setToken(data.accessToken);
    localStorage.setItem('cafeos_token', data.accessToken);
    localStorage.setItem('cafeos_refresh', data.refreshToken);
    localStorage.setItem('cafeos_user', JSON.stringify(data.user));
    return data;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('cafeos_token');
    localStorage.removeItem('cafeos_refresh');
    localStorage.removeItem('cafeos_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
