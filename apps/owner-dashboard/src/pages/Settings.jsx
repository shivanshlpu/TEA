// ── Settings Page ──
import React, { useState, useEffect } from 'react';
import { Save, CheckCircle, RefreshCw, Smartphone, LogOut, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function Settings() {
  const { apiFetch } = useAuth();
  const { toast, confirm } = useToast();
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [waStatus, setWaStatus] = useState(null);
  const [resettingWa, setResettingWa] = useState(false);

  useEffect(() => { 
    loadSettings(); 
    loadWaStatus();
    const waInterval = setInterval(loadWaStatus, 3500);
    return () => clearInterval(waInterval);
  }, []);

  async function loadWaStatus() {
    try {
      const data = await apiFetch('/settings/whatsapp-status');
      setWaStatus(data);
    } catch (err) {
      console.warn('Failed to load WA status:', err.message);
      setWaStatus({ ready: false, qr: null, error: err.message });
    }
  }

  async function loadSettings() {
    try {
      const data = await apiFetch('/settings');
      setForm(data);
    } catch (err) { 
      console.error(err); 
    } finally { 
      setLoading(false); 
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    try {
      const payload = {
        name: form.name?.trim() || 'Tea Bhatti',
        industryType: form.industryType?.trim() || 'Cafe',
        address: form.address?.trim() || '',
        phoneNumber: form.phoneNumber?.trim() || '',
        whatsappNumber: form.whatsappNumber?.trim() || '',
        openingTime: form.openingTime?.trim() || '10:00',
        closingTime: form.closingTime?.trim() || '20:00',
        isAcceptingOrders: form.isAcceptingOrders !== false,
        closureReason: form.closureReason?.trim() || '',
        closedDays: Array.isArray(form.closedDays) ? form.closedDays : [],
        upiId: form.upiId?.trim() || '',
        qrCodeUrl: form.qrCodeUrl?.trim() || '',
        gstNumber: form.gstNumber?.trim() || '',
        // Paused / coming soon values (zero for direct store pickup)
        deliveryRadiusKm: 0,
        minOrderAmount: 0,
        packingCharge: 0,
        deliveryCharge: 0,
      };

      const updated = await apiFetch('/settings', { method: 'PUT', body: payload });
      if (updated) setForm(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { 
      setErrorMsg(err.message || 'Failed to update settings');
    } finally { 
      setSaving(false); 
    }
  }

  async function handleDisconnectWa() {
    const ok = await confirm({
      title: 'Disconnect WhatsApp?',
      message: 'Are you sure you want to disconnect WhatsApp? You will need to scan a new QR code to reconnect.',
      confirmText: 'Disconnect',
      isDestructive: true,
    });
    if (!ok) return;

    setResettingWa(true);
    try {
      await apiFetch('/settings/whatsapp/disconnect', { method: 'POST' });
      toast.success('WhatsApp session reset. Generating new QR code...');
      await loadWaStatus();
    } catch (err) {
      toast.error('Failed to reset session: ' + err.message);
    } finally {
      setResettingWa(false);
    }
  }

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const toggleClosedDay = (day) => {
    const currentDays = Array.isArray(form.closedDays) ? [...form.closedDays] : [];
    if (currentDays.includes(day)) {
      setForm({ ...form, closedDays: currentDays.filter(d => d !== day) });
    } else {
      setForm({ ...form, closedDays: [...currentDays, day] });
    }
  };

  const field = (label, key, type = 'text', props = {}) => (
    <div>
      <label className="block text-sm font-medium text-text-primary mb-1">{label}</label>
      <input
        type={type}
        value={form[key] ?? ''}
        onChange={e => setForm({ ...form, [key]: type === 'number' ? (e.target.value === '' ? '' : parseFloat(e.target.value)) : e.target.value })}
        className="input-field"
        {...props}
      />
    </div>
  );

  if (loading) return <div className="card p-8 text-center animate-pulse">Loading settings...</div>;

  return (
    <div className="animate-fade-in max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-text-primary">Business Settings</h1>
          <p className="text-xs text-text-secondary mt-0.5">Manage store details, operating hours, emergency closure, and live WhatsApp.</p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-error/10 border border-error/30 text-error text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {saved && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 shrink-0" />
          <span>Business settings updated successfully!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* ── Emergency Store Acceptance & Outage Control ── */}
        <div className={`card p-4 sm:p-6 border-2 transition-all ${
          form.isAcceptingOrders === false
            ? 'border-red-400 bg-red-50/40 shadow-sm'
            : 'border-emerald-300 bg-emerald-50/30'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-heading font-bold text-base text-text-primary flex items-center gap-2">
                <span>{form.isAcceptingOrders === false ? '🔴 Store is Offline' : '🟢 Store is Online'}</span>
                <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                  form.isAcceptingOrders === false ? 'bg-red-200 text-red-900' : 'bg-emerald-200 text-emerald-900'
                }`}>
                  {form.isAcceptingOrders === false ? 'Not Accepting Orders' : 'Accepting Orders'}
                </span>
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Toggle to immediately stop accepting orders during power outages, equipment issues, or high kitchen rushes.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setForm({ ...form, isAcceptingOrders: form.isAcceptingOrders === false ? true : false })}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                form.isAcceptingOrders === false
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {form.isAcceptingOrders === false ? 'Turn Store ON' : 'Turn Store OFF (Emergency)'}
            </button>
          </div>

          {form.isAcceptingOrders === false && (
            <div className="mt-3 pt-3 border-t border-red-200/80 space-y-3 animate-fade-in">
              <label className="block text-xs font-bold text-red-950">
                Reason for Pausing Orders (Shown to customers during checkout):
              </label>
              <input
                type="text"
                value={form.closureReason || ''}
                onChange={e => setForm({ ...form, closureReason: e.target.value })}
                placeholder="e.g. Unable to accept orders due to a power outage"
                className="input-field text-xs bg-white border-red-300 focus:border-red-500 w-full font-medium"
              />

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[11px] text-text-secondary self-center mr-1">Quick Reasons:</span>
                {[
                  'Unable to accept orders due to a power outage',
                  'Kitchen is at full capacity. Back in 30 minutes!',
                  'Store closed for scheduled maintenance',
                  'Rainstorm / Internet connectivity issue',
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setForm({ ...form, closureReason: reason })}
                    className="text-[10px] font-medium px-2 py-1 bg-white hover:bg-red-100/70 text-text-primary rounded-lg border border-red-200 transition-colors"
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Operating Hours & Weekly Closed Days ── */}
        <div className="card p-4 sm:p-6 space-y-5">
          <div>
            <h2 className="font-heading font-semibold text-lg text-text-primary">Operating Hours & Working Days</h2>
            <p className="text-xs text-text-secondary mt-0.5">Define your daily pickup window and days when Tea Bhatti is closed.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('Daily Opening Time', 'openingTime', 'time')}
            {field('Daily Closing Time', 'closingTime', 'time')}
          </div>

          <div className="pt-3 border-t border-border-subtle">
            <label className="block text-xs font-bold text-text-primary mb-2">
              Mark Shop Closed on Specific Days of the Week:
            </label>
            <p className="text-[11px] text-text-secondary mb-3">
              Click a day to toggle it. Orders will be blocked with a clear notice on selected closed days.
            </p>
            <div className="flex flex-wrap gap-2">
              {DAYS.map(day => {
                const isClosed = Array.isArray(form.closedDays) && form.closedDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleClosedDay(day)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      isClosed
                        ? 'bg-red-100 text-red-800 border-2 border-red-400 shadow-2xs'
                        : 'bg-bg-subtle text-text-secondary hover:text-text-primary border border-border-subtle'
                    }`}
                  >
                    <span>{isClosed ? '✕' : '✓'}</span>
                    <span>{day}</span>
                    <span className="text-[10px] opacity-75">{isClosed ? '(Closed)' : '(Open)'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="card p-4 sm:p-6">
          <h2 className="font-heading font-semibold text-lg mb-4">General Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('Business Name', 'name')}
            {field('Industry Type', 'industryType')}
            <div className="col-span-1 sm:col-span-2">
              {field('Address', 'address')}
            </div>
            {field('Phone', 'phoneNumber')}
            {field('WhatsApp Contact', 'whatsappNumber')}
          </div>
        </div>

        {/* ── Paused Features (Store Charges, Delivery Radius, Min Order) ── */}
        <div className="card p-4 sm:p-6 border-2 border-dashed border-amber-300 bg-amber-50/50">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-amber-800 font-bold text-sm">⏸️ Store Charges & Delivery Operations</span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 uppercase tracking-wider">
                Paused · Coming Soon
              </span>
            </div>
            <span className="text-xs font-bold text-amber-800 bg-white/80 px-2 py-0.5 rounded-md border border-amber-200">
              ₹0 Extra Fee
            </span>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed mb-4">
            Delivery Radius, Min Order Amount, Packing Charges, and Delivery Charges are currently paused because <strong>Tea Bhatti</strong> is dedicated to 100% store pickup with zero extra fees.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-xs">
            <div className="p-2.5 sm:p-3 rounded-xl bg-white/90 border border-amber-200/70 shadow-2xs">
              <span className="text-text-secondary block text-[10px] uppercase font-bold tracking-wider">Delivery Radius</span>
              <span className="font-bold text-text-primary mt-1 block">Paused</span>
              <span className="text-[10px] text-amber-700">Store Pickup only</span>
            </div>
            <div className="p-2.5 sm:p-3 rounded-xl bg-white/90 border border-amber-200/70 shadow-2xs">
              <span className="text-text-secondary block text-[10px] uppercase font-bold tracking-wider">Min Order Amount</span>
              <span className="font-bold text-text-primary mt-1 block">₹0</span>
              <span className="text-[10px] text-emerald-700">No minimum limit</span>
            </div>
            <div className="p-2.5 sm:p-3 rounded-xl bg-white/90 border border-amber-200/70 shadow-2xs">
              <span className="text-text-secondary block text-[10px] uppercase font-bold tracking-wider">Packing Charge</span>
              <span className="font-bold text-text-primary mt-1 block">₹0</span>
              <span className="text-[10px] text-emerald-700">Free packaging</span>
            </div>
            <div className="p-2.5 sm:p-3 rounded-xl bg-white/90 border border-amber-200/70 shadow-2xs">
              <span className="text-text-secondary block text-[10px] uppercase font-bold tracking-wider">Delivery Charge</span>
              <span className="font-bold text-text-primary mt-1 block">₹0</span>
              <span className="text-[10px] text-emerald-700">No delivery fees</span>
            </div>
          </div>
        </div>

        <div className="card p-4 sm:p-6">
          <h2 className="font-heading font-semibold text-lg mb-4">Payment Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('UPI ID', 'upiId')}
            {field('QR Code URL', 'qrCodeUrl')}
            <div className="col-span-1 sm:col-span-2">
              {field('GST Number', 'gstNumber')}
            </div>
          </div>
        </div>

        {/* ── WhatsApp Integration Card (Baileys Engine) ── */}
        <div className="card p-6 border-2 border-primary/20 bg-gradient-to-br from-white via-white to-primary/5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-heading font-semibold text-lg text-text-primary flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-600" />
                WhatsApp Web Integration (Baileys)
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Powers automated order pickup alerts, 10m reminders, and Swiggy-style marketing messages.
              </p>
            </div>
            <button
              type="button"
              onClick={loadWaStatus}
              title="Refresh status"
              className="p-1.5 rounded-lg border border-border-subtle hover:bg-bg-subtle text-text-secondary hover:text-text-primary transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          
          {!waStatus ? (
            <div className="p-4 rounded-xl bg-bg-subtle text-xs text-text-secondary flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
              Checking WhatsApp status...
            </div>
          ) : waStatus.ready ? (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse"></span>
                  <span className="font-bold text-sm text-emerald-900">Connected & Ready</span>
                </div>
                <p className="text-xs text-emerald-800">
                  Active WhatsApp: <span className="font-mono font-bold">{waStatus.phone || '+91 90091 49694'}</span> ({waStatus.name})
                </p>
                <p className="text-[11px] text-emerald-700">
                  Persistent session active. Reconnects automatically on server restart.
                </p>
              </div>

              <button
                type="button"
                onClick={handleDisconnectWa}
                disabled={resettingWa}
                className="btn-outline border-emerald-300 text-emerald-900 hover:bg-emerald-100 text-xs px-3 py-1.5 flex items-center gap-1.5 shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                {resettingWa ? 'Resetting...' : 'Disconnect Account'}
              </button>
            </div>
          ) : waStatus.qr ? (
            <div className="flex flex-col sm:flex-row items-center gap-6 p-5 rounded-2xl bg-amber-50 border border-amber-200 animate-fade-in">
              <div className="p-2 bg-white rounded-2xl shadow-md border border-amber-200 shrink-0">
                <img 
                  src={waStatus.qr.startsWith('data:') ? waStatus.qr : `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(waStatus.qr)}`} 
                  alt="WhatsApp Web QR Code"
                  className="w-44 h-44 rounded-xl object-contain"
                />
              </div>

              <div className="space-y-2.5 text-xs text-[#4A382A]">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-200/60 text-amber-900 font-bold text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping"></span>
                  Scan with WhatsApp to Connect
                </div>
                <ol className="space-y-1 list-decimal list-inside text-text-secondary leading-relaxed">
                  <li>Open <strong>WhatsApp</strong> on your phone.</li>
                  <li>Tap <strong>Settings / Linked Devices</strong>.</li>
                  <li>Tap <strong>Link a Device</strong> and point your camera at this QR code.</li>
                </ol>
                <div className="p-2 rounded-lg bg-white/70 border border-amber-200 text-[11px] text-amber-900">
                  🛡️ <strong>Multi-Device Persistence:</strong> Session is permanently stored in your database and stays connected 24/7 without logging out.
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-bg-subtle text-xs text-text-secondary flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
              Generating live Baileys WhatsApp QR code... Please wait a moment.
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 pt-2">
          <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2">
            {saving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Settings</>}
          </button>
          {saved && (
            <span className="text-success font-medium inline-flex items-center gap-1 animate-fade-in">
              <Check className="w-4 h-4" /> Settings Updated Successfully!
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
