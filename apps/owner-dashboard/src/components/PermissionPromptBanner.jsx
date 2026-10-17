// ── Notification Permission Prompt Banner ──
// Requests notification & Web Push permissions on mobile/desktop installation.
// Ensures background alerts ring and display on lock screen even when the dashboard is closed.

import React, { useState, useEffect } from 'react';
import { Bell, ShieldCheck, X, Sparkles, Volume2 } from 'lucide-react';
import { useNotificationSound } from '../context/NotificationSoundContext.jsx';

const DISMISS_KEY = 'cafeos_perm_banner_dismissed_time';
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

export default function PermissionPromptBanner() {
  const { permission, requestPermissionAndSubscribe, isSubscribing } = useNotificationSound();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Only show if browser supports notifications and permission is still 'default' (unanswered)
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'default') {
      const last = localStorage.getItem(DISMISS_KEY);
      if (!last || Date.now() - parseInt(last, 10) > COOLDOWN_MS) {
        // Show after 2 seconds
        const timer = setTimeout(() => setDismissed(false), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [permission]);

  if (dismissed || permission !== 'default') return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setDismissed(true);
  };

  const handleEnable = async () => {
    const ok = await requestPermissionAndSubscribe();
    if (ok) {
      setDismissed(true);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-40 animate-in slide-in-from-bottom-4 duration-300">
      <div className="p-4 rounded-2xl bg-card border border-border-default shadow-xl bg-gradient-to-br from-card to-amber-500/5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
            <Bell className="w-5 h-5 animate-pulse" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <span>Enable Order & Payment Sound Alerts</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              </h4>
              <button 
                type="button" 
                onClick={handleDismiss}
                className="text-text-muted hover:text-text-secondary p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-text-secondary mt-1 leading-relaxed">
              Get instant sound rings and top-screen notification banners whenever a customer places an order or submits a UTR payment — <strong>even when the screen is locked</strong>.
            </p>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleEnable}
                disabled={isSubscribing}
                className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-sm"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>{isSubscribing ? 'Enabling...' : 'Enable Sound & Alerts'}</span>
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="btn-ghost text-xs py-1.5 px-2.5 text-text-muted"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
