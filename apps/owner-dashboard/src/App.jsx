// ── Owner Dashboard App ──
// Routes: Login → Dashboard / Orders / Menu / Customers / Coupons / Reviews / Settings

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Sidebar from './components/Sidebar.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Orders from './pages/Orders.jsx';
import MenuManage from './pages/MenuManage.jsx';
import Customers from './pages/Customers.jsx';
import Coupons from './pages/Coupons.jsx';
import Reviews from './pages/Reviews.jsx';
import Settings from './pages/Settings.jsx';
import PickupManagement from './pages/PickupManagement.jsx';
import Marketing from './pages/Marketing.jsx';
import InstallPrompt from './components/InstallPrompt.jsx';

function ProtectedLayout() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="text-center">
          <img 
            src="/teabhatti-logo.png" 
            alt="Tea Bhatti" 
            className="w-12 h-12 mx-auto mb-3 object-contain rounded-2xl p-1 bg-white border border-border-subtle shadow-sm animate-pulse-warm" 
          />
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-bg-base flex flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 ml-0 md:ml-64 p-3.5 sm:p-5 md:p-8 min-w-0 overflow-x-hidden">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pickups" element={<PickupManagement />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/menu" element={<MenuManage />} />
          <Route path="/marketing" element={<Marketing />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/coupons" element={<Coupons />} />
          <Route path="/reviews" element={<Reviews />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}

import { ToastProvider } from './context/ToastContext.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Navigate to="/login" replace />} />
            <Route path="/*" element={<ProtectedLayout />} />
          </Routes>
          <InstallPrompt />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
