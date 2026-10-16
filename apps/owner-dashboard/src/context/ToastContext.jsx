// ── Professional Toast & Modal Dialog System for Owner Dashboard ──
// Replaces all crude window.alert() and window.confirm() dialogs
// with elegant, luxury branded cafe feedback toasts and confirmation modals.

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  X, 
  HelpCircle 
} from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const confirmResolveRef = useRef(null);

  // ── Show Toast Notification ──
  const showToast = useCallback((message, type = 'info', title = null, duration = 4000) => {
    if (!message) return;
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    
    // Auto-detect title if not given
    const defaultTitle = {
      success: 'Success',
      error: 'Error',
      warning: 'Attention',
      info: 'Notification',
    }[type] || 'Notice';

    const newToast = {
      id,
      type,
      title: title || defaultTitle,
      message: typeof message === 'string' ? message : (message.message || JSON.stringify(message)),
      duration,
    };

    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const toast = {
    success: (msg, title) => showToast(msg, 'success', title),
    error: (msg, title) => showToast(msg, 'error', title),
    warning: (msg, title) => showToast(msg, 'warning', title),
    info: (msg, title) => showToast(msg, 'info', title),
  };

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Promise-based In-App Confirm Dialog (replaces window.confirm) ──
  const confirm = useCallback(({ 
    title = 'Confirm Action', 
    message = 'Are you sure you want to proceed?', 
    confirmText = 'Confirm', 
    cancelText = 'Cancel', 
    isDestructive = false 
  }) => {
    return new Promise((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirmDialog({
        title,
        message,
        confirmText,
        cancelText,
        isDestructive,
      });
    });
  }, []);

  const handleConfirmResolve = (result) => {
    if (confirmResolveRef.current) {
      confirmResolveRef.current(result);
      confirmResolveRef.current = null;
    }
    setConfirmDialog(null);
  };

  return (
    <ToastContext.Provider value={{ showToast, toast, confirm }}>
      {children}

      {/* Floating Toast Container (Top-Right / Mobile Top-Center) */}
      <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-[9999] pointer-events-none flex flex-col gap-2.5">
        {toasts.map((t) => {
          const config = {
            success: {
              border: 'border-emerald-500/40',
              bg: 'bg-emerald-950/95 text-white',
              badge: 'bg-emerald-500/20 text-emerald-300',
              icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />,
            },
            error: {
              border: 'border-rose-500/40',
              bg: 'bg-rose-950/95 text-white',
              badge: 'bg-rose-500/20 text-rose-300',
              icon: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />,
            },
            warning: {
              border: 'border-amber-500/40',
              bg: 'bg-amber-950/95 text-white',
              badge: 'bg-amber-500/20 text-amber-300',
              icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />,
            },
            info: {
              border: 'border-sky-500/40',
              bg: 'bg-neutral-900/95 text-white',
              badge: 'bg-sky-500/20 text-sky-300',
              icon: <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />,
            },
          }[t.type] || {
            border: 'border-neutral-700',
            bg: 'bg-neutral-900/95 text-white',
            badge: 'bg-neutral-800 text-neutral-300',
            icon: <Info className="w-5 h-5 text-neutral-400 shrink-0 mt-0.5" />,
          };

          return (
            <div
              key={t.id}
              className={`pointer-events-auto p-4 rounded-2xl shadow-2xl backdrop-blur-md border ${config.border} ${config.bg} flex items-start gap-3 transition-all duration-300 animate-slide-in`}
              style={{ animation: 'slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
              {config.icon}
              <div className="flex-1 min-w-0 pr-1">
                <p className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  {t.title}
                </p>
                <p className="text-sm font-semibold text-white/95 mt-0.5 leading-snug break-words">
                  {t.message}
                </p>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Modern In-App Confirmation Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl border border-border-subtle text-center space-y-4 animate-scale-up">
            <div className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center ${
              confirmDialog.isDestructive ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-700'
            }`}>
              {confirmDialog.isDestructive ? (
                <AlertTriangle className="w-7 h-7" />
              ) : (
                <HelpCircle className="w-7 h-7" />
              )}
            </div>

            <div>
              <h3 className="font-heading font-black text-lg text-text-primary">
                {confirmDialog.title}
              </h3>
              <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
                {confirmDialog.message}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => handleConfirmResolve(false)}
                className="btn-outline py-2.5 px-4 text-xs font-bold"
              >
                {confirmDialog.cancelText}
              </button>

              <button
                onClick={() => handleConfirmResolve(true)}
                className={`py-2.5 px-4 rounded-button text-xs font-bold text-white shadow-md transition-all ${
                  confirmDialog.isDestructive
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-primary hover:bg-primary-hover'
                }`}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
