// ── Customers CRM Page ──
// Customer list with search + filters, detail modal, bulk WhatsApp action.
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Users, Search, Star, Clock, Crown, Send, X, ChevronRight, Package, Gift } from 'lucide-react';

const FILTERS = [
  { key: 'all', label: 'All Customers', icon: Users },
  { key: 'premium', label: 'Premium', icon: Crown },
  { key: 'new', label: 'New (30d)', icon: Star },
  { key: 'inactive', label: 'Inactive', icon: Clock },
];

export default function Customers() {
  const { apiFetch } = useAuth();
  const { toast } = useToast();
  const [customers, setCustomers] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Detail modal
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Bulk message
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  useEffect(() => { loadCustomers(); }, [filter, page]);

  async function loadCustomers() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: '20' });
      if (filter !== 'all') params.set('filter', filter);
      if (search) params.set('search', search);
      const data = await apiFetch(`/customers?${params}`);
      setCustomers(data.customers);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error('Load customers error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e) {
    e.preventDefault();
    setPage(1);
    loadCustomers();
  }

  async function openDetail(customerId) {
    setDetailLoading(true);
    try {
      const data = await apiFetch(`/customers/${customerId}`);
      setSelectedCustomer(data);
    } catch (err) {
      console.error('Customer detail error:', err);
    } finally {
      setDetailLoading(false);
    }
  }

  async function togglePremium(customerId, current) {
    try {
      await apiFetch(`/customers/${customerId}`, {
        method: 'PATCH',
        body: { isPremium: !current },
      });
      toast.success(!current ? 'Customer upgraded to Premium' : 'Customer set to Regular');
      loadCustomers();
      if (selectedCustomer?.id === customerId) {
        setSelectedCustomer(prev => ({ ...prev, isPremium: !current }));
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update customer');
    }
  }

  async function sendBulk() {
    if (!bulkMessage.trim()) return;
    setBulkSending(true);
    setBulkResult(null);
    try {
      const result = await apiFetch('/customers/bulk-message', {
        method: 'POST',
        body: { message: bulkMessage, filter: filter !== 'all' ? filter : undefined },
      });
      setBulkResult(result);
    } catch (err) {
      setBulkResult({ error: err.message });
    } finally {
      setBulkSending(false);
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-text-primary">Customers</h1>
          <p className="text-sm text-text-secondary mt-1">{total} total customers</p>
        </div>
        <button
          onClick={() => setShowBulkModal(true)}
          className="btn-primary flex items-center justify-center gap-2 text-sm min-h-[40px] px-4 self-start sm:self-auto"
        >
          <Send className="w-4 h-4" /> Bulk WhatsApp
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => { setFilter(f.key); setPage(1); }}
            className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-badge text-sm font-medium capitalize transition-all ${
              filter === f.key ? 'bg-primary text-white' : 'bg-bg-subtle text-text-secondary hover:bg-border-subtle'
            }`}
          >
            <f.icon className="w-4 h-4" /> {f.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone..."
            className="input-field pl-10 w-full"
          />
        </div>
      </form>

      {/* Customer List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="card p-4 h-16 animate-pulse" />)}
        </div>
      ) : customers.length === 0 ? (
        <div className="card p-8 text-center text-text-secondary">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          No customers found.
        </div>
      ) : (
        <div className="space-y-2">
          {customers.map(customer => (
            <div
              key={customer.id}
              onClick={() => openDetail(customer.id)}
              className="card p-3.5 sm:p-4 flex items-center gap-3 sm:gap-4 cursor-pointer group hover:shadow-card-hover transition-shadow"
            >
              {/* Avatar */}
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">
                  {customer.user.name?.charAt(0)?.toUpperCase() || 'C'}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-text-primary truncate">{customer.user.name}</span>
                  {customer.isPremium && (
                    <span className="text-xs bg-secondary/20 text-secondary px-2 py-0.5 rounded-badge font-semibold flex items-center gap-1">
                      <Star className="w-3 h-3 fill-secondary text-secondary" /> Premium
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-secondary mt-0.5">
                  <span>{customer.user.phone}</span>
                  <span className="hidden xs:inline">•</span>
                  <span>{customer.totalOrders} orders</span>
                  <span className="hidden xs:inline">•</span>
                  <span className="font-semibold text-text-primary">₹{customer.totalSpent.toFixed(0)}</span>
                </div>
              </div>

              {/* Loyalty Points */}
              <div className="text-right shrink-0 hidden sm:block">
                <div className="flex items-center gap-1 text-sm font-semibold text-secondary">
                  <Gift className="w-4 h-4" /> {customer.loyaltyPoints} pts
                </div>
                <p className="text-xs text-text-secondary mt-0.5">
                  {customer.lastOrderAt
                    ? `Last: ${new Date(customer.lastOrderAt).toLocaleDateString()}`
                    : 'No orders yet'}
                </p>
              </div>

              <ChevronRight className="w-4 h-4 text-text-secondary group-hover:text-primary transition-colors shrink-0" />
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-button text-sm bg-bg-subtle text-text-secondary disabled:opacity-40 min-h-[38px]"
          >
            ← Prev
          </button>
          <span className="text-sm text-text-secondary">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-button text-sm bg-bg-subtle text-text-secondary disabled:opacity-40 min-h-[38px]"
          >
            Next →
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {(selectedCustomer || detailLoading) && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4" onClick={() => setSelectedCustomer(null)}>
          <div className="bg-bg-surface rounded-card shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6" onClick={e => e.stopPropagation()}>
            {detailLoading ? (
              <div className="text-center py-12 animate-pulse">
                <div className="h-6 bg-bg-subtle rounded w-1/2 mx-auto mb-4" />
                <div className="h-4 bg-bg-subtle rounded w-3/4 mx-auto" />
              </div>
            ) : selectedCustomer && (
              <>
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-lg font-bold text-primary">
                        {selectedCustomer.user.name?.charAt(0)?.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h2 className="text-xl font-heading font-bold text-text-primary">{selectedCustomer.user.name}</h2>
                      <p className="text-sm text-text-secondary">{selectedCustomer.user.phone}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedCustomer(null)} className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
                  <div className="bg-bg-subtle rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-text-primary">{selectedCustomer.totalOrders}</p>
                    <p className="text-xs text-text-secondary">Orders</p>
                  </div>
                  <div className="bg-bg-subtle rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-primary">₹{selectedCustomer.totalSpent.toFixed(0)}</p>
                    <p className="text-xs text-text-secondary">Total Spent</p>
                  </div>
                  <div className="bg-bg-subtle rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-secondary">{selectedCustomer.loyaltyPoints}</p>
                    <p className="text-xs text-text-secondary">Loyalty Pts</p>
                  </div>
                </div>

                {/* Premium Toggle */}
                <button
                  onClick={() => togglePremium(selectedCustomer.id, selectedCustomer.isPremium)}
                  className={`w-full mb-6 py-2.5 rounded-button text-sm font-semibold transition-all ${
                    selectedCustomer.isPremium
                      ? 'bg-secondary/20 text-secondary border border-secondary/30'
                      : 'bg-bg-subtle text-text-secondary hover:bg-secondary/10 hover:text-secondary'
                  }`}
                >
                  {selectedCustomer.isPremium ? 'Premium Customer' : 'Mark as Premium'}
                </button>

                {/* Recent Orders */}
                <h3 className="font-heading font-semibold text-text-primary mb-3">Recent Orders</h3>
                {selectedCustomer.orders?.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedCustomer.orders.map(order => (
                      <div key={order.id} className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0 text-sm">
                        <div>
                          <span className="font-mono text-xs text-text-secondary">#{order.id.slice(0, 8)}</span>
                          <p className="text-text-primary">
                            {order.items.map(i => `${i.quantity}x ${i.menuItem?.name}`).join(', ')}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-text-primary">₹{order.total.toFixed(0)}</span>
                          <p className="text-xs text-text-secondary capitalize">{order.status.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary py-4 text-center">No orders yet.</p>
                )}

                {/* Reviews */}
                {selectedCustomer.reviews?.length > 0 && (
                  <>
                    <h3 className="font-heading font-semibold text-text-primary mt-6 mb-3">Reviews</h3>
                    <div className="space-y-2">
                      {selectedCustomer.reviews.map(review => (
                        <div key={review.id} className="bg-bg-subtle rounded-xl p-3">
                          <div className="flex items-center gap-1 mb-1">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className={`w-3.5 h-3.5 ${i < review.rating ? 'text-secondary fill-secondary' : 'text-border-subtle'}`} />
                            ))}
                          </div>
                          {review.comment && <p className="text-sm text-text-primary">{review.comment}</p>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Bulk Message Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4" onClick={() => { setShowBulkModal(false); setBulkResult(null); }}>
          <div className="bg-bg-surface rounded-card shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-bold text-text-primary">Bulk WhatsApp Message</h2>
              <button onClick={() => { setShowBulkModal(false); setBulkResult(null); }} className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-text-secondary mb-4">
              Send to: <strong className="text-text-primary capitalize">{filter === 'all' ? 'All' : filter}</strong> customers ({total})
            </p>

            <textarea
              value={bulkMessage}
              onChange={(e) => setBulkMessage(e.target.value)}
              placeholder="Type your message here... Use *bold* for emphasis."
              rows={5}
              className="input-field w-full resize-none mb-4"
            />

            {bulkResult && (
              <div className={`p-3 rounded-xl mb-4 text-sm ${bulkResult.error ? 'bg-error/10 text-error' : 'bg-success/10 text-success'}`}>
                {bulkResult.error || `Sent to ${bulkResult.sent || bulkResult.totalCustomers} customers successfully.`}
              </div>
            )}

            <button
              onClick={sendBulk}
              disabled={bulkSending || !bulkMessage.trim()}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {bulkSending ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
