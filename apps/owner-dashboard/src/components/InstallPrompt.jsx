// ── PWA Installation Prompt for Owner / Admin ──
// App Name: Cafe Management
// Features: Native prompt trigger, iOS Safari step-by-step guidance, dismissal cooldown (7 days),
// auto-hides when installed or running in standalone mode.

import React, { useState, useEffect } from 'react';
import { Download, X, Share2, PlusSquare, ShieldCheck, Sparkles } from 'lucide-react';
import { useToast } from '../context/ToastContext.jsx';

const DISMISS_KEY = 'cafeos_owner_pwa_dismissed';
const INSTALLED_KEY = 'cafeos_owner_pwa_installed';
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export default function InstallPrompt() {
  const { toast } = useToast();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Check if running in standalone mode or already marked installed
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

    // 4. Native beforeinstallprompt
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Wait 3 seconds after dashboard load
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // 5. App installed listener
    const handleAppInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, 'true');
      setIsInstalled(true);
      setShowPrompt(false);
      setShowIOSGuide(false);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    if (isIosDevice && !isStandalone) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3500);
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

  if (!showPrompt || isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        localStorage.setItem(INSTALLED_KEY, 'true');
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      toast.info("To install Cafe Management: tap browser menu (⋮) and select 'Install App' / 'Add to Home screen'");
      handleDismiss();
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setShowPrompt(false);
    setShowIOSGuide(false);
  };

  return (
    <>
      {/* Installation Banner */}
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 animate-slide-up">
        <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-2xl border-2 border-slate-700/80 backdrop-blur-md bg-slate-900/95">
          <div className="flex items-start gap-3.5">
            {/* App Icon */}
            <div className="w-14 h-14 rounded-2xl p-1 bg-slate-800 border border-slate-700 shrink-0 shadow-sm overflow-hidden flex items-center justify-center">
              <img
                src="/teabhatti-logo.png"
                alt="Cafe Management Logo"
                className="w-full h-full object-contain"
              />
            </div>

            {/* App Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                  <ShieldCheck className="w-3 h-3" /> Owner App
                </span>
                <button
                  onClick={handleDismiss}
                  className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <h3 className="font-heading font-extrabold text-base text-white mt-1">
                Cafe Management
              </h3>
              <p className="text-xs text-slate-300 mt-0.5 leading-snug">
                Install management app for 1-tap live kitchen order alerts, pickup queue, and store settings!
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex items-center gap-2.5">
            <button
              onClick={handleInstallClick}
              className="bg-primary hover:bg-primary-hover text-white flex-1 py-2.5 px-4 text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Install App</span>
            </button>
            <button
              onClick={handleDismiss}
              className="py-2.5 px-3.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>

      {/* iOS Safari Guide Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 text-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-700 animate-slide-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <img src="/teabhatti-logo.png" alt="Tea Bhatti" className="w-8 h-8 rounded-xl object-contain" />
                <h3 className="font-heading font-extrabold text-base text-white">
                  Install on iPhone / iPad
                </h3>
              </div>
              <button onClick={() => setShowIOSGuide(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Install <strong>Cafe Management</strong> on your home screen:
            </p>

            <div className="space-y-3 bg-slate-800/80 p-4 rounded-2xl border border-slate-700/60 text-xs">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <p className="font-bold text-white flex items-center gap-1.5">
                    Tap the Share Button <Share2 className="w-4 h-4 text-blue-400 inline" />
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    Located at the bottom of Safari on iPhone (or top bar on iPad).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 pt-2 border-t border-slate-700/60">
                <div className="w-6 h-6 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <p className="font-bold text-white flex items-center gap-1.5">
                    Tap 'Add to Home Screen' <PlusSquare className="w-4 h-4 text-emerald-400 inline" />
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    Scroll down and tap <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setShowIOSGuide(false);
                handleDismiss();
              }}
              className="bg-primary hover:bg-primary-hover text-white w-full py-2.5 text-xs font-bold rounded-xl"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
}
