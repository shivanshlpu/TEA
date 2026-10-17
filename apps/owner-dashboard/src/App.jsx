// ── Owner Dashboard App ──
// Routes: Login → Dashboard / Orders / Menu / Customers / Coupons / Reviews / Settings

import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Sidebar from './components/Sidebar.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import PickupManagement from './pages/PickupManagement.jsx';
import InstallPrompt from './components/InstallPrompt.jsx';

// Lazy-load heavier routes to optimize initial dashboard startup
const Reports = lazy(() => import('./pages/Reports.jsx'));
const Orders = lazy(() => import('./pages/Orders.jsx'));
const MenuManage = lazy(() => import('./pages/MenuManage.jsx'));
const Marketing = lazy(() => import('./pages/Marketing.jsx'));
const Customers = lazy(() => import('./pages/Customers.jsx'));
const Coupons = lazy(() => import('./pages/Coupons.jsx'));
const Reviews = lazy(() => import('./pages/Reviews.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));

function DashboardLoader() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

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
        <Suspense fallback={<DashboardLoader />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pickups" element={<PickupManagement />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/menu" element={<MenuManage />} />
            <Route path="/marketing" element={<Marketing />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/coupons" element={<Coupons />} />
            <Route path="/reviews" element={<Reviews />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

import { ToastProvider } from './context/ToastContext.jsx';
import { NotificationSoundProvider } from './context/NotificationSoundContext.jsx';
import TopNotificationBanner from './components/TopNotificationBanner.jsx';
import PermissionPromptBanner from './components/PermissionPromptBanner.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <NotificationSoundProvider>
            <TopNotificationBanner />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Navigate to="/login" replace />} />
              <Route path="/*" element={<ProtectedLayout />} />
            </Routes>
            <InstallPrompt />
            <PermissionPromptBanner />
          </NotificationSoundProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
