// ── CafeOS Customer Web App ──
// Routes: Home → Menu → Cart → Checkout → Order Tracking
// Integrated with exact Tea Bhatti reference components: Navbar, Footer, MobileNav

import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from './context/CartContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import MobileNav from './components/MobileNav.jsx';
import Home from './pages/Home.jsx';
import Menu from './pages/Menu.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import OrderTracking from './pages/OrderTracking.jsx';
import Login from './pages/Login.jsx';
import MyOrders from './pages/MyOrders.jsx';
import { WelcomeToast } from './components/CelebrationEffects.jsx';
import InstallPrompt from './components/InstallPrompt.jsx';
import { ToastProvider } from './context/ToastContext.jsx';

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
