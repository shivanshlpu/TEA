// ── Store Status Toggle & Emergency Off Modal — Tea Bhatti Owner Dashboard ──
// Instant 1-click toggle on the dashboard header with reason popup.
// Real-time synchronization across staff screens and customer apps via Socket.io.

import React, { useState, useEffect } from 'react';
import { Power, AlertTriangle, Check, X, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';
import { useAuth, SOCKET_URL } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { io } from 'socket.io-client';

const REASON_PRESETS = [
  'Unable to accept orders due to a power outage',
  'Kitchen is at full capacity. Resuming shortly!',
  'Store closed for scheduled maintenance & cleaning',
  'Heavy rainstorm / Internet connectivity issue',
  'Staff shortage / Emergency break',
  'Raw materials restocking in progress',
];

export default function StoreStatusToggle({ className = '' }) {
  const { apiFetch, user } = useAuth();
  const { toast } = useToast();

  const [isOnline, setIsOnline] = useState(true);
  const [closureReason, setClosureReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState(REASON_PRESETS[0]);
  const [customReason, setCustomReason] = useState('');

  useEffect(() => {
    loadStoreStatus();

    // Listen to real-time status updates via socket
    const socket = io(SOCKET_URL);
    socket.on('store-status-changed', (data) => {
      setIsOnline(data.isAcceptingOrders);
      setClosureReason(data.closureReason || '');
    });

    socket.on('settings-updated', (data) => {
      if (data.isAcceptingOrders !== undefined) {
        setIsOnline(data.isAcceptingOrders);
        setClosureReason(data.closureReason || '');
      }
    });

    return () => socket.disconnect();
  }, []);

  async function loadStoreStatus() {
    try {
      const data = await apiFetch('/settings/store-status');
      setIsOnline(data.isAcceptingOrders !== false);
      setClosureReason(data.closureReason || '');
    } catch (err) {
      console.warn('Failed to fetch store status:', err);
    } finally {
      setLoading(false);
    }
  }

  // Handle direct click
  const handleToggleClick = () => {
    if (isOnline) {
      // If currently Online, show the reason modal before turning OFF
      setSelectedReason(REASON_PRESETS[0]);
      setCustomReason('');
      setShowModal(true);
    } else {
      // If currently Offline, immediately turn back ON
      turnStoreOn();
    }
  };

  // Turn store ON
  async function turnStoreOn() {
    setSaving(true);
    try {
      const res = await apiFetch('/settings/store-status', {
        method: 'PATCH',
        body: { isAcceptingOrders: true, closureReason: null },
      });
      setIsOnline(true);
      setClosureReason('');
      toast.success(res.message || 'Tea Bhatti is now Online & accepting orders!');
    } catch (err) {
      toast.error(err.message || 'Failed to turn store online');
    } finally {
      setSaving(false);
    }
  }

  // Confirm turning store OFF with selected reason
  async function handleConfirmTurnOff() {
    const finalReason = customReason.trim() || selectedReason;
    if (!finalReason) {
      toast.error('Please specify a reason for pausing orders');
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch('/settings/store-status', {
        method: 'PATCH',
        body: { isAcceptingOrders: false, closureReason: finalReason },
      });
      setIsOnline(false);
      setClosureReason(finalReason);
      setShowModal(false);
      toast.info(res.message || 'Store turned OFF');
    } catch (err) {
      toast.error(err.message || 'Failed to turn store offline');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={`h-9 w-28 rounded-xl bg-bg-subtle animate-pulse ${className}`} />
    );
  }

  return (
    <>
      {/* Toggle Pill / Button */}
      <button
        type="button"
        onClick={handleToggleClick}
        disabled={saving}
        title={isOnline ? 'Click to turn store OFF (Pause Orders)' : `Store Offline: ${closureReason || 'Click to turn ON'}`}
        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border shadow-sm select-none ${
          isOnline
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100/80 hover:border-emerald-400'
            : 'bg-red-500 border-red-600 text-white hover:bg-red-600 animate-pulse'
        } ${className}`}
      >
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
          isOnline ? 'bg-emerald-600 animate-pulse' : 'bg-white'
        }`} />
        
        <span className="font-extrabold tracking-tight">
          {isOnline ? 'Store: ON' : 'Store: OFF'}
        </span>

        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
          isOnline 
            ? 'bg-emerald-200/60 text-emerald-950' 
            : 'bg-red-700 text-white'
        }`}>
          {isOnline ? 'Turn OFF' : 'Turn ON'}
        </span>
      </button>

      {/* Pop-up Modal when clicking 'Turn OFF' */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="card max-w-md w-full p-6 bg-white shadow-2xl rounded-3xl space-y-4 border border-border-subtle">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <Power className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-black text-base text-text-primary">
                    Pause Store Orders (Turn OFF)
                  </h3>
                  <p className="text-[11px] text-text-secondary">
                    Customers will see this reason at checkout and on the menu.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 text-text-secondary hover:text-text-primary rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Reason Presets */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-text-primary">
                Select Reason for Pausing:
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {REASON_PRESETS.map((preset) => (
                  <label
                    key={preset}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                      selectedReason === preset && !customReason
                        ? 'bg-red-50 border-red-300 text-red-950 font-bold'
                        : 'bg-bg-base/60 border-border-subtle text-text-secondary hover:bg-bg-subtle hover:text-text-primary'
                    }`}
                  >
                    <input
                      type="radio"
                      name="closureReason"
                      value={preset}
                      checked={selectedReason === preset && !customReason}
                      onChange={() => {
                        setSelectedReason(preset);
                        setCustomReason('');
                      }}
                      className="mt-0.5 accent-red-600"
                    />
                    <span className="leading-tight">{preset}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Custom Reason write-in */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-bold text-text-primary">
                Or Type Custom Reason:
              </label>
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="e.g. Kitchen equipment repair in progress"
                className="input-field text-xs py-2 bg-white"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-border-subtle">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="btn-outline flex-1 py-2.5 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmTurnOff}
                disabled={saving}
                className="btn-primary flex-1 py-2.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-1.5"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    <Power className="w-3.5 h-3.5" />
                    <span>Turn Store OFF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
