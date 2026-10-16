// ── PWA Installation Prompt for Customers ──
// App Name: Tea Bhatti Cafe
// Features: Native prompt trigger, iOS Safari step-by-step guidance, dismissal cooldown (7 days),
// suppresses during active checkout, auto-hides when installed or running standalone.

import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, X, Share2, PlusSquare, Smartphone, Sparkles, Check } from 'lucide-react';
import { useToast } from '../context/ToastContext.jsx';

const DISMISS_KEY = 'cafeos_customer_pwa_dismissed';
const INSTALLED_KEY = 'cafeos_customer_pwa_installed';
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export default function InstallPrompt() {
  const location = useLocation();
  const { toast } = useToast();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Check if already installed or running in standalone PWA mode
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      window.navigator.standalone === true;

    if (isStandalone || localStorage.getItem(INSTALLED_KEY) === 'true') {
      setIsInstalled(true);
      return;
    }

    // 2. Check dismissal cooldown
    const lastDismissed = localStorage.getItem(DISMISS_KEY);
    if (lastDismissed && Date.now() - parseInt(lastDismissed, 10) < COOLDOWN_MS) {
      return;
    }

    // 3. Detect iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !window.MSStream;
    setIsIOS(isIosDevice);

    // 4. Listen for native Android/Desktop install event
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Wait 3.5 seconds before showing prompt so customer can see the cafe home
      setTimeout(() => {
        setShowPrompt(true);
      }, 3500);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // 5. Listen for successful installation
    const handleAppInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, 'true');
      setIsInstalled(true);
      setShowPrompt(false);
      setShowIOSGuide(false);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // If iOS and not running standalone, show prompt after initial delay
    if (isIosDevice && !isStandalone) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 4000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
        window.removeEventListener('appinstalled', handleAppInstalled);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Suppress installation popup during active checkout to avoid interrupting orders
  const isCheckoutRoute = location.pathname.includes('/checkout');
  if (!showPrompt || isInstalled || isCheckoutRoute) {
    return null;
  }

  // Handle User Clicking "Install App"
  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Trigger native browser install dialog
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        localStorage.setItem(INSTALLED_KEY, 'true');
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      // Show iOS step-by-step instructions
      setShowIOSGuide(true);
    } else {
      // Fallback for desktop/other browsers without deferredPrompt
      toast.info("To install Tea Bhatti Cafe: tap browser menu (⋮) and select 'Install App' / 'Add to Home screen'");
      handleDismiss();
    }
  };

  // Handle "Maybe Later"
  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setShowPrompt(false);
    setShowIOSGuide(false);
  };

  return (
    <>
      {/* Installation Banner / Card */}
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 animate-slide-up">
        <div className="bg-white rounded-3xl p-5 shadow-2xl border-2 border-primary/20 backdrop-blur-md bg-white/95">
          <div className="flex items-start gap-3.5">
            {/* App Icon */}
            <div className="w-14 h-14 rounded-2xl p-1 bg-amber-50 border border-amber-200 shrink-0 shadow-sm overflow-hidden flex items-center justify-center">
              <img
                src="/teabhatti-logo.png"
                alt="Tea Bhatti Cafe Logo"
                className="w-full h-full object-contain"
              />
            </div>

            {/* App Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  <Sparkles className="w-3 h-3" /> Official App
                </span>
                <button
                  onClick={handleDismiss}
                  className="text-text-secondary hover:text-text-primary p-1 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <h3 className="font-heading font-extrabold text-base text-text-primary mt-1">
                Tea Bhatti Cafe
              </h3>
              <p className="text-xs text-text-secondary mt-0.5 leading-snug">
                Install our app on your phone for instant 1-tap food ordering and live pickup token updates!
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex items-center gap-2.5">
            <button
              onClick={handleInstallClick}
              className="btn-primary flex-1 py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Install App</span>
            </button>
            <button
              onClick={handleDismiss}
              className="btn-ghost py-2.5 px-3.5 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>

      {/* iOS Safari Step-by-Step Installation Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-border-subtle animate-slide-up">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center gap-2.5">
                <img src="/teabhatti-logo.png" alt="Tea Bhatti" className="w-8 h-8 rounded-xl object-contain" />
                <h3 className="font-heading font-extrabold text-base text-text-primary">
                  Install on iPhone / iPad
                </h3>
              </div>
              <button onClick={() => setShowIOSGuide(false)} className="text-text-secondary hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-text-secondary">
              Follow these 2 quick steps to add <strong>Tea Bhatti Cafe</strong> directly to your home screen:
            </p>

            <div className="space-y-3 bg-bg-base/70 p-4 rounded-2xl border border-border-subtle text-xs">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <p className="font-bold text-text-primary flex items-center gap-1.5">
                    Tap the Share Button <Share2 className="w-4 h-4 text-blue-600 inline" />
                  </p>
                  <p className="text-text-secondary text-[11px]">
                    Located at the bottom of Safari on iPhone (or top right on iPad).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 pt-2 border-t border-border-subtle/60">
                <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <p className="font-bold text-text-primary flex items-center gap-1.5">
                    Tap 'Add to Home Screen' <PlusSquare className="w-4 h-4 text-emerald-600 inline" />
                  </p>
                  <p className="text-text-secondary text-[11px]">
                    Scroll down in the share sheet and tap <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setShowIOSGuide(false);
                handleDismiss();
              }}
              className="btn-primary w-full py-2.5 text-xs font-bold"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
}
