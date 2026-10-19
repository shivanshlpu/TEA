// ── Tea Bhatti Cafe — Customer Forgot Password Modal ──
// 3-Step Instant WhatsApp OTP Verification:
// Step 1: Enters registered mobile number (indexed fast lookup, rejects un-registered numbers)
// Step 2: Enters 6-digit OTP received on WhatsApp (with resend cooldown timer)
// Step 3: Sets new password & automatically logs the customer in with zero hassle

import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Smartphone, 
  KeyRound, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  MessageCircle, 
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import api from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

export default function ForgotPasswordModal({ isOpen, onClose, initialPhone = '' }) {
  const [step, setStep] = useState('phone'); // 'phone' | 'otp' | 'password' | 'success'
  const [phone, setPhone] = useState(initialPhone);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [customerName, setCustomerName] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const { setAuthSession } = useAuth();
  const navigate = useNavigate();

  // Reset modal state when opened/closed
  useEffect(() => {
    if (isOpen) {
      setStep('phone');
      setError('');
      setSuccessMsg('');
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
      if (initialPhone) {
        setPhone(initialPhone.replace(/\D/g, '').slice(-10));
      }
    }
  }, [isOpen, initialPhone]);

  // Resend OTP countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // STEP 1: Request OTP for registered number
  async function handleRequestOtp(e) {
    if (e) e.preventDefault();
    setError('');
    const cleanDigits = phone.replace(/\D/g, '').slice(-10);

    if (cleanDigits.length !== 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    try {
      const res = await api.requestForgotOtp(cleanDigits);
      setMaskedPhone(res.phone || `+91 ******${cleanDigits.slice(-4)}`);
      setCustomerName(res.name || '');
      setSuccessMsg(res.message || 'OTP sent to your WhatsApp');
      setCooldown(45);
      setStep('otp');
    } catch (err) {
      setError(err.message || 'Failed to send OTP. Please check your number.');
    } finally {
      setLoading(false);
    }
  }

  // STEP 2: Verify OTP
  async function handleVerifyOtp(e) {
    if (e) e.preventDefault();
    setError('');
    const cleanOtp = otp.trim().replace(/\D/g, '');

    if (cleanOtp.length !== 6) {
      setError('Please enter the full 6-digit OTP code');
      return;
    }

    setLoading(true);
    try {
      const cleanDigits = phone.replace(/\D/g, '').slice(-10);
      const res = await api.verifyForgotOtp(cleanDigits, cleanOtp);
      if (res.resetToken) {
        setResetToken(res.resetToken);
      }
      setSuccessMsg('OTP verified successfully!');
      setStep('password');
    } catch (err) {
      setError(err.message || 'Invalid or expired OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Auto-verify when 6 digits are typed in OTP box
  useEffect(() => {
    const clean = otp.trim().replace(/\D/g, '');
    if (step === 'otp' && clean.length === 6 && !loading) {
      handleVerifyOtp();
    }
  }, [otp, step]);

  // STEP 3: Submit New Password
  async function handleResetPassword(e) {
    if (e) e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const cleanDigits = phone.replace(/\D/g, '').slice(-10);
      const res = await api.resetForgotPassword({
        phone: cleanDigits,
        otp: otp.trim(),
        resetToken,
        newPassword,
      });

      setStep('success');
      setSuccessMsg('Password updated successfully!');

      // Automatically authenticate customer with the newly generated session
      if (res.accessToken && res.user && setAuthSession) {
        setAuthSession(res);
      }

      // Close modal and redirect after 1.8 seconds
      setTimeout(() => {
        onClose();
        navigate('/menu');
      }, 1800);
    } catch (err) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-[#FFFDF9] w-full max-w-md rounded-3xl shadow-2xl border border-[#E8DACA] p-5 sm:p-7 space-y-4 max-h-[92vh] overflow-y-auto relative"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E8DACA]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#E94B18]/10 text-[#E94B18] flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5 text-[#E94B18]" />
            </div>
            <div>
              <h3 className="font-heading font-black text-lg text-[#203B2C]">
                {step === 'success' ? 'Password Reset!' : 'Reset Password'}
              </h3>
              <p className="text-[11px] text-[#746A60]">
                {step === 'phone' && 'Verify your registered mobile number'}
                {step === 'otp' && 'WhatsApp OTP Verification'}
                {step === 'password' && 'Create your new password'}
                {step === 'success' && 'You are all set!'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#746A60] hover:bg-black/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* Success Banner */}
        {successMsg && step !== 'success' && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
            <span className="leading-snug">{successMsg}</span>
          </div>
        )}

        {/* ── STEP 1: ENTER REGISTERED PHONE NUMBER ── */}
        {step === 'phone' && (
          <form onSubmit={handleRequestOtp} className="space-y-4 pt-1">
            <p className="text-xs text-[#4A382A] leading-relaxed">
              Enter your registered mobile number. We will verify your account and send a secure 6-digit OTP to your <strong>WhatsApp</strong>.
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#4A382A]">
                Registered Mobile Number
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#203B2C] select-none flex items-center gap-1">
                  <span>🇮🇳</span>
                  <span>+91</span>
                </span>
                <input
                  type="tel"
                  required
                  autoFocus
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="9009149694"
                  maxLength={10}
                  className="w-full pl-18 pr-4 py-2.5 rounded-xl border border-[#E8DACA] bg-[#FAF5ED] font-mono text-sm text-[#203B2C] focus:bg-white focus:outline-none focus:border-[#E94B18] transition-all"
                />
              </div>
              <p className="text-[10px] text-[#746A60]">
                * Must be registered in Tea Bhatti customer database.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || phone.replace(/\D/g, '').length < 10}
              className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-[#E94B18] hover:bg-[#D43F10] text-white shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Checking database...</span>
                </>
              ) : (
                <>
                  <MessageCircle className="w-4 h-4 text-emerald-300" />
                  <span>Send OTP on WhatsApp</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        )}

        {/* ── STEP 2: ENTER WHATSAPP OTP ── */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4 pt-1">
            <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-950 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span>OTP sent to your WhatsApp: </span>
                <strong className="font-mono">{maskedPhone}</strong>
                {customerName && <span className="block text-[11px] text-emerald-800">Hello, {customerName}!</span>}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#4A382A]">
                Enter 6-Digit WhatsApp OTP
              </label>
              <input
                type="text"
                required
                autoFocus
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="• • • • • •"
                className="w-full py-3 px-4 text-center tracking-[0.4em] font-mono text-2xl font-black rounded-xl border border-[#E8DACA] bg-[#FAF5ED] text-[#203B2C] focus:bg-white focus:outline-none focus:border-[#E94B18] transition-all"
              />
              <p className="text-[10px] text-[#746A60] text-center">
                Check WhatsApp message from Tea Bhatti Cafe
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || otp.trim().length !== 6}
              className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-[#203B2C] hover:bg-[#16291E] text-white shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verifying OTP...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Verify OTP</span>
                </>
              )}
            </button>

            {/* Resend & Back controls */}
            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => { setStep('phone'); setError(''); }}
                className="text-text-secondary hover:text-text-primary text-[11px]"
              >
                Change Number
              </button>

              <button
                type="button"
                onClick={handleRequestOtp}
                disabled={cooldown > 0 || loading}
                className="text-[#E94B18] hover:underline font-bold text-[11px] flex items-center gap-1 disabled:opacity-50 disabled:no-underline"
              >
                <RotateCcw className="w-3 h-3" />
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend WhatsApp OTP'}
              </button>
            </div>
          </form>
        )}

        {/* ── STEP 3: SET NEW PASSWORD ── */}
        {step === 'password' && (
          <form onSubmit={handleResetPassword} className="space-y-4 pt-1">
            <p className="text-xs text-[#4A382A]">
              Create a new password for your Tea Bhatti account (minimum 6 characters).
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#4A382A]">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoFocus
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-[#E8DACA] bg-[#FAF5ED] text-xs text-[#203B2C] focus:bg-white focus:outline-none focus:border-[#E94B18] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#746A60] hover:text-[#203B2C]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#4A382A]">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-[#E8DACA] bg-[#FAF5ED] text-xs text-[#203B2C] focus:bg-white focus:outline-none focus:border-[#E94B18] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#746A60] hover:text-[#203B2C]"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || newPassword.length < 6 || newPassword !== confirmPassword}
              className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-[#E94B18] hover:bg-[#D43F10] text-white shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Update Password & Log In</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* ── STEP 4: SUCCESS CONFIRMATION ── */}
        {step === 'success' && (
          <div className="text-center py-6 space-y-3 animate-fade-in">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="font-heading font-black text-xl text-[#203B2C]">
              Password Reset Complete!
            </h4>
            <p className="text-xs text-[#746A60] max-w-xs mx-auto">
              Your password has been updated securely. Logging you in automatically...
            </p>
            <div className="flex items-center justify-center gap-1.5 text-xs text-primary font-bold pt-2">
              <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Redirecting to Tea Bhatti Menu...</span>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
