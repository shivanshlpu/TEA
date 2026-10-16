// ── Coupons Management & Usage Analytics Page — Tea Bhatti ──
// Coupon tracking with Total Redemptions, Unique Customer Counts,
// Single-Use Enforcement Indicators, and Modern Gourmet Aesthetic.

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { 
  Ticket, 
  Plus, 
  Pencil, 
  Trash2, 
  X, 
  AlertCircle, 
  Users, 
  CheckCircle2, 
  Sparkles, 
  Clock, 
  Percent,
  TrendingUp,
  Copy
} from 'lucide-react';

const DISCOUNT_TYPES = [
  { value: 'percentage', label: '% Percentage Off', symbol: '%' },
  { value: 'fixed', label: '₹ Flat Discount', symbol: '₹' },
];

const INITIAL_FORM = {
  code: '',
  discountType: 'percentage',
  value: '',
  expiresAt: '',
  usageLimit: '',
};

export default function Coupons() {
  const { apiFetch } = useAuth();
  const { toast, confirm } = useToast();
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => { loadCoupons(); }, []);

  async function loadCoupons() {
    setLoading(true);
    try {
      const data = await apiFetch('/coupons');
      setCoupons(data || []);
    } catch (err) {
      console.error('Load coupons error:', err);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setError('');
    setShowModal(true);
  }

  function openEdit(coupon) {
    setEditingId(coupon.id);
    setForm({
      code: coupon.code,
      discountType: coupon.discountType === 'free_delivery' ? 'percentage' : coupon.discountType,
      value: coupon.value.toString(),
      expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt).toISOString().slice(0, 16) : '',
      usageLimit: coupon.usageLimit?.toString() || '',
    });
    setError('');
    setShowModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = {
        code: form.code.toUpperCase(),
        discountType: form.discountType,
        value: parseFloat(form.value),
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
        usageLimit: form.usageLimit ? parseInt(form.usageLimit) : undefined,
      };

      if (editingId) {
        await apiFetch(`/coupons/${editingId}`, { method: 'PUT', body });
      } else {
        await apiFetch('/coupons', { method: 'POST', body });
      }

      setShowModal(false);
      loadCoupons();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    const ok = await confirm({
      title: 'Delete Coupon?',
      message: 'Are you sure you want to delete this promotional coupon?',
      confirmText: 'Delete Coupon',
      isDestructive: true,
    });
    if (!ok) return;

    try {
      await apiFetch(`/coupons/${id}`, { method: 'DELETE' });
      toast.success('Coupon deleted successfully');
      loadCoupons();
    } catch (err) {
      toast.error(err.message || 'Failed to delete coupon');
    }
  }

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const isExpired = (c) => c.expiresAt && new Date(c.expiresAt) < new Date();
  const isUsedUp = (c) => c.usageLimit && (c.usedCount || 0) >= c.usageLimit;

  // Aggregate Metrics
  const totalRedemptions = coupons.reduce((sum, c) => sum + (c.usedCount || 0), 0);
  const totalUniquePeople = coupons.reduce((sum, c) => sum + (c.uniqueUsersCount || 0), 0);
  const activeCoupons = coupons.filter(c => !isExpired(c) && !isUsedUp(c)).length;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full bg-primary text-white">
              Marketing & Promotions
            </span>
            <span className="text-xs text-text-secondary font-medium">
              Single-use per customer enforced
            </span>
          </div>
          <h1 className="text-2xl font-heading font-black text-text-primary tracking-tight">
            Coupons & Customer Usage
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Monitor real-time coupon redemptions, distinct customers who redeemed, and discount performance.
          </p>
        </div>

        <button
          onClick={openCreate}
          className="btn-primary px-5 py-2.5 text-xs font-bold flex items-center gap-2 self-start sm:self-auto shadow-md"
        >
          <Plus className="w-4 h-4" />
          Create New Coupon
        </button>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="card p-4 sm:p-5 border-2 border-border-subtle bg-white shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-text-secondary uppercase">Active Codes</span>
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Ticket className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-mono font-black text-text-primary">{activeCoupons}</div>
          <span className="text-[11px] text-text-secondary font-medium">Ready for customer checkout</span>
        </div>

        <div className="card p-4 sm:p-5 border-2 border-border-subtle bg-white shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-text-secondary uppercase">Total Redemptions</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-mono font-black text-amber-800">{totalRedemptions}</div>
          <span className="text-[11px] text-text-secondary font-medium">Total times codes applied</span>
        </div>

        <div className="card p-4 sm:p-5 border-2 border-emerald-300/80 bg-emerald-50/40 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-900 uppercase">Unique Customers</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-mono font-black text-emerald-800">{totalUniquePeople}</div>
          <span className="text-[11px] text-emerald-700 font-medium">Distinct people who used codes</span>
        </div>

        <div className="card p-4 sm:p-5 border-2 border-border-subtle bg-white shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-text-secondary uppercase">Single-Use Security</span>
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-sm font-bold text-emerald-700 pt-1">Active & Enforced</div>
          <span className="text-[11px] text-text-secondary font-medium">Prevents duplicate abuse</span>
        </div>
      </div>

      {/* Coupon List Table / Cards */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(n => <div key={n} className="card p-6 h-28 animate-pulse bg-white/70" />)}
        </div>
      ) : coupons.length === 0 ? (
        <div className="card p-12 text-center bg-white border border-border-subtle">
          <Ticket className="w-12 h-12 text-border-subtle mx-auto mb-3" />
          <h3 className="font-heading font-bold text-base text-text-primary">No Coupons Configured</h3>
          <p className="text-xs text-text-secondary mt-1 mb-4">Create discount codes to incentivize store pickup bookings.</p>
          <button onClick={openCreate} className="btn-primary text-xs px-5 py-2 font-bold inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Create First Coupon
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {coupons.map(coupon => {
            const expired = isExpired(coupon);
            const usedUp = isUsedUp(coupon);
            const inactive = expired || usedUp;
            const usedCount = coupon.usedCount || 0;
            const uniquePeople = coupon.uniqueUsersCount || 0;

            return (
              <div 
                key={coupon.id} 
                className={`card p-5 border-2 transition-all hover:shadow-md bg-white ${
                  inactive ? 'opacity-70 border-border-subtle' : 'border-border-subtle hover:border-primary/30'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left: Code + Discount Value */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Code Badge */}
                    <div className="relative group shrink-0">
                      <div className={`px-4 py-2.5 rounded-2xl font-mono font-black text-sm border-2 border-dashed flex items-center gap-2 ${
                        inactive 
                          ? 'border-border-subtle text-text-secondary bg-bg-subtle' 
                          : 'border-primary text-primary bg-primary/5'
                      }`}>
                        <span>{coupon.code}</span>
                        <button
                          onClick={() => handleCopy(coupon.code)}
                          className="text-text-secondary hover:text-primary transition-colors"
                          title="Copy Code"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {copiedCode === coupon.code && (
                        <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                          Copied!
                        </span>
                      )}
                    </div>

                    {/* Discount & Expiration */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-heading font-black text-base text-text-primary">
                          {coupon.discountType === 'percentage' && `${coupon.value}% OFF`}
                          {coupon.discountType === 'fixed' && `₹${coupon.value} FLAT OFF`}
                        </span>

                        {expired && <span className="text-[10px] font-bold bg-error/15 text-error px-2.5 py-0.5 rounded-full">Expired</span>}
                        {usedUp && <span className="text-[10px] font-bold bg-error/15 text-error px-2.5 py-0.5 rounded-full">Limit Reached</span>}
                        {!inactive && <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">Active</span>}
                        <span className="text-[10px] font-medium bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">
                          1 Use Per Customer
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-text-secondary mt-1">
                        <Clock className="w-3.5 h-3.5 text-text-secondary" />
                        <span>
                          {coupon.expiresAt ? `Expires on ${new Date(coupon.expiresAt).toLocaleDateString([], { dateStyle: 'medium' })}` : 'No Expiry Date'}
                        </span>
                        {coupon.usageLimit && (
                          <span>• Limit: {coupon.usageLimit} total redemptions</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Middle: Usage Metrics — Specifically how many people used it */}
                  <div className="flex items-center gap-6 bg-bg-base/70 px-5 py-3 rounded-2xl border border-border-subtle shrink-0">
                    <div className="text-center">
                      <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider block">
                        Used Count
                      </span>
                      <span className="text-lg font-mono font-black text-text-primary">
                        {usedCount} {coupon.usageLimit ? `/ ${coupon.usageLimit}` : 'times'}
                      </span>
                    </div>

                    <div className="h-8 w-px bg-border-subtle" />

                    <div className="text-center">
                      <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider block flex items-center justify-center gap-1">
                        <Users className="w-3 h-3 text-emerald-600" />
                        People Used
                      </span>
                      <span className="text-lg font-mono font-black text-emerald-700">
                        {uniquePeople} customers
                      </span>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button 
                      onClick={() => openEdit(coupon)} 
                      className="p-2 text-text-secondary hover:text-primary hover:bg-primary/10 rounded-xl transition-colors"
                      title="Edit Coupon"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(coupon.id)} 
                      className="p-2 text-text-secondary hover:text-error hover:bg-error/10 rounded-xl transition-colors"
                      title="Delete Coupon"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in" onClick={() => setShowModal(false)}>
          <div className="card max-w-md w-full p-4 sm:p-6 bg-white rounded-3xl shadow-2xl border border-border-subtle max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-4 border-b border-border-subtle mb-5">
              <h2 className="text-lg font-heading font-black text-text-primary">
                {editingId ? 'Edit Coupon Code' : 'Create New Coupon Code'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-full hover:bg-bg-subtle text-text-secondary min-h-[36px] min-w-[36px] flex items-center justify-center">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 mb-4 rounded-xl bg-error/10 border border-error/20 text-xs text-error font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Coupon Code</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. WELCOME20"
                  required
                  className="input-field font-mono font-bold uppercase tracking-wider text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Discount Type</label>
                  <select
                    value={form.discountType}
                    onChange={(e) => setForm(f => ({ ...f, discountType: e.target.value }))}
                    className="input-field text-xs font-semibold"
                  >
                    {DISCOUNT_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                    Value ({form.discountType === 'percentage' ? '%' : '₹'})
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={form.discountType === 'percentage' ? '100' : '9999'}
                    value={form.value}
                    onChange={(e) => setForm(f => ({ ...f, value: e.target.value }))}
                    placeholder={form.discountType === 'percentage' ? '20' : '100'}
                    required
                    className="input-field font-mono font-bold text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Expiration Date (Optional)</label>
                <input
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                  className="input-field text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Total Usage Limit (Optional)</label>
                <input
                  type="number"
                  min="1"
                  value={form.usageLimit}
                  onChange={(e) => setForm(f => ({ ...f, usageLimit: e.target.value }))}
                  placeholder="e.g. 100 total redemptions"
                  className="input-field text-xs"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-outline flex-1 py-2.5 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1 py-2.5 text-xs font-bold"
                >
                  {saving ? 'Saving...' : editingId ? 'Update Coupon' : 'Create Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
