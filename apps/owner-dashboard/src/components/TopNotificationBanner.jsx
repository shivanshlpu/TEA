// ── Top Screen Notification Banner — Modern Compact Toast Style ──
// Elegant, non-intrusive floating alert for new orders and verification reminders.

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  AlertTriangle, 
  CreditCard, 
  ShoppingBag, 
  CheckCircle2, 
  X, 
  ArrowRight
} from 'lucide-react';
import { useNotificationSound } from '../context/NotificationSoundContext.jsx';

export default function TopNotificationBanner() {
  const navigate = useNavigate();
  const { activeBanner, dismissBanner } = useNotificationSound();

  if (!activeBanner) return null;

  const isFollowUp = activeBanner.type === 'order_unverified_followup';
  const isUtr = activeBanner.type === 'utr_submitted';
  const isVerify = activeBanner.type === 'payment_verified';

  const handleAction = () => {
    dismissBanner();
    navigate('/orders');
  };

  return (
    <aside 
      aria-label="Notification alert"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-1.5rem)] max-w-md animate-in slide-in-from-top-3 duration-300 pointer-events-none"
    >
      <div className="pointer-events-auto p-3 sm:p-3.5 rounded-2xl bg-neutral-900/95 text-white shadow-2xl border border-neutral-700/60 backdrop-blur-md flex items-center gap-3">
        {/* Leading Icon Badge */}
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
          isFollowUp
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            : isUtr
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              : isVerify
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-primary/20 text-amber-300 border border-primary/30'
        }`}>
          {isFollowUp ? (
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          ) : isUtr ? (
            <CreditCard className="w-4 h-4 text-blue-400" />
          ) : isVerify ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <ShoppingBag className="w-4 h-4 text-amber-300" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-white truncate">
              {activeBanner.title}
            </h4>
            {activeBanner.pickupCode && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-neutral-300 shrink-0">
                #{activeBanner.pickupCode}
              </span>
            )}
          </div>
          <p className="text-[11px] text-neutral-300 truncate mt-0.5">
            {activeBanner.message}
          </p>
        </div>

        {/* Quick Action Button */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleAction}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 shadow-sm transition-transform active:scale-95 ${
              isFollowUp
                ? 'bg-amber-500 hover:bg-amber-400 text-neutral-950'
                : isUtr
                  ? 'bg-blue-500 hover:bg-blue-400 text-white'
                  : 'bg-primary hover:bg-primary-hover text-white'
            }`}
          >
            <span>{isFollowUp || isUtr ? 'Verify' : 'View'}</span>
            <ArrowRight className="w-3 h-3" />
          </button>

          {/* Dismiss Button */}
          <button
            type="button"
            onClick={dismissBanner}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
