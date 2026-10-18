// ── Tea Bhatti Cafe — Login & Sign-Up Page ──
// High-fidelity split layout matching master reference design:
// Left: Rich café visual scene (terracotta chai, grilled sandwich, Good Food Good Mood chalkboard, tilted paper sticker)
// Right: Clean, warm parchment form panel (storefront sketch background, serif typography, styled inputs, burnt-orange CTA)
// Preserves all existing authentication logic, sessions, tokens, redirects, and validation.

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { 
  Smartphone, 
  Lock, 
  User, 
  Mail, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Phone, 
  MapPin, 
  X, 
  Sparkles,
  ShieldCheck,
  Store,
  MessageCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login({ defaultRegister = false }) {
  const [searchParams] = useSearchParams();
  const initialRegister = defaultRegister || searchParams.get('mode') === 'signup' || searchParams.get('mode') === 'register';

  const [isRegister, setIsRegister] = useState(initialRegister);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Modals for Forgot Password & Terms
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();
  const redirect = searchParams.get('redirect') || '/menu';

  // Sync mode if query params change
  useEffect(() => {
    if (searchParams.get('mode') === 'signup' || searchParams.get('mode') === 'register') {
      setIsRegister(true);
    } else if (searchParams.get('mode') === 'login') {
      setIsRegister(false);
    }
  }, [searchParams]);

  // Form Submission
  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Client validation
    const cleanDigits = phone.replace(/\D/g, '');
    if (cleanDigits.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (isRegister && !name.trim()) {
      setError('Please enter your full name');
      return;
    }

    if (isRegister && !agreedToTerms) {
      setError('Please agree to the Terms & Conditions to create an account');
      return;
    }

    setLoading(true);

    try {
      // Ensure canonical +91 format
      const formattedPhone = cleanDigits.startsWith('91') && cleanDigits.length === 12
        ? `+${cleanDigits}`
        : `+91${cleanDigits.slice(-10)}`;

      let loggedInUser;
      if (isRegister) {
        const payload = {
          name: name.trim(),
          phone: formattedPhone,
          password,
          role: 'customer'
        };
        if (email.trim()) {
          payload.email = email.trim();
        }
        loggedInUser = await register(payload);
      } else {
        loggedInUser = await login(formattedPhone, password);
      }

      const displayName = name.trim() || loggedInUser?.user?.name || 'Customer';
      try {
        sessionStorage.setItem('welcome_celebration', displayName);
        window.dispatchEvent(new CustomEvent('welcome-user', { detail: displayName }));
      } catch (_) {}

      navigate(redirect);
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-140px)] py-6 sm:py-10 px-3 sm:px-6 lg:px-8 flex items-center justify-center bg-[#F8F1E5]/60">
      
      {/* Main Split Authentication Card */}
      <div className="w-full max-w-[1120px] bg-[#FFFDF9] rounded-3xl border border-[#E8DACA] shadow-[0_20px_60px_-15px_rgba(32,59,44,0.12)] overflow-hidden flex flex-col md:flex-row min-h-[640px] relative">
        
        {/* ── LEFT COLUMN: Café Visual Scene (Desktop 42%) ── */}
        <div className="hidden md:flex md:w-[42%] lg:w-[44%] relative flex-col justify-between overflow-hidden bg-[#1B120C]">
          
          {/* Background Photography (Teracotta cup, grilled sandwich, chalkboard) */}
          <div 
            className="absolute inset-0 bg-cover bg-no-repeat transition-transform duration-1000 scale-[1.02]"
            style={{ 
              backgroundImage: "url('/images/tea-bhatti-auth-bg.webp')",
              backgroundPosition: 'left center'
            }}
          />

          {/* Warm Dark Vignette Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/55 pointer-events-none" />
          <div className="absolute inset-0 bg-[#203B2C]/20 mix-blend-overlay pointer-events-none" />

          {/* Top Café Header Accent */}
          <div className="relative z-10 p-7 lg:p-8 flex items-center justify-between">
            <div className="inline-flex items-center gap-2 bg-black/40 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20 text-[#FFFDF9]">
              <Sparkles className="w-3.5 h-3.5 text-[#E94B18]" />
              <span className="text-[11px] font-bold tracking-wider uppercase">Shahdol ki apni</span>
            </div>
          </div>

          {/* Bottom Visual: Handcrafted Note Sticker ("Chai se zyada, Ek Habit hai.") */}
          <div className="relative z-10 p-7 lg:p-8">
            <div className="bg-[#FAF4E8] text-[#203B2C] p-4 sm:p-5 rounded-2xl shadow-2xl border border-[#E3D3BE] max-w-[270px] transform -rotate-2 hover:rotate-0 transition-transform duration-300">
              <p className="font-heading font-black text-lg leading-tight text-[#203B2C]">
                Chai se zyada,
              </p>
              <p className="font-heading font-black text-lg leading-tight text-[#E94B18]">
                Ek Habit hai.
              </p>
              <div className="w-10 h-1 bg-[#E94B18] rounded-full mt-2" />
              <p className="text-[10px] text-[#746A60] mt-2 font-medium">
                100% Pure Veg · Freshly Prepared · Quick Store Pickup
              </p>
            </div>
          </div>
        </div>

        {/* ── MOBILE TOP BANNER (< 768px) ── */}
        <div className="md:hidden relative h-48 w-full overflow-hidden bg-[#1B120C]">
          <div 
            className="absolute inset-0 bg-cover bg-no-repeat"
            style={{ 
              backgroundImage: "url('/images/tea-bhatti-auth-bg.webp')",
              backgroundPosition: 'left center'
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#FFFDF9] via-black/40 to-black/60" />
          
          <div className="absolute top-4 left-4 z-10">
            <div className="inline-flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 text-white text-[10px] font-bold">
              <span>PURE VEG · STORE PICKUP</span>
            </div>
          </div>

          <div className="absolute bottom-3 left-4 right-4 z-10 flex items-center justify-between">
            <div className="text-white drop-shadow-md">
              <div className="text-xs font-bold text-amber-200">Near Medical College, Shahdol</div>
              <div className="text-base font-heading font-black">Tea Bhatti Cafe</div>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Authentication Form Panel (58%) ── */}
        <div className="flex-1 relative flex flex-col justify-center px-5 sm:px-10 lg:px-14 py-8 sm:py-12 bg-[#FFFDF9]">
          
          {/* Subtle Storefront Sketch Artwork in Background (Right Edge) */}
          <div 
            className="absolute top-0 right-0 bottom-0 w-1/2 opacity-[0.08] pointer-events-none hidden lg:block bg-no-repeat bg-right-top"
            style={{ 
              backgroundImage: "url('/images/tea-bhatti-auth-bg.webp')",
              backgroundPosition: 'right 20px',
              backgroundSize: 'cover'
            }}
          />

          <div className="w-full max-w-[400px] mx-auto relative z-10">
            
            {/* Brand Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center p-1.5 shadow-sm overflow-hidden shrink-0">
                <img
                  src="/assets/logo.png"
                  alt="Tea Bhatti Cafe"
                  className="w-full h-full object-contain"
                  onError={(e) => { e.target.src = '/teabhatti-logo.png'; }}
                />
              </div>
              <div className="flex flex-col">
                <span className="text-[20px] font-heading font-black text-[#203B2C] leading-none tracking-tight">
                  Tea Bhatti Cafe
                </span>
                <span className="text-[9px] text-[#E94B18] font-bold tracking-[0.14em] uppercase mt-1">
                  PURE VEG · PICKUP
                </span>
              </div>
            </div>

            {/* Heading & Subtitle */}
            <div className="mb-6">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-heading font-black text-[#203B2C] tracking-tight">
                  {isRegister ? 'Create an Account' : 'Welcome Back'}
                </h1>
                <span className="text-[#E94B18] font-serif font-black text-2xl -mt-1 select-none">~</span>
              </div>
              <p className="text-xs sm:text-sm text-[#746A60] mt-1 font-sans">
                {isRegister
                  ? 'Join Tea Bhatti and start ordering your favourites'
                  : 'Login to continue your tasty journey'}
              </p>
            </div>

            {/* Error Message Banner */}
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Full Name (Sign-up only) */}
              {isRegister && (
                <div>
                  <label className="block text-xs font-bold text-[#4A382A] mb-1.5">
                    Full Name
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 text-[#746A60] pointer-events-none">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your full name"
                      required
                      autoComplete="name"
                      className="w-full bg-[#FFFCF7] text-[#203B2C] placeholder-[#746A60]/60 pl-10 pr-3.5 py-3 rounded-xl border border-[#E8DACA] focus:border-[#E94B18] focus:ring-2 focus:ring-[#E94B18]/15 outline-none text-xs sm:text-sm transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Mobile Number */}
              <div>
                <label className="block text-xs font-bold text-[#4A382A] mb-1.5">
                  Mobile Number
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-[#746A60] pointer-events-none">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <span className="absolute left-9 text-xs font-bold text-[#4A382A] pointer-events-none border-r border-[#E8DACA] pr-2">
                    +91
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="Enter 10-digit mobile number"
                    required
                    maxLength={10}
                    autoComplete="tel"
                    className="w-full bg-[#FFFCF7] text-[#203B2C] placeholder-[#746A60]/60 pl-20 pr-3.5 py-3 rounded-xl border border-[#E8DACA] focus:border-[#E94B18] focus:ring-2 focus:ring-[#E94B18]/15 outline-none text-xs sm:text-sm transition-all"
                  />
                </div>
              </div>

              {/* Email Address (Optional, Sign-up only) */}
              {isRegister && (
                <div>
                  <label className="block text-xs font-bold text-[#4A382A] mb-1.5">
                    Email Address <span className="text-[#746A60] font-normal">(optional)</span>
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 text-[#746A60] pointer-events-none">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email (optional)"
                      autoComplete="email"
                      className="w-full bg-[#FFFCF7] text-[#203B2C] placeholder-[#746A60]/60 pl-10 pr-3.5 py-3 rounded-xl border border-[#E8DACA] focus:border-[#E94B18] focus:ring-2 focus:ring-[#E94B18]/15 outline-none text-xs sm:text-sm transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-[#4A382A] mb-1.5">
                  {isRegister ? 'Create Password' : 'Password'}
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-[#746A60] pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isRegister ? 'Create a strong password (min 6 chars)' : 'Enter your password'}
                    required
                    minLength={6}
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    className="w-full bg-[#FFFCF7] text-[#203B2C] placeholder-[#746A60]/60 pl-10 pr-10 py-3 rounded-xl border border-[#E8DACA] focus:border-[#E94B18] focus:ring-2 focus:ring-[#E94B18]/15 outline-none text-xs sm:text-sm transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 text-[#746A60] hover:text-[#203B2C] p-1 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Secondary Options: Remember Me & Forgot Password (Login Mode) */}
              {!isRegister && (
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-[#E8DACA] text-[#E94B18] focus:ring-[#E94B18]/20 accent-[#E94B18]"
                    />
                    <span className="text-xs text-[#4A382A] font-medium">Remember me</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="text-xs font-bold text-[#E94B18] hover:underline transition-all"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {/* Terms Acceptance (Sign-up Mode) */}
              {isRegister && (
                <div className="pt-1">
                  <label className="flex items-start gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded border-[#E8DACA] text-[#E94B18] focus:ring-[#E94B18]/20 accent-[#E94B18]"
                    />
                    <span className="text-xs text-[#4A382A] font-medium leading-relaxed">
                      I agree to the{' '}
                      <button
                        type="button"
                        onClick={() => setShowTermsModal(true)}
                        className="text-[#E94B18] font-bold hover:underline"
                      >
                        Terms & Conditions
                      </button>
                    </span>
                  </label>
                </div>
              )}

              {/* Primary Action Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#E94B18] hover:bg-[#D43F10] active:scale-[0.99] text-white py-3.5 px-4 rounded-xl font-bold text-sm tracking-wide shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
              >
                {loading ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    <span>{isRegister ? 'Create Account' : 'Login'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Toggle Between Login and Sign-up */}
            <div className="text-center mt-6 pt-5 border-t border-[#EFE5D8]">
              <p className="text-xs sm:text-sm text-[#746A60]">
                {isRegister ? 'Already have an account?' : 'New here?'}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(!isRegister);
                    setError('');
                  }}
                  className="text-[#E94B18] font-bold hover:underline transition-colors ml-1"
                >
                  {isRegister ? 'Login' : 'Create an account'}
                </button>
              </p>
            </div>

          </div>
        </div>

      </div>

      {/* ── FORGOT PASSWORD MODAL ── */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-[#FFFDF9] w-full max-w-md rounded-2xl shadow-2xl border border-[#E8DACA] p-4 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#E8DACA]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#E94B18]/10 text-[#E94B18] flex items-center justify-center">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-heading font-black text-lg text-[#203B2C]">Password Recovery</h3>
                    <p className="text-[11px] text-[#746A60]">Tea Bhatti Cafe Assistance</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowForgotModal(false)}
                  className="p-1 rounded-lg text-[#746A60] hover:bg-black/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-[#4A382A] leading-relaxed">
                <p>
                  For customer security, our store pickup accounts are managed directly with our Shahdol counter.
                </p>
                
                <div className="p-3.5 bg-[#F8F1E5] rounded-xl border border-[#E8DACA] space-y-2">
                  <div className="flex items-center gap-2 text-[#203B2C] font-bold">
                    <Store className="w-4 h-4 text-[#E94B18]" />
                    <span>Tea Bhatti Cafe Counter</span>
                  </div>
                  <div className="flex items-start gap-2 text-[11px] text-[#746A60]">
                    <MapPin className="w-3.5 h-3.5 text-[#E94B18] shrink-0 mt-0.5" />
                    <span>Medical College Road, In front of New Kishan Hardware, Shahdol (MP)</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-[#746A60]">
                    <Phone className="w-3.5 h-3.5 text-[#E94B18] shrink-0" />
                    <a href="tel:+917000748920" className="font-bold text-[#E94B18] hover:underline">
                      +91 70007 48920
                    </a>
                  </div>
                </div>

                <p className="text-[11px] text-[#746A60]">
                  Please call us or send a message on WhatsApp, and we will verify your registered phone number and update your password immediately.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <a
                  href="https://wa.me/917000748920?text=Hi%20Tea%20Bhatti%2C%20I%20need%20help%20resetting%20my%20password"
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4 rounded-xl text-center font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp (+91 70007 48920)</span>
                </a>
                <a
                  href="tel:+917000748920"
                  className="bg-[#E94B18] hover:bg-[#D43F10] text-white py-2.5 px-4 rounded-xl text-center font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call Store</span>
                </a>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#E8DACA] text-xs font-bold text-[#4A382A] hover:bg-[#F8F1E5] transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── TERMS & CONDITIONS MODAL ── */}
      <AnimatePresence>
        {showTermsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-[#FFFDF9] w-full max-w-md rounded-2xl shadow-2xl border border-[#E8DACA] p-4 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#E8DACA]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#203B2C]/10 text-[#203B2C] flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-[#203B2C]" />
                  </div>
                  <div>
                    <h3 className="font-heading font-black text-lg text-[#203B2C]">Terms & Conditions</h3>
                    <p className="text-[11px] text-[#746A60]">Tea Bhatti Cafe Pickup Rules</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTermsModal(false)}
                  className="p-1 rounded-lg text-[#746A60] hover:bg-black/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs text-[#4A382A] leading-relaxed max-h-[280px] overflow-y-auto pr-1">
                <div className="p-2.5 bg-[#F8F1E5] rounded-xl border border-[#E8DACA]">
                  <p className="font-bold text-[#203B2C]">1. Pure Vegetarian Guarantee</p>
                  <p className="text-[11px] text-[#746A60] mt-0.5">All items prepared at Tea Bhatti Cafe are 100% pure vegetarian, freshly cooked upon order confirmation.</p>
                </div>
                <div className="p-2.5 bg-[#F8F1E5] rounded-xl border border-[#E8DACA]">
                  <p className="font-bold text-[#203B2C]">2. Store Pickup Model</p>
                  <p className="text-[11px] text-[#746A60] mt-0.5">Orders are prepared for pickup at our Shahdol counter (Near Medical College Road). Please arrive ~15 mins after ordering.</p>
                </div>
                <div className="p-2.5 bg-[#F8F1E5] rounded-xl border border-[#E8DACA]">
                  <p className="font-bold text-[#203B2C]">3. 20% Advance Booking</p>
                  <p className="text-[11px] text-[#746A60] mt-0.5">Online booking requires a 20% UPI advance to reserve your food. The remaining 80% is payable at the pickup counter.</p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowTermsModal(false)}
                  className="w-full bg-[#203B2C] hover:bg-[#16291E] text-white py-2.5 px-4 rounded-xl font-bold text-xs shadow-xs transition-colors"
                >
                  I Understand & Agree
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
