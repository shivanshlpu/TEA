// ── Professional Toast & Modal Dialog System for Customer Web ──
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
  const showToast = useCallback((message, type = 'info', title = null, duration = 3500) => {
    if (!message) return;
    const msgStr = typeof message === 'string' ? message : (message.message || JSON.stringify(message));

    // Deduplication: do not add duplicate toast if same message is already visible
    setToasts((prev) => {
      if (prev.some((t) => t.message === msgStr && t.type === type)) {
        return prev;
      }
      const id = Date.now() + Math.random().toString(36).substring(2, 6);
      const defaultTitle = {
        success: 'Success',
        error: 'Notice',
        warning: 'Attention',
        info: 'Update',
      }[type] || 'Notice';

      const newToast = {
        id,
        type,
        title: title || defaultTitle,
        message: msgStr,
        duration,
      };

      if (duration > 0) {
        setTimeout(() => {
          setToasts((current) => current.filter((t) => t.id !== id));
        }, duration);
      }

      return [...prev, newToast];
    });
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

      {/* Floating Toast Container */}
      <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-80 z-[9999] pointer-events-none flex flex-col gap-2">
        {toasts.map((t) => {
          const config = {
            success: {
              border: 'border-emerald-500/30',
              bg: 'bg-neutral-900/95 text-white',
              icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />,
            },
            error: {
              border: 'border-rose-500/30',
              bg: 'bg-neutral-900/95 text-white',
              icon: <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />,
            },
            warning: {
              border: 'border-amber-500/30',
              bg: 'bg-neutral-900/95 text-white',
              icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />,
            },
            info: {
              border: 'border-neutral-700/60',
              bg: 'bg-neutral-900/95 text-white',
              icon: <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />,
            },
          }[t.type] || {
            border: 'border-neutral-700',
            bg: 'bg-neutral-900/95 text-white',
            icon: <Info className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />,
          };

          return (
            <div
              key={t.id}
              className={`pointer-events-auto p-3 px-3.5 rounded-xl shadow-xl backdrop-blur-md border ${config.border} ${config.bg} flex items-start gap-2.5 transition-all duration-300 animate-slide-in`}
              style={{ animation: 'slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
              {config.icon}
              <div className="flex-1 min-w-0 pr-1">
                {t.title && !['Notice', 'Update', 'Error', 'Success', 'Attention'].includes(t.title) && (
                  <p className="text-[11px] font-bold text-neutral-300 mb-0.5">{t.title}</p>
                )}
                <p className="text-xs font-medium text-white/95 leading-snug break-words">
                  {t.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="p-1 rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
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
                    : 'btn-primary'
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
