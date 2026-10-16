// ── Navbar — Tea Bhatti ──
// High-contrast navigation links with soft background pills,
// Profile details modal trigger on user name,
// Interactive Google Maps modal for "Tea Bhatti, Near Medical College, Shahdol"

import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  ShoppingCart, 
  User, 
  Menu, 
  X, 
  MapPin, 
  ChevronDown, 
  LogOut, 
  Navigation, 
  ExternalLink,
  Clock,
  Phone,
  UserCheck,
  MessageCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import ProfileModal from './ProfileModal.jsx';

// Exact Google Maps location query for Tea Bhatti Shahdol near Medical College
const MAPS_URL = "https://www.google.com/maps/search/?api=1&query=Tea+Bhatti+Cafe+Near+Medical+College+Road+Shahdol+Madhya+Pradesh+484001";
const MAPS_EMBED_URL = "https://maps.google.com/maps?q=Tea%20Bhatti%20Cafe%20Near%20Medical%20College%20Road%20Shahdol%20Madhya%20Pradesh%20484001&t=&z=15&ie=UTF8&iwloc=&output=embed";

export default function Navbar() {
  const { itemCount } = useCart();
  const { isAuthenticated, user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userDropdown, setUserDropdown] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
    setUserDropdown(false);
  }, [location.pathname]);

  // Handle scroll detection for background glass effect
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 15) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/menu', label: 'Menu' },
    { to: '/orders', label: 'My Orders' },
  ];

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const displayName = user?.name || 'Shivansh Tiwari';
  const isHome = location.pathname === '/';

  return (
    <>
      <nav 
        className={`${
          isHome && !scrolled
            ? 'absolute top-0 left-0 right-0 z-40 bg-gradient-to-b from-white/70 via-white/30 to-transparent backdrop-blur-[2px] border-b border-black/5'
            : 'sticky top-0 z-40 bg-[#FFFDF9]/95 backdrop-blur-md border-b border-[#EFE5D8]/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)]'
        } transition-all duration-300`}
      >
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-[64px]">
            
            {/* Left: Brand Identity */}
            <Link to="/" className="flex items-center gap-2.5 group shrink-0">
              <div className="w-[38px] h-[38px] bg-black rounded-lg flex items-center justify-center p-1 shadow-sm overflow-hidden">
                <img
                  src="/assets/logo.png"
                  alt="Tea Bhatti Cafe"
                  className="w-full h-full object-contain"
                  onError={(e) => { e.target.src = '/teabhatti-logo.png'; }}
                />
              </div>
              <div className="flex flex-col justify-center">
                <span className="text-[19px] sm:text-[20px] font-heading font-black text-[#203B2C] leading-none tracking-tight drop-shadow-2xs">
                  Tea Bhatti Cafe
                </span>
              </div>
            </Link>

            {/* Center: High-Contrast Navigation Links with Frosted Capsule */}
            <div className="hidden md:flex items-center gap-1.5 bg-white/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#E9DFD0]/80 shadow-xs">
              {navLinks.map((link) => {
                const active = isActive(link.to);
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`text-[13px] font-bold px-3.5 py-1 rounded-full transition-all duration-200 relative ${
                      active
                        ? 'bg-[#E94B18] text-white shadow-xs'
                        : 'text-[#203B2C] hover:text-[#E94B18] hover:bg-[#F8F3E9]'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>

            {/* Right: Interactive Pickup Location, Cart, User Profile */}
            <div className="flex items-center gap-2.5 sm:gap-3.5">
              
              {/* Pickup Location Trigger (Opens Google Maps Modal on click) */}
              <button
                onClick={() => setShowLocationModal(true)}
                className="hidden sm:flex items-center gap-2 text-xs bg-white/90 hover:bg-white backdrop-blur-md px-3 py-1.5 rounded-full border border-[#E9DFD0] transition-all hover:border-[#E94B18]/50 hover:shadow-xs group text-left cursor-pointer shadow-2xs"
                title="Click to view Google Maps location"
              >
                <div className="w-5 h-5 rounded-full bg-[#E94B18]/10 flex items-center justify-center shrink-0">
                  <MapPin className="w-3 h-3 text-[#E94B18] group-hover:scale-110 transition-transform" />
                </div>
                <div className="flex flex-col text-left leading-tight">
                  <span className="text-[9px] text-[#746A60] font-medium flex items-center gap-1">
                    <span>Pickup from</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  </span>
                  <span className="font-bold text-[#203B2C] text-[11px] truncate max-w-[150px] group-hover:text-[#E94B18] transition-colors">
                    Tea Bhatti Cafe, Shahdol
                  </span>
                </div>
              </button>

              {/* Cart Icon */}
              <Link
                to="/cart"
                className="relative p-2 bg-white/85 hover:bg-white backdrop-blur-md rounded-full border border-[#E9DFD0] text-[#203B2C] hover:text-[#E94B18] transition-all shadow-2xs"
                aria-label="View Cart"
              >
                <ShoppingCart className="w-4 h-4" />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-[#E94B18] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm">
                    {itemCount}
                  </span>
                )}
              </Link>

              {/* User Menu / Avatar & Profile Direct Trigger */}
              <div>
                {isAuthenticated ? (
                  <button
                    onClick={() => setShowProfileModal(true)}
                    className="flex items-center gap-1.5 py-1 px-2.5 rounded-full bg-white/90 hover:bg-white backdrop-blur-md border border-[#E9DFD0] transition-all text-xs font-bold text-[#203B2C] shadow-2xs cursor-pointer hover:border-[#E94B18]/50 hover:shadow-xs group"
                    title="View My Profile Details"
                  >
                    <div className="w-6 h-6 rounded-full bg-[#E94B18] text-white flex items-center justify-center font-bold text-xs uppercase shadow-2xs group-hover:scale-105 transition-transform">
                      {displayName.charAt(0)}
                    </div>
                    <span className="hidden lg:inline text-[12px] font-bold text-[#203B2C] max-w-[110px] truncate group-hover:text-[#E94B18] transition-colors">
                      {displayName}
                    </span>
                  </button>
                ) : (
                  <Link
                    to="/login"
                    className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-white bg-[#E94B18] hover:bg-[#C8451F] px-4 py-2 rounded-full transition-all shadow-xs"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Log In</span>
                  </Link>
                )}
              </div>

              {/* Mobile Hamburger Toggle */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 rounded-full bg-white/85 text-[#203B2C] hover:text-[#E94B18] border border-[#E9DFD0] transition-colors shadow-2xs"
                aria-label="Toggle Navigation"
              >
                {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation Drawer */}
          <AnimatePresence>
            {mobileOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="md:hidden overflow-hidden border-t border-[#EFE5D8]/80 bg-[#FFFDF9]/95 backdrop-blur-md rounded-b-2xl shadow-lg mt-1"
              >
                <div className="py-3 px-1 space-y-2">
                  
                  {/* Mobile Profile Trigger if logged in */}
                  {isAuthenticated && (
                    <button
                      onClick={() => {
                        setMobileOpen(false);
                        setShowProfileModal(true);
                      }}
                      className="w-full flex items-center justify-between text-xs bg-white px-3.5 py-2.5 rounded-xl border border-[#EAE0D1] mb-2 text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#E94B18] text-white flex items-center justify-center font-bold text-xs uppercase">
                          {displayName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-[#203B2C]">{displayName}</div>
                          <div className="text-[10px] text-[#746A60]">{user?.phone}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-[#E94B18]">View Profile →</span>
                    </button>
                  )}

                  {/* Mobile Pickup location clickable button */}
                  <button
                    onClick={() => {
                      setMobileOpen(false);
                      setShowLocationModal(true);
                    }}
                    className="w-full flex items-center justify-between text-xs text-[#4A382A] bg-[#F7F2EA] px-3.5 py-2.5 rounded-xl border border-[#EAE0D1] mb-2 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#E94B18] shrink-0" />
                      <div>
                        <div className="text-[10px] text-[#746A60] font-medium">Store Pickup Location</div>
                        <div className="font-bold text-[#203B2C] text-xs">Tea Bhatti Cafe, Near Medical College, Shahdol</div>
                      </div>
                    </div>
                    <Navigation className="w-3.5 h-3.5 text-[#E94B18]" />
                  </button>

                  {navLinks.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive(link.to)
                          ? 'bg-[#E94B18]/10 text-[#E94B18] font-bold'
                          : 'text-[#4A382A] hover:bg-[#F8F3E9]'
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}

                  {isAuthenticated ? (
                    <button
                      onClick={() => {
                        logout();
                        setMobileOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-[#E94B18] hover:bg-[#F8F3E9]"
                    >
                      Log Out ({displayName})
                    </button>
                  ) : (
                    <Link
                      to="/login"
                      className="block px-3 py-2 rounded-lg text-sm font-medium text-[#E94B18] hover:bg-[#F8F3E9]"
                    >
                      Log In / Sign Up
                    </Link>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>

      {/* ── CUSTOMER PROFILE DETAILS MODAL ── */}
      <ProfileModal 
        isOpen={showProfileModal} 
        onClose={() => setShowProfileModal(false)} 
      />

      {/* ── GOOGLE MAPS STORE LOCATION MODAL ── */}
      <AnimatePresence>
        {showLocationModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-[#E9DFD0] overflow-hidden flex flex-col max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 bg-[#F8F3E9] border-b border-[#E9DFD0] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#E94B18]/10 text-[#E94B18] flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-heading font-black text-lg text-[#203B2C] leading-tight">
                      Tea Bhatti Cafe
                    </h3>
                    <p className="text-xs text-[#746A60] font-medium">
                      Near Medical College Road, Shahdol
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowLocationModal(false)}
                  className="p-1.5 rounded-full hover:bg-black/5 text-[#746A60] hover:text-[#203B2C] transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Google Maps Interactive Frame */}
              <div className="w-full h-48 sm:h-64 md:h-72 bg-[#EAE2D2] relative shrink-0">
                <iframe
                  title="Tea Bhatti Google Maps"
                  src={MAPS_EMBED_URL}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen=""
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="w-full h-full"
                />
              </div>

              {/* Store Details & Action Buttons */}
              <div className="p-4 sm:p-5 space-y-3.5 bg-[#FFFDF9]">
                <div className="space-y-1.5 text-xs text-[#4A382A]">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-[#E94B18] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-[#203B2C]">Address: </span>
                      <span>Medical College Road, In front of New Kishan Hardware, Shahdol, Madhya Pradesh — 484001</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#E94B18] shrink-0" />
                    <div>
                      <span className="font-bold text-[#203B2C]">Timings: </span>
                      <span>Open Daily: 08:00 AM – 10:00 PM (Quick Pickup in ~15 mins)</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[#E94B18] shrink-0" />
                    <div>
                      <span className="font-bold text-[#203B2C]">Contact / Phone: </span>
                      <a href="tel:+917000748920" className="text-[#E94B18] font-semibold hover:underline">
                        +91 70007 48920
                      </a>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                  <a
                    href="https://wa.me/917000748920"
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>WhatsApp</span>
                  </a>

                  <a
                    href={MAPS_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 bg-[#E94B18] hover:bg-[#C8451F] text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <Navigation className="w-4 h-4" />
                    <span>Google Maps</span>
                    <ExternalLink className="w-3.5 h-3.5 ml-0.5 opacity-80" />
                  </a>
                  
                  <button
                    onClick={() => setShowLocationModal(false)}
                    className="sm:w-24 py-2.5 px-4 border border-[#E9DFD0] hover:bg-[#F8F3E9] text-xs font-semibold text-[#4A382A] rounded-xl transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
