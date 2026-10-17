// ── Orders List Page — Tea Bhatti Owner Dashboard ──
// Comprehensive order records with Paid vs Outstanding Balance breakdown,
// Pickup Token identification, and quick counter actions.

import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth, SOCKET_URL } from '../context/AuthContext.jsx';
import { 
  ShoppingBag, 
  Search, 
  Store, 
  ShieldCheck, 
  CheckCircle2, 
  QrCode, 
  Clock, 
  Phone,
  RefreshCw,
  X,
  Bell,
  AlertTriangle,
  Printer
} from 'lucide-react';
import OrderReceiptModal from '../components/OrderReceiptModal.jsx';
import { useToast } from '../context/ToastContext.jsx';

const STATUSES = ['all', 'received', 'accepted', 'preparing', 'ready', 'delivered', 'cancelled'];
const STATUS_LABELS = {
  all: 'All Orders',
  received: 'Received',
  accepted: 'Accepted',
  preparing: 'In Kitchen',
  ready: 'Ready at Counter',
  delivered: 'Picked Up / Completed',
  cancelled: 'Cancelled',
};
const STATUS_COLORS = {
  received: 'bg-amber-100 text-amber-900 border border-amber-300',
  accepted: 'bg-blue-100 text-blue-900 border border-blue-300',
  preparing: 'bg-orange-100 text-orange-900 border border-orange-300',
  ready: 'bg-emerald-100 text-emerald-900 border border-emerald-300 animate-pulse',
  delivered: 'bg-gray-100 text-gray-900 border border-gray-300',
  cancelled: 'bg-red-100 text-red-900 border border-red-300',
};

