// ── CafeOS Customer Web App ──
// Routes: Home → Menu → Cart → Checkout → Order Tracking
// Integrated with exact Tea Bhatti reference components: Navbar, Footer, MobileNav

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from './context/CartContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import MobileNav from './components/MobileNav.jsx';
import Home from './pages/Home.jsx';
import { WelcomeToast } from './components/CelebrationEffects.jsx';
import InstallPrompt from './components/InstallPrompt.jsx';
import { ToastProvider } from './context/ToastContext.jsx';

// Route-level code splitting for non-critical pages (Swiggy-style progressive load)
const Menu = lazy(() => import('./pages/Menu.jsx'));
const Cart = lazy(() => import('./pages/Cart.jsx'));
const Checkout = lazy(() => import('./pages/Checkout.jsx'));
const OrderTracking = lazy(() => import('./pages/OrderTracking.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const MyOrders = lazy(() => import('./pages/MyOrders.jsx'));

function PageLoader() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="w-8 h-8 border-3 border-[#E94B18] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  const [welcomeUser, setWelcomeUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem('welcome_celebration');
      if (saved) {
        sessionStorage.removeItem('welcome_celebration');
        return saved;
      }
    } catch (_) {}
    return null;
  });

  useEffect(() => {
    const handler = (e) => {
      setWelcomeUser(e.detail || 'Valued Customer');
    };
    window.addEventListener('welcome-user', handler);
    return () => window.removeEventListener('welcome-user', handler);
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <CartProvider>
            <div className="min-h-screen bg-[#FFFDF9] flex flex-col justify-between selection:bg-[#E94B18]/20 pb-16 md:pb-0">
              <Navbar />
              <main className="flex-1">
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/menu" element={<Menu />} />
                    <Route path="/cart" element={<Cart />} />
                    <Route path="/checkout" element={<Checkout />} />
                    <Route path="/order/:orderId" element={<OrderTracking />} />
                    <Route path="/orders" element={<MyOrders />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Login defaultRegister={true} />} />
                    <Route path="/register" element={<Login defaultRegister={true} />} />
                  </Routes>
                </Suspense>
              </main>
              <Footer />
              <MobileNav />

              {/* PWA App Installation Prompt Popup */}
              <InstallPrompt />

              {/* Cool Welcome Party Popper Animation */}
              {welcomeUser && (
                <WelcomeToast 
                  userName={welcomeUser} 
                  onClose={() => setWelcomeUser(null)} 
                />
              )}
            </div>
          </CartProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
