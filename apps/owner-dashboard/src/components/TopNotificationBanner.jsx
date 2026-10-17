// ── Top Screen Notification Banner — Native App & WhatsApp Style ──
// Slides down from the top of the screen when a new order or UTR payment arrives.
// Has action buttons to navigate directly to orders for immediate verification.

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  CreditCard, 
  ShoppingBag, 
  CheckCircle2, 
  X, 
  ArrowRight, 
  DollarSign, 
  ExternalLink 
} from 'lucide-react';
import { useNotificationSound } from '../context/NotificationSoundContext.jsx';

export default function TopNotificationBanner() {
  const navigate = useNavigate();
  const { activeBanner, dismissBanner } = useNotificationSound();

  if (!activeBanner) return null;

  const isUtr = activeBanner.type === 'utr_submitted';
  const isVerify = activeBanner.type === 'payment_verified';
  const isNewOrder = activeBanner.type === 'new_order';

  const handleAction = () => {
    dismissBanner();
    navigate('/orders');
  };

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4 animate-in slide-in-from-top-4 duration-300">
      <div className={`p-4 rounded-2xl shadow-2xl border backdrop-blur-md transition-all ${
        isUtr 
          ? 'bg-amber-900/95 border-amber-400 text-white ring-4 ring-amber-500/20 shadow-amber-900/40' 
          : isVerify 
            ? 'bg-emerald-900/95 border-emerald-400 text-white ring-4 ring-emerald-500/20 shadow-emerald-900/40'
            : 'bg-[#2A1810]/95 border-primary text-white ring-4 ring-primary/20 shadow-black/50'
      }`}>
        <div className="flex items-start justify-between gap-3">
          {/* Leading Icon Badge */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
            isUtr 
              ? 'bg-amber-500 text-amber-950 animate-bounce' 
              : isVerify 
                ? 'bg-emerald-500 text-emerald-950' 
                : 'bg-primary text-white animate-pulse'
          }`}>
            {isUtr ? <CreditCard className="w-5 h-5" /> : isVerify ? <CheckCircle2 className="w-5 h-5" /> : <ShoppingBag className="w-5 h-5" />}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                isUtr ? 'bg-amber-400 text-amber-950' : isVerify ? 'bg-emerald-400 text-emerald-950' : 'bg-primary/40 text-primary-light border border-primary/40'
              }`}>
                {isUtr ? 'Payment Alert' : isVerify ? 'Verified' : 'Live Order'}
              </span>
              <span className="text-xs text-white/70 font-mono">
                Token #{activeBanner.pickupCode || 'ORD'}
              </span>
            </div>

            <h4 className="text-sm font-bold text-white mt-1 leading-tight">
              {activeBanner.title}
            </h4>

            <p className="text-xs text-white/90 mt-0.5 leading-snug">
              {activeBanner.message}
            </p>

            {/* Quick Action Button */}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleAction}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md transition-transform active:scale-95 ${
                  isUtr 
                    ? 'bg-amber-400 hover:bg-amber-300 text-amber-950' 
                    : isVerify 
                      ? 'bg-emerald-400 hover:bg-emerald-300 text-emerald-950' 
                      : 'bg-primary hover:bg-primary-hover text-white'
                }`}
              >
                <span>{isUtr ? 'Verify UTR Now' : 'View Order Details'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Close / Dismiss */}
          <button
            type="button"
            onClick={dismissBanner}
            className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            title="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