export default function Orders() {
  const { apiFetch, user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [activeQr, setActiveQr] = useState(null);
  const [activeReceiptOrder, setActiveReceiptOrder] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => { 
    loadOrders(true); 

    // Setup Socket.io for instantaneous real-time updates
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      if (user?.businessId) {
        socket.emit('join-business', user.businessId);
      }
    });

    socket.on('new-order', (data) => {
      setToastMessage(`⚡ New Order Received! Token: ${data.pickupCode || '#' + (data.orderId || '').slice(-4)} (₹${data.total || ''})`);
      try { new Audio('/notification.mp3').play().catch(() => {}); } catch (_) {}
      loadOrders(false);
      setTimeout(() => setToastMessage(null), 7000);
    });

    socket.on('order-updated', () => {
      loadOrders(false);
    });

    socket.on('payment-submitted', (data) => {
      setToastMessage(`💳 Payment UTR Submitted for Token ${data.pickupCode || ''}!`);
      loadOrders(false);
      setTimeout(() => setToastMessage(null), 7000);
    });

    // Polling fallback every 8 seconds
    const interval = setInterval(() => loadOrders(false), 8000);

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, [filter, user?.businessId]);

  async function loadOrders(showSpinner = true) {
    if (showSpinner) setLoading(true);
    try {
      const params = filter !== 'all' ? `status=${filter}&limit=100` : 'limit=100';
      const data = await apiFetch(`/orders?${params}`);
      setOrders(data.orders || []);
      setFetchError(null);
    } catch (err) {
      console.error('Load orders error:', err);
      setFetchError(err.message || 'Failed to load orders');
    } finally {
      if (showSpinner) setLoading(false);
    }
  }

  async function updateStatus(orderId, status) {
    try {
      await apiFetch(`/orders/${orderId}/status`, { method: 'PATCH', body: { status } });
      toast.success(`Order updated to ${status.replace(/_/g, ' ')}`);
      loadOrders();
    } catch (err) { toast.error(err.message || 'Failed to update order status'); }
  }

  async function collectBalance(orderId) {
    try {
      const res = await apiFetch(`/orders/${orderId}/collect-balance`, { method: 'POST' });
      toast.success(res.message || 'Balance collected & order completed!');
      loadOrders();
    } catch (err) { toast.error(err.message || 'Failed to collect balance'); }
  }

  async function showQr(orderId) {
    try {
      const qrData = await apiFetch(`/orders/${orderId}/qr`);
      setActiveQr(qrData);
    } catch (err) { toast.error(err.message || 'Failed to generate QR'); }
  }

  async function verifyPayment(orderId, action = 'verify') {
    if (action === 'reject') {
      const confirmed = window.confirm(
        'Reject this payment?\n\nThe customer will be asked to check their UTR number and try again. Once they re-submit, the Verify and Reject buttons will reappear here.'
      );
      if (!confirmed) return;
    }
    try {
      const res = await apiFetch(`/orders/${orderId}/payment/verify`, {
        method: 'PATCH',
        body: { action },
      });
      toast.success(
        res.message || (action === 'verify' ? 'Payment verified & order accepted' : 'Payment rejected. Customer prompted to check UTR and retry.')
      );
      loadOrders();
    } catch (err) { toast.error(err.message || 'Failed to verify payment'); }
  }

  async function handleCancelOrder(order) {
    const confirmed = window.confirm(
      `Cancel order #${order.pickupCode || order.id.slice(-4).toUpperCase()}?\n\nThis will cancel the order from the admin side. The customer will be informed that the order was cancelled by the cafe admin, and will be promised a 100% full refund within one hour.`
    );
    if (!confirmed) return;

    try {
      await apiFetch(`/orders/${order.id}/cancel`, { method: 'PATCH' });
      toast.info(`Order #${order.pickupCode || order.id.slice(-4).toUpperCase()} cancelled by admin. Customer notified of 100% refund within 1 hour.`);
      loadOrders();
    } catch (err) {
      toast.error(err.message || 'Failed to cancel order');
    }
  }

  async function notifyReadySoon(orderId) {
    try {
      const res = await apiFetch(`/orders/${orderId}/notify-ready-soon`, {
        method: 'POST',
      });
      toast.success(res.message || '10-minute ready notification sent to customer!');
      loadOrders();
    } catch (err) { toast.error(err.message || 'Failed to send notification'); }
  }

  const getNextStatus = (order) => {
    const flow = {
      received: 'accepted',
      accepted: 'preparing',
      preparing: 'ready',
      ready: 'delivered',
    };
    return flow[order.status];
  };

  const filteredOrders = orders.filter(o => {
    const q = search.toLowerCase();
    return !search || 
      o.pickupCode?.toLowerCase().includes(q) ||
      o.customer?.user?.name?.toLowerCase().includes(q) ||
      o.customer?.user?.phone?.includes(q) ||
      o.id.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-black text-text-primary tracking-tight">
            All Orders & Historical Records
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Overview of pickups, payments, and financial balances.
          </p>
        </div>

        <button
          onClick={() => loadOrders(true)}
          className="btn-outline px-4 py-2 text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Live Toast Alert for Incoming Orders */}
      {toastMessage && (
        <div className="p-4 rounded-2xl bg-amber-500 text-white font-bold text-xs flex items-center justify-between shadow-lg animate-bounce">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 animate-spin" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="p-1 hover:bg-white/20 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Banner with Retry */}
      {fetchError && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span><strong>Failed to load orders:</strong> {fetchError}</span>
          </div>
          <button 
            onClick={() => loadOrders(true)}
            className="btn-primary bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 font-bold rounded-xl"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold capitalize transition-all ${
                filter === s
                  ? 'bg-primary text-white shadow-md'
                  : 'bg-white border border-border-subtle text-text-secondary hover:text-text-primary'
              }`}
            >
              {STATUS_LABELS[s] || s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-text-secondary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Token (e.g. TB-8942) or Phone..."
            className="input-field text-xs pl-9 pr-4 py-2.5 w-full bg-white font-medium"
          />
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="card p-6 h-28 animate-pulse bg-white/70" />)}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="card p-12 text-center bg-white border border-border-subtle">
          <ShoppingBag className="w-12 h-12 text-border-subtle mx-auto mb-3" />
          <p className="text-text-secondary text-sm font-semibold">No orders found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map(order => {
            const advance = order.advanceAmount || Math.round(order.total * 0.20);
            const balance = order.balanceAmount || Math.round(order.total - advance);
            const isDelivered = order.status === 'delivered';
            const isCancelled = order.status === 'cancelled';

            return (
              <div key={order.id} className="card p-5 border-2 border-border-subtle bg-white hover:border-primary/20 transition-all shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* Left: Metadata */}
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-black px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-950 border border-amber-300">
                        Token #{order.pickupCode || 'TB-' + order.id.slice(-4).toUpperCase()}
                      </span>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full capitalize ${STATUS_COLORS[order.status]}`}>
                        {STATUS_LABELS[order.status] || order.status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                        <Store className="w-3 h-3 text-amber-600" /> Store Pickup / Dine-in
                      </span>
                      {order.couponCode && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-secondary/15 text-secondary-hover rounded-md">
                          Coupon: {order.couponCode}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <p className="font-bold text-sm text-text-primary">
                        {order.customer?.user?.name || 'Customer'}
                      </p>
                      <span className="text-xs text-text-secondary flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {order.customer?.user?.phone || 'N/A'}
                      </span>
                    </div>

                    <p className="text-xs text-text-secondary font-medium">
                      {order.items?.map(i => `${i.quantity}x ${i.menuItem?.name}`).join(', ')}
                    </p>

                    <p className="text-[11px] text-text-secondary">
                      Placed: {new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>

                  {/* Middle: Financial Status (Paid vs Outstanding) */}
                  <div className="p-3.5 rounded-2xl bg-bg-base/80 border border-border-subtle shrink-0 grid grid-cols-2 gap-4 text-xs min-w-[240px]">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-800 uppercase block">20% Advance</span>
                      <span className="font-mono font-black text-emerald-700 text-sm">₹{advance}</span>
                      <span className="text-[9px] text-emerald-600 block">Stripe / Online</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-amber-900 uppercase block">80% Balance Due</span>
                      <span className={`font-mono font-black text-sm ${isDelivered ? 'text-emerald-700' : 'text-primary'}`}>
                        {isDelivered ? '₹0.00' : `₹${balance}.00`}
                      </span>
                      <span className="text-[9px] text-text-secondary block">
                        {isDelivered ? 'Settled' : 'Counter Pay'}
                      </span>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {/* UTR Verification Action */}
                    {order.paymentStatus === 'utr_submitted' && !isCancelled && (
                      <div className="flex items-center gap-1.5 p-1.5 bg-blue-50 border border-blue-200 rounded-xl">
                        <span className="font-mono text-[11px] font-bold text-blue-900 px-1.5">
                          UTR: {order.paymentUtr}
                        </span>
                        <button
                          onClick={() => verifyPayment(order.id, 'verify')}
                          className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-[11px] px-2.5 py-1 font-bold"
                        >
                          Verify
                        </button>
                        <button
                          onClick={() => verifyPayment(order.id, 'reject')}
                          className="btn-outline text-error border-error text-[11px] px-2 py-1 font-bold"
                        >
                          Reject
                        </button>
                      </div>
                    )}

                    {/* Rejected Status Badge awaiting customer UTR re-entry */}
                    {(order.paymentStatus === 'rejected' || order.paymentStatus === 'failed') && !isCancelled && (
                      <div className="flex items-center gap-1.5 p-1.5 bg-rose-50 border border-rose-200 rounded-xl">
                        <span className="text-[11px] font-bold text-rose-800 px-1.5 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                          Payment Rejected (Awaiting Customer UTR)
                        </span>
                      </div>
                    )}

                    {!isCancelled && !isDelivered && (
                      <>
                        <button
                          onClick={() => showQr(order.id)}
                          className="btn-outline text-xs px-3 py-2 font-bold flex items-center gap-1.5"
                          title="Show QR for counter scan"
                        >
                          <QrCode className="w-3.5 h-3.5" /> Balance QR
                        </button>

                        {/* Send 10-minute ready alert if preparing */}
                        {order.status === 'preparing' && (
                          <button
                            onClick={() => notifyReadySoon(order.id)}
                            disabled={order.readySoon}
                            className={`btn-outline text-xs px-2.5 py-2 font-bold flex items-center gap-1 ${
                              order.readySoon
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'border-amber-600 text-amber-700 hover:bg-amber-50'
                            }`}
                            title="Send 10-minute pickup alert to customer"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            {order.readySoon ? 'Alert Sent' : '10-Min Alert'}
                          </button>
                        )}

                        {getNextStatus(order) && (
                          <button
                            onClick={() => updateStatus(order.id, getNextStatus(order))}
                            className="btn-primary text-xs px-3.5 py-2 font-bold"
                          >
                            → {getNextStatus(order) === 'delivered' ? 'Mark Picked Up (Done)' : getNextStatus(order).replace(/_/g, ' ')}
                          </button>
                        )}

                        <button
                          onClick={() => collectBalance(order.id)}
                          className="btn-primary bg-amber-600 hover:bg-amber-700 text-xs px-3 py-2 font-bold"
                        >
                          Collect ₹{balance} & Finish
                        </button>
                      </>
                    )}

                    {/* Print Bill / Kitchen Token Button */}
                    <button
                      onClick={() => setActiveReceiptOrder(order)}
                      className="btn-outline text-xs px-2.5 py-1.5 font-bold flex items-center gap-1 hover:bg-neutral-900 hover:text-white transition-all"
                      title="Print Customer Bill / POS Slip"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print Bill
                    </button>

                    {isCancelled && (
                      <div className="text-right text-xs space-y-0.5">
                        <span className="font-mono font-bold text-red-800 px-2 py-0.5 bg-red-100 rounded border border-red-200 block">
                          {order.refundCode || 'REF-TB-' + order.id.slice(-6).toUpperCase()}
                        </span>
                        <span className="text-[10px] text-red-700 font-bold block">
                          {order.cancelledBy === 'admin' ? 'Cancelled by Admin (100% Refund in 1 Hr)' : 'Cancelled by Customer'}
                        </span>
                      </div>
                    )}

                    {['received', 'accepted'].includes(order.status) && (
                      <button
                        onClick={() => handleCancelOrder(order)}
                        className="text-xs text-error hover:underline px-2 py-1 font-semibold"
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dynamic QR Modal */}
      {activeQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card p-6 max-w-sm w-full bg-white rounded-3xl shadow-2xl text-center space-y-4 relative">
            <button
              onClick={() => setActiveQr(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-bg-subtle text-text-secondary"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-heading font-black text-lg text-text-primary">
              Scan Exact Balance QR
            </h3>

            <div className="text-2xl font-mono font-black text-primary">
              ₹{activeQr.exactAmount}.00
            </div>

            <img 
              src={activeQr.qrDataUrl} 
              alt="Balance QR" 
              className="w-52 h-52 mx-auto rounded-2xl border-2 border-primary/20 shadow-md p-1"
            />

            <button
              onClick={() => {
                collectBalance(activeQr.orderId);
                setActiveQr(null);
              }}
              className="btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              Confirm Collected ₹{activeQr.exactAmount}
            </button>
          </div>
        </div>
      )}

      {/* Professional Order Receipt / Bill Modal */}
      {activeReceiptOrder && (
        <OrderReceiptModal
          order={activeReceiptOrder}
          onClose={() => setActiveReceiptOrder(null)}
        />
      )}
    </div>
  );
}
