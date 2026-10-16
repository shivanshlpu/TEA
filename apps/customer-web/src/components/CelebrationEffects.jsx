// ── High-Quality Celebration Effects & Animated Status Modals ──
// Professional vector animations, multi-burst particle poppers, and confirmation dialogs.
// Free of AI emojis; utilizes crisp SVG iconography and smooth micro-interactions.

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, ShieldCheck, Sparkles, Store, ArrowRight, Receipt, Clock, Bell } from 'lucide-react';

/**
 * Fires a vibrant multi-directional party popper effect.
 */
export function firePartyPopper() {
  const count = 200;
  const defaults = {
    origin: { y: 0.7 },
    zIndex: 9999,
  };

  function fire(particleRatio, opts) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    });
  }

  // Left cannon burst
  fire(0.25, {
    spread: 30,
    startVelocity: 55,
    origin: { x: 0.15, y: 0.8 },
    colors: ['#D97706', '#059669', '#2563EB', '#DC2626', '#F59E0B'],
  });

  // Right cannon burst
  fire(0.25, {
    spread: 30,
    startVelocity: 55,
    origin: { x: 0.85, y: 0.8 },
    colors: ['#D97706', '#059669', '#2563EB', '#DC2626', '#F59E0B'],
  });

  // Center multi-spread fan
  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.9,
    origin: { x: 0.5, y: 0.65 },
    colors: ['#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'],
  });

  fire(0.15, {
    spread: 120,
    startVelocity: 45,
    decay: 0.92,
    scalar: 1.2,
    origin: { x: 0.5, y: 0.65 },
    colors: ['#FCD34D', '#6EE7B7', '#93C5FD'],
  });
}

/**
 * Fires an emerald & gold celebratory confetti spray for verified payment.
 */
export function firePaymentCelebration() {
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    zIndex: 9999,
    colors: ['#059669', '#10B981', '#D97706', '#F59E0B', '#34D399'],
  });
}

/**
 * High-Quality Animated Vector Checkmark
 */
export function AnimatedCheckmark({ size = 80, color = '#059669' }) {
  return (
    <div className="relative inline-flex items-center justify-center">
      {/* Outer pulsing glow ring */}
      <div 
        className="absolute inset-0 rounded-full animate-ping opacity-25"
        style={{ backgroundColor: color }}
      />
      
      {/* SVG Checkmark */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 52 52"
        className="relative z-10"
        style={{ filter: 'drop-shadow(0 4px 12px rgba(5, 150, 105, 0.25))' }}
      >
        <circle
          cx="26"
          cy="26"
          r="24"
          fill="none"
          stroke={color}
          strokeWidth="3.5"
          className="stroke-circle"
          style={{
            strokeDasharray: 166,
            strokeDashoffset: 166,
            animation: 'strokeCircle 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards',
          }}
        />
        <path
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.1 27.2l7.1 7.2 16.7-16.8"
          style={{
            strokeDasharray: 48,
            strokeDashoffset: 48,
            animation: 'strokeCheck 0.35s cubic-bezier(0.65, 0, 0.45, 1) 0.5s forwards',
          }}
        />
      </svg>

      <style>{`
        @keyframes strokeCircle {
          100% { stroke-dashoffset: 0; }
        }
        @keyframes strokeCheck {
          100% { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
}

/**
 * High-Quality "Payment Done" Modal
 */
export function PaymentDoneModal({ order, amount, utr, onClose, onViewOrder }) {
  useEffect(() => {
    firePaymentCelebration();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="card p-8 max-w-md w-full bg-white rounded-3xl shadow-2xl border-2 border-emerald-500/20 text-center space-y-6 relative animate-scale-up">
        {/* Animated Checkmark */}
        <div className="pt-2">
          <AnimatedCheckmark size={88} color="#059669" />
        </div>

        <div>
          <span className="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 inline-flex items-center gap-1.5 mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Payment Verified
          </span>
          <h2 className="text-2xl font-heading font-black text-text-primary tracking-tight">
            Payment Completed!
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            Your UPI payment of <strong className="text-text-primary font-mono text-sm">₹{amount || order?.total}</strong> has been confirmed.
          </p>
        </div>

        {/* Payment Summary Box */}
        <div className="p-4 rounded-2xl bg-bg-base/70 border border-border-subtle text-left space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-text-secondary">Token Number:</span>
            <span className="font-mono font-bold text-primary">#{order?.pickupCode || 'TB-CONFIRMED'}</span>
          </div>
          {utr && (
            <div className="flex justify-between">
              <span className="text-text-secondary">UTR / Ref:</span>
              <span className="font-mono font-semibold text-text-primary">{utr}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border-subtle/80 pt-2 font-bold">
            <span className="text-text-primary">Status:</span>
            <span className="text-emerald-700">Order Accepted by Kitchen</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          <button
            onClick={onViewOrder}
            className="btn-primary w-full py-3.5 text-xs font-bold flex items-center justify-center gap-2 shadow-lg"
          >
            <span>Track Live Order Status</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="text-xs font-semibold text-text-secondary hover:text-text-primary py-2 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * High-Quality "Order Ready / Completed" Modal
 */
export function OrderDoneModal({ order, isReady, onClose }) {
  useEffect(() => {
    firePartyPopper();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="card p-8 max-w-md w-full bg-white rounded-3xl shadow-2xl border-2 border-amber-500/20 text-center space-y-6 relative animate-scale-up">
        {/* Animated Icon */}
        <div className="pt-2">
          <AnimatedCheckmark size={88} color="#D97706" />
        </div>

        <div>
          <span className="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-amber-100 text-amber-900 inline-flex items-center gap-1.5 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            {isReady ? 'Fresh & Ready' : 'Pickup Completed'}
          </span>
          <h2 className="text-2xl font-heading font-black text-text-primary tracking-tight">
            {isReady ? 'Your Order is Ready!' : 'Order Completed!'}
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            {isReady
              ? 'Head over to Tea Bhatti Cafe counter to collect your fresh, hot food.'
              : 'Thank you for ordering with Tea Bhatti Cafe. We hope you enjoy your meal!'}
          </p>
        </div>

        {/* Pickup Token Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 text-center space-y-1">
          <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">Pickup Token</span>
          <div className="text-2xl font-mono font-black text-primary">
            {order?.pickupCode || 'TB-READY'}
          </div>
          <span className="text-[10px] text-text-secondary block">Tea Bhatti Cafe • Near Medical College, Shahdol</span>
        </div>

        <button
          onClick={onClose}
          className="btn-primary w-full py-3.5 text-xs font-bold"
        >
          Got It, Thank You!
        </button>
      </div>
    </div>
  );
}

/**
 * Party Popper Welcome Toast on Login/Signup
 */
export function WelcomeToast({ userName, onClose }) {
  useEffect(() => {
    firePartyPopper();
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed top-6 right-6 z-50 max-w-sm w-full bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl border-2 border-primary/20 animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 shadow-md">
          <Sparkles className="w-5 h-5 text-amber-200" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black uppercase text-primary tracking-wide">
            Welcome to Tea Bhatti Cafe!
          </p>
          <h4 className="text-sm font-heading font-bold text-text-primary truncate">
            {userName ? `Glad to see you, ${userName}!` : 'Ready for hot & fresh bites!'}
          </h4>
          <p className="text-[11px] text-text-secondary mt-0.5">
            Explore our curated menu and place your pickup orders directly.
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-text-secondary hover:text-text-primary text-xs font-bold p-1"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
