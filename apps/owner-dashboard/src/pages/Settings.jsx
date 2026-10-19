import React, { useState, useEffect } from 'react';
import { 
  Save, 
  CheckCircle, 
  RefreshCw, 
  Smartphone, 
  LogOut, 
  Check, 
  AlertCircle,
  Volume2,
  VolumeX,
  Bell,
  Music,
  Play,
  Trash2,
  Upload,
  Send,
  ShieldCheck,
  CreditCard,
  Radio,
  Key,
  QrCode,
  Copy,
  User
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useNotificationSound } from '../context/NotificationSoundContext.jsx';

export default function Settings() {
  const { user, updateUser, apiFetch } = useAuth();
  const { toast, confirm } = useToast();
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [waStatus, setWaStatus] = useState(null);
  const [resettingWa, setResettingWa] = useState(false);
  const [waConnectMethod, setWaConnectMethod] = useState('pairing'); // 'pairing' | 'qr'
  const [pairingPhone, setPairingPhone] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [requestingPairing, setRequestingPairing] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const {
    soundType,
    updateSoundType,
    customAudioData,
    customAudioName,
    isCloudSynced,
    isSyncing,
    uploadCustomSound,
    retrySyncCustomSound,
    removeCustomSound,
    volume,
    updateVolume,
    playAlertSound,
    permission,
    isSubscribing,
    isSubscribed,
    requestPermissionAndSubscribe,
    resetAndSubscribe,
    showNativeNotification,
  } = useNotificationSound();

  const [testingPush, setTestingPush] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);

  const handleCustomAudioUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAudio(true);
    try {
      await uploadCustomSound(file);
      toast.success(`Custom ringtone "${file.name}" saved to database & synced to all devices!`);
    } catch (err) {
      toast.error(err.message || 'Failed to upload audio');
    } finally {
      setUploadingAudio(false);
      e.target.value = '';
    }
  };

  const handleTestLiveAlert = () => {
    playAlertSound();
    showNativeNotification('Tea Bhatti Test Alert ☕', 'Sound & Live Notification is working perfectly on your device!', 'test-alert');
    toast.success('🔊 Live alert sound & notification triggered!');
  };

  const handleTestPush = async () => {
    setTestingPush(true);
    try {
      const res = await apiFetch('/notifications/push/test', { method: 'POST' });
      if (res && res.sent > 0) {
        toast.success(`✅ Test alert sent to ${res.sent} registered device(s)! Lock your phone to verify lock screen alert.`);
      } else {
        toast.error('⚠️ No active devices registered on server. Click "Re-register / Sync Phone Alerts" to register this device.');
      }
    } catch (err) {
      toast.error('Test push error: ' + err.message);
    } finally {
      setTestingPush(false);
    }
  };

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
      if (data?.pairingCodeFormatted && !pairingCode) {
        setPairingCode(data.pairingCodeFormatted);
      }
      if (data?.pairingPhone && !pairingPhone) {
        setPairingPhone(data.pairingPhone);
      }
      if (data?.ready) {
        setPairingCode('');
      }
    } catch (err) {
      console.warn('Failed to load WA status:', err.message);
      setWaStatus({ ready: false, qr: null, error: err.message });
    }
  }

  async function loadSettings() {
    try {
      const data = await apiFetch('/settings');
      setForm({
        ...data,
        ownerName: data?.ownerName || user?.name || '',
      });
      if (data?.whatsappNumber || data?.phoneNumber) {
        setPairingPhone(prev => prev || data.whatsappNumber || data.phoneNumber);
      }
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
        ownerName: form.ownerName?.trim() || user?.name || '',
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
      if (updated) {
        setForm(prev => ({
          ...prev,
          ...updated,
          ownerName: updated.ownerName || payload.ownerName,
        }));
        if (payload.ownerName && updateUser) {
          updateUser({ name: payload.ownerName });
        }
      }
      setSaved(true);
      toast.success('Settings & Owner Profile updated successfully!');
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { 
      setErrorMsg(err.message || 'Failed to update settings');
    } finally { 
      setSaving(false); 
    }
  }

  async function handleRequestPairingCode(e) {
    if (e) e.preventDefault();
    const phoneToUse = pairingPhone || form.whatsappNumber || form.phoneNumber || '';
    if (!phoneToUse.trim()) {
      toast.error('Please enter your WhatsApp mobile number.');
      return;
    }
    setRequestingPairing(true);
    try {
      const res = await apiFetch('/settings/whatsapp/pairing-code', {
        method: 'POST',
        body: { phone: phoneToUse },
      });
      if (res.code) {
        setPairingCode(res.formattedCode || res.code);
        toast.success('Pairing code generated! Enter it on your phone.');
        await loadWaStatus();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to generate pairing code');
    } finally {
      setRequestingPairing(false);
    }
  }

  function handleCopyCode() {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode.replace(/-/g, ''));
    setCopiedCode(true);
    toast.success('Pairing code copied to clipboard!');
    setTimeout(() => setCopiedCode(false), 3000);
  }

  async function handleDisconnectWa() {
    const ok = await confirm({
      title: 'Disconnect WhatsApp?',
      message: 'Are you sure you want to disconnect WhatsApp? You will need to link your phone again to reconnect.',
      confirmText: 'Disconnect',
      isDestructive: true,
    });
    if (!ok) return;

    setResettingWa(true);
    try {
      await apiFetch('/settings/whatsapp/disconnect', { method: 'POST' });
      setPairingCode('');
      toast.success('WhatsApp session reset. Ready for new connection.');
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

        {/* ── Owner Profile & Administrator Identity ── */}
        <div className="card p-4 sm:p-6 border-2 border-primary/20 bg-gradient-to-br from-white via-white to-primary/5 shadow-2xs">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-heading font-semibold text-lg text-text-primary">Owner Profile</h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Update the owner or administrator name displayed on your dashboard, invoices, and staff overview.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Owner Full Name <span className="text-primary font-bold">*</span>
              </label>
              <input
                type="text"
                value={form.ownerName ?? ''}
                onChange={e => setForm({ ...form, ownerName: e.target.value })}
                placeholder="Enter owner name"
                className="input-field font-medium text-text-primary"
                required
              />
              <p className="text-[11px] text-text-secondary mt-1">
                Shown on sidebar profile avatar, order receipts, and admin reports.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Owner Login Phone (Registered ID)
              </label>
              <input
                type="text"
                value={form.ownerPhone || user?.phone || '+917000748920'}
                disabled
                className="input-field bg-bg-subtle/80 cursor-not-allowed font-medium text-text-secondary"
              />
              <p className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-600" /> Active Verified Owner Login ID
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4 sm:p-6">
          <h2 className="font-heading font-semibold text-lg mb-4">Store & Business Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('Store / Business Name', 'name')}
            {field('Industry Type', 'industryType')}
            <div className="col-span-1 sm:col-span-2">
              {field('Store Address', 'address')}
            </div>
            {field('Public Contact Phone', 'phoneNumber')}
            {field('WhatsApp Contact Number', 'whatsappNumber')}
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

        {/* ── Order Notification & Custom Sound Settings Card ── */}
        <div className="card p-6 border-2 border-amber-500/20 bg-gradient-to-br from-white via-white to-amber-500/5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-heading font-semibold text-lg text-text-primary flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-600 animate-pulse" />
                Order & Payment Notification Sounds
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Rings loud alert sound and shows real-time top banners on new orders, customer UTR submissions, and payment verifications.
              </p>
            </div>

            {/* Permission Status Pill & Re-sync Button */}
            <div className="flex flex-wrap items-center gap-2">
              {permission === 'granted' ? (
                <>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shadow-2xs">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    {isSubscribed ? 'Web Push Active' : 'Permission Allowed'}
                  </span>
                  <button
                    type="button"
                    onClick={resetAndSubscribe}
                    disabled={isSubscribing}
                    className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1.5 border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950 font-semibold shadow-2xs"
                    title="Clean reset service worker and reconnect phone alerts"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSubscribing ? 'animate-spin' : ''}`} />
                    {isSubscribing ? 'Resetting...' : 'Reset & Reconnect Alerts'}
                  </button>
                </>
              ) : permission === 'denied' ? (
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                    Notifications Blocked
                  </span>
                  <button
                    type="button"
                    onClick={() => requestPermissionAndSubscribe(true)}
                    disabled={isSubscribing}
                    className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-xs"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    {isSubscribing ? 'Enabling...' : 'Retry Phone Alerts'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => requestPermissionAndSubscribe(true)}
                  disabled={isSubscribing}
                  className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-xs"
                >
                  <Bell className="w-3.5 h-3.5" />
                  {isSubscribing ? 'Enabling...' : 'Enable Phone Alerts'}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {/* Background Notification Status & Lock Screen Testing */}
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-amber-700 animate-pulse" />
                  Background Lock Screen Delivery (W3C Web Push)
                </span>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  When the dashboard is closed or your phone screen is locked, alerts are delivered directly to your phone's notification bar and lock screen with vibration and high urgency.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleTestLiveAlert}
                  className="btn-outline border-amber-300 bg-white hover:bg-amber-100 text-amber-950 text-xs px-3 py-1.5 flex items-center gap-1.5 shadow-2xs font-semibold"
                  title="Test synthesized or custom audio alert and native desktop notification"
                >
                  <Volume2 className="w-3.5 h-3.5 text-amber-600" />
                  Test Live Sound & Banner
                </button>

                <button
                  type="button"
                  onClick={handleTestPush}
                  disabled={testingPush}
                  className="btn-outline border-amber-300 bg-white hover:bg-amber-100 text-amber-950 text-xs px-3 py-1.5 flex items-center gap-1.5 shadow-2xs font-semibold"
                  title="Send a push notification from the server to your phone's lock screen"
                >
                  <Send className="w-3.5 h-3.5 text-amber-600" />
                  {testingPush ? 'Sending Push...' : 'Send Test Push'}
                </button>
              </div>
            </div>

            {/* Sound Selection Grid */}
            <div>
              <label className="label text-xs font-bold text-text-primary mb-2.5 block">
                Select Alert Ringtone
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { id: 'chime', name: 'Crystal Chime', desc: 'Pleasant 4-note ascending bell (Default)' },
                  { id: 'cash_register', name: 'Cash Register (Ka-Ching)', desc: 'Metallic bell chime for payments' },
                  { id: 'digital', name: 'Kitchen Digital Beeper', desc: 'Urgent 3-beep restaurant pattern' },
                  { id: 'doorbell', name: 'Warm Doorbell', desc: 'Classic two-tone Ding-Dong chime' },
                  { id: 'custom', name: 'Custom Uploaded Audio', desc: customAudioName || 'Upload your own MP3 / WAV file' },
                ].map((item) => {
                  const isSelected = soundType === item.id;
                  const isCustomOption = item.id === 'custom';
                  return (
                    <div
                      key={item.id}
                      onClick={() => updateSoundType(item.id)}
                      className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between gap-2.5 ${
                        isSelected 
                          ? 'border-primary bg-primary/5 shadow-xs ring-2 ring-primary/20' 
                          : 'border-border-subtle hover:border-border-default bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            isSelected ? 'border-primary bg-primary' : 'border-border-default'
                          }`}>
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                          </span>
                          <span className="font-bold text-xs text-text-primary">{item.name}</span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isCustomOption && !customAudioData) {
                              toast.info('Please upload a custom audio file below first.');
                              return;
                            }
                            playAlertSound(item.id);
                          }}
                          className="p-1 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Preview sound"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                        </button>
                      </div>

                      <p className="text-[11px] text-text-secondary pl-6 leading-tight">
                        {item.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom Sound File Upload Box */}
            <div className="p-4 rounded-2xl bg-bg-subtle border border-border-subtle space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-primary flex items-center gap-2">
                  <Music className="w-4 h-4 text-primary" />
                  Custom Notification Audio Upload
                </span>
                {customAudioData && (
                  <button
                    type="button"
                    onClick={removeCustomSound}
                    className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 font-semibold"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove Custom Sound
                  </button>
                )}
              </div>

              {customAudioData ? (
                <div className={`p-3 rounded-xl bg-white border ${
                  isCloudSynced ? 'border-emerald-300' : isSyncing ? 'border-amber-300' : 'border-amber-400 bg-amber-50/30'
                } flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isCloudSynced ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      <Music className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-text-primary truncate">{customAudioName || 'Custom Ringtone'}</p>
                      {isSyncing ? (
                        <p className="text-[10px] text-amber-700 font-semibold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                          <span>⏳ Syncing ringtone to database & all devices...</span>
                        </p>
                      ) : isCloudSynced ? (
                        <p className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                          <span>☁️ Saved in Database & Synced Across All Your Devices</span>
                        </p>
                      ) : (
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[10px] text-amber-800 font-semibold flex items-center gap-1">
                            <span>⚠️ Saved on this device only (Not synced to cloud)</span>
                          </p>
                          <button
                            type="button"
                            onClick={retrySyncCustomSound}
                            disabled={isSyncing}
                            className="text-[10px] px-2 py-0.5 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded font-bold transition-colors cursor-pointer"
                            title="Retry persisting to MongoDB Atlas to sync to phones and tablets"
                          >
                            Sync to All Devices
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <label className="btn-outline text-xs py-1 px-2.5 flex items-center gap-1.5 cursor-pointer bg-white hover:bg-slate-50 text-text-primary border-slate-300 font-medium">
                      <Upload className="w-3 h-3 text-slate-600" />
                      <span>{uploadingAudio ? 'Replacing...' : 'Replace Ringtone'}</span>
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleCustomAudioUpload}
                        disabled={uploadingAudio}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => playAlertSound('custom')}
                      className="btn-outline text-xs py-1 px-3 flex items-center gap-1.5 font-semibold text-primary border-primary/30 hover:bg-primary/5"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      Play Preview
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-border-default hover:border-primary rounded-xl cursor-pointer bg-white transition-colors">
                  <Upload className="w-6 h-6 text-text-secondary mb-1.5" />
                  <span className="text-xs font-bold text-text-primary">
                    {uploadingAudio ? 'Uploading to database & syncing devices...' : 'Click to upload custom sound (.mp3, .wav, .ogg)'}
                  </span>
                  <span className="text-[11px] text-text-secondary mt-0.5">
                    Maximum file size: 3MB • Saved to cloud database & auto-reflects across all phones, tablets, and PCs
                  </span>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleCustomAudioUpload}
                    disabled={uploadingAudio}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Volume Control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-text-primary flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-primary" />
                  Alert Volume: {Math.round(volume * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => playAlertSound()}
                  className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
                >
                  <Play className="w-3 h-3 fill-current" />
                  Test Current Ringtone
                </button>
              </div>

              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => updateVolume(e.target.value)}
                className="w-full accent-primary h-2 bg-border-subtle rounded-lg cursor-pointer"
              />
            </div>

            {/* Automatic Trigger Notice */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <div className="p-2.5 rounded-xl bg-white border border-border-subtle text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                <span className="text-text-secondary">Rings on <strong>New Order</strong></span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-border-subtle text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                <span className="text-text-secondary">Rings on <strong>Customer UTR</strong></span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-border-subtle text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary shrink-0"></span>
                <span className="text-text-secondary">Rings on <strong>Payment Verified</strong></span>
              </div>
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
          ) : (
            <div className="space-y-4">
              {/* Method Switcher Tabs */}
              <div className="flex items-center gap-2 p-1 bg-border-subtle/50 rounded-xl w-fit">
                <button
                  type="button"
                  onClick={() => setWaConnectMethod('pairing')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    waConnectMethod === 'pairing'
                      ? 'bg-white text-emerald-800 shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <Key className="w-3.5 h-3.5 text-emerald-600" />
                  Connect with Code (Phone Number)
                </button>
                <button
                  type="button"
                  onClick={() => setWaConnectMethod('qr')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    waConnectMethod === 'qr'
                      ? 'bg-white text-emerald-800 shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                  Scan QR Code
                </button>
              </div>

              {/* ── METHOD 1: PAIRING CODE (PHONE NUMBER) ── */}
              {waConnectMethod === 'pairing' && (
                <div>
                  {!pairingCode ? (
                    <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 animate-fade-in space-y-4">
                      <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm">
                        <Key className="w-4 h-4 text-emerald-600" />
                        <span>Link with Phone Number & 8-Digit Pairing Code</span>
                      </div>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        No camera scan needed. Enter your phone number to get an 8-character code, then type it on your phone inside WhatsApp to connect instantly.
                      </p>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <div className="relative flex-1">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-800">
                            🇮🇳 +91
                          </span>
                          <input
                            type="tel"
                            value={pairingPhone.replace(/^\+?91/, '')}
                            onChange={(e) => setPairingPhone(e.target.value)}
                            placeholder="7000748920"
                            maxLength={15}
                            className="input pl-16 w-full font-mono text-sm bg-white"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleRequestPairingCode}
                          disabled={requestingPairing}
                          className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 flex items-center justify-center gap-2 shrink-0 shadow-sm"
                        >
                          {requestingPairing ? (
                            <>
                              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                              Generating Code...
                            </>
                          ) : (
                            <>
                              <Key className="w-4 h-4" />
                              Generate Pairing Code
                            </>
                          )}
                        </button>
                      </div>

                      <div className="text-[11px] text-text-secondary flex items-center gap-1.5 pt-1">
                        <span>💡 Tip: Make sure your phone is connected to the internet before generating code.</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-400 animate-fade-in space-y-4">
                      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        {/* Big Monospace Code Display */}
                        <div className="w-full md:w-auto p-5 bg-white rounded-2xl shadow-sm border border-emerald-200 text-center flex flex-col items-center shrink-0">
                          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-1">
                            Your WhatsApp Pairing Code
                          </span>
                          <div className="text-3xl sm:text-4xl font-mono font-black tracking-widest text-emerald-700 bg-emerald-50/80 px-6 py-3 rounded-xl border border-emerald-300 select-all my-2 shadow-inner">
                            {pairingCode}
                          </div>
                          <button
                            type="button"
                            onClick={handleCopyCode}
                            className="mt-1 btn-outline border-emerald-300 text-emerald-800 hover:bg-emerald-50 text-xs px-3.5 py-1.5 flex items-center gap-1.5 font-semibold"
                          >
                            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            {copiedCode ? 'Copied to Clipboard!' : 'Copy Code'}
                          </button>
                        </div>

                        {/* Step-by-Step Instructions */}
                        <div className="flex-1 space-y-2.5 text-xs text-emerald-950">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-200/70 text-emerald-900 font-bold text-[11px]">
                            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping"></span>
                            Verify this code in your phone WhatsApp
                          </div>
                          <ol className="space-y-1.5 list-decimal list-inside text-text-secondary leading-relaxed">
                            <li>Open <strong>WhatsApp</strong> on your mobile phone.</li>
                            <li>Tap <strong>Settings</strong> (iPhone) or <strong>Three Dots ⋮</strong> (Android) &rarr; <strong>Linked Devices</strong>.</li>
                            <li>Tap <strong>Link a Device</strong>.</li>
                            <li>At the bottom of the camera scanner screen, tap <strong className="text-emerald-800">"Link with phone number instead"</strong>.</li>
                            <li>Enter the 8-character code: <span className="font-mono font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">{pairingCode}</span>.</li>
                          </ol>
                        </div>
                      </div>

                      {/* Status indicator */}
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-3 rounded-xl bg-white/80 border border-emerald-200 text-xs">
                        <span className="text-emerald-900 font-medium flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                          Waiting for you to enter the code on your phone... (Auto-connects once verified)
                        </span>
                        <button
                          type="button"
                          onClick={() => { setPairingCode(''); }}
                          className="text-emerald-700 hover:text-emerald-900 font-bold underline text-[11px]"
                        >
                          Use Different Number / Regenerate
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── METHOD 2: SCAN QR CODE ── */}
              {waConnectMethod === 'qr' && (
                <div>
                  {waStatus.qr ? (
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
              )}
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
