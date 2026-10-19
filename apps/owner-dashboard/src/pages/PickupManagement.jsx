// ── Pickup Management & Operations Page — Tea Bhatti Owner Dashboard ──
// Live Pickup Tasks, Paid 20% Advance vs Outstanding 80% Balance Tracking,
// Dynamic Exact QR Code Generator for Counter Settlement, and One-Click Completion.

import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth, SOCKET_URL } from '../context/AuthContext.jsx';
import { 
  Store, 
  Clock, 
  Search, 
  CheckCircle2, 
  QrCode, 
  ShieldCheck, 
  DollarSign, 
  ChefHat, 
  Bell, 
  ShoppingBag,
  Sparkles,
  Phone,
  RefreshCw,
  X,
  Printer,
  AlertTriangle,
  Calendar
} from 'lucide-react';
import OrderReceiptModal from '../components/OrderReceiptModal.jsx';
import StoreStatusToggle from '../components/StoreStatusToggle.jsx';
import { useToast } from '../context/ToastContext.jsx';

const PICKUP_COLUMNS = [
  { key: 'all', label: 'All Pickups', icon: ShoppingBag },
  { key: 'received', label: 'New / Advance', icon: ShieldCheck, color: 'text-amber-700 bg-amber-100' },
  { key: 'accepted', label: 'Accepted', icon: CheckCircle2, color: 'text-blue-700 bg-blue-100' },
  { key: 'preparing', label: 'In Kitchen', icon: ChefHat, color: 'text-orange-700 bg-orange-100' },
  { key: 'ready', label: 'Ready at Counter', icon: Bell, color: 'text-emerald-800 bg-emerald-100' },
  { key: 'delivered', label: 'Picked Up (Done)', icon: CheckCircle2, color: 'text-gray-700 bg-gray-100' },
];

export default function PickupManagement() {
  const { apiFetch, user } = useAuth();
  const { toast, confirm } = useToast();
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Indian Standard Time day calculation
  const todayISTStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayISTStr = yesterdayDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  // Date Filter State
  const [dateFilterMode, setDateFilterMode] = useState('today'); // 'today' | 'yesterday' | 'custom' | 'all'
  const [selectedDay, setSelectedDay] = useState(todayISTStr);

  // Dynamic Balance QR Modal state
  const [activeQr, setActiveQr] = useState(null);
  const [activeReceiptOrder, setActiveReceiptOrder] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);

  // Quick Action loading state
  const [actionLoading, setActionLoading] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    loadPickups();

    // Setup Socket.io for instantaneous order arrival and updates
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
      setToastMessage(`⚡ New Pickup Order Received! Token: ${data.pickupCode || '#' + (data.orderId || '').slice(-4)} (₹${data.total || ''})`);
      try { new Audio('/notification.mp3').play().catch(() => {}); } catch (_) {}
      loadPickups(false);
      setTimeout(() => setToastMessage(null), 7000);
    });

    socket.on('order-updated', () => {
      loadPickups(false);
    });

    socket.on('payment-submitted', (data) => {
      setToastMessage(`💳 Payment UTR Submitted for Token ${data.pickupCode || ''}!`);
      loadPickups(false);
      setTimeout(() => setToastMessage(null), 7000);
    });

    // Active polling fallback every 8 seconds
    const interval = setInterval(() => loadPickups(false), 8000);

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, [user?.businessId]);

  useEffect(() => {
    loadPickups(true);
  }, [dateFilterMode, selectedDay]);

  async function loadPickups(showSpinner = false) {
    if (showSpinner && orders.length === 0) setLoading(true);
    try {
      let url = '/orders?limit=250';
      if (dateFilterMode === 'today') {
        const start = `${todayISTStr}T00:00:00.000Z`;
        const end = `${todayISTStr}T23:59:59.999Z`;
        url += `&from=${encodeURIComponent(start)}&to=${encodeURIComponent(end)}`;
      } else if (dateFilterMode === 'yesterday') {
        const start = `${yesterdayISTStr}T00:00:00.000Z`;
        const end = `${yesterdayISTStr}T23:59:59.999Z`;
        url += `&from=${encodeURIComponent(start)}&to=${encodeURIComponent(end)}`;
      } else if (dateFilterMode === 'custom' && selectedDay) {
        const start = `${selectedDay}T00:00:00.000Z`;
        const end = `${selectedDay}T23:59:59.999Z`;
        url += `&from=${encodeURIComponent(start)}&to=${encodeURIComponent(end)}`;
      }

      const data = await apiFetch(url);
      setOrders(data.orders || []);
      setFetchError(null);
    } catch (err) {
      console.error('Failed to load pickups:', err);
      setFetchError(err.message || 'Failed to fetch pickups');
    } finally {
      setLoading(false);
    }
  }

  // Update order status: preparing -> ready -> delivered
  async function updateOrderStatus(orderId, status) {
    setActionLoading(orderId);
    // Optimistic local update
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    try {
      await apiFetch(`/orders/${orderId}/status`, {
        method: 'PATCH',
        body: { status },
      });
      toast.success(`Order marked as ${status.replace(/_/g, ' ')}`);
      loadPickups(false);
    } catch (err) {
      toast.error(err.message || 'Failed to update order status');
      loadPickups(false);
    } finally {
      setActionLoading(null);
    }
  }

  // Collect Remaining 80% Balance at Shop Counter and Mark Order Completed
  async function handleCollectBalance(orderId) {
    setActionLoading(orderId);
    // Optimistic local update
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, paymentStatus: 'fully_paid', status: 'delivered' } : o));
    try {
      const res = await apiFetch(`/orders/${orderId}/collect-balance`, {
        method: 'POST',
      });
      toast.success(res.message || 'Balance collected successfully!');
      loadPickups(false);
    } catch (err) {
      toast.error(err.message || 'Failed to collect balance');
      loadPickups(false);
    } finally {
      setActionLoading(null);
    }
  }

  // Show Dynamic UPI QR for exact remaining balance
  async function handleShowBalanceQr(orderId) {
    setQrLoading(true);
    try {
      const qrData = await apiFetch(`/orders/${orderId}/qr?type=balance`);
      setActiveQr(qrData);
    } catch (err) {
      toast.error(err.message || 'Failed to generate QR code');
    } finally {
      setQrLoading(false);
    }
  }

  // Owner verifies customer UTR
  async function handleVerifyPayment(orderId, action = 'verify') {
    setActionLoading(orderId);
    // Optimistic local update
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      if (action === 'verify') {
        return {
          ...o,
          paymentStatus: 'verified',
          status: o.status === 'received' ? 'accepted' : o.status,
        };
      } else {
        return {
          ...o,
          paymentStatus: 'rejected',
        };
      }
    }));
    try {
      const res = await apiFetch(`/orders/${orderId}/payment/verify`, {
        method: 'PATCH',
        body: { action },
      });
      toast.success(res.message || (action === 'verify' ? 'Payment verified & order accepted' : 'Payment rejected'));
      loadPickups(false);
    } catch (err) {
      toast.error(err.message || 'Failed to verify payment');
      loadPickups(false);
    } finally {
      setActionLoading(null);
    }
  }

  // Send "Ready in 10 minutes" notification to customer
  async function handleNotifyReadySoon(orderId) {
    setActionLoading(orderId);
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, readySoon: true } : o));
    try {
      const res = await apiFetch(`/orders/${orderId}/notify-ready-soon`, {
        method: 'POST',
      });
      toast.success(res.message || '10-minute ready notification sent to customer!');
      loadPickups(false);
    } catch (err) {
      toast.error(err.message || 'Failed to send notification');
      loadPickups(false);
    } finally {
      setActionLoading(null);
    }
  }

  // Mark Refund Completed after payment is refunded to customer
  async function handleMarkRefundComplete(order) {
    const tokenStr = order.pickupCode || order.id.slice(-4).toUpperCase();
    const amount = order.refundAmount || order.total || order.advanceAmount || 0;
    const ok = await confirm({
      title: `Mark Refund Complete for #${tokenStr}?`,
      message: `Confirm that ₹${amount} has been refunded to the customer. This will update the customer's tracking screen to show 'Refund Completed'.`,
      confirmText: 'Mark as Refunded',
      cancelText: 'Back',
      isDestructive: false,
    });
    if (!ok) return;

    setActionLoading(order.id);
    // Optimistic local update
    setOrders(prev => prev.map(o => o.id === order.id ? {
      ...o,
      refundStatus: 'refunded',
      paymentStatus: 'refunded',
      refundedAt: new Date(),
    } : o));
    try {
      await apiFetch(`/orders/${order.id}/refund-complete`, { method: 'PATCH' });
      toast.success(`Refund of ₹${amount} marked as complete for #${tokenStr}!`);
      loadPickups(false);
    } catch (err) {
      toast.error(err.message || 'Failed to mark refund complete');
      loadPickups(false);
    } finally {
      setActionLoading(null);
    }
  }

  // Filter & Search Logic
  const filteredOrders = orders.filter(order => {
    const matchesFilter = filter === 'all' || order.status === filter;
    const query = search.toLowerCase();
    const matchesSearch = 
      !search ||
      order.pickupCode?.toLowerCase().includes(query) ||
      order.customer?.user?.name?.toLowerCase().includes(query) ||
      order.customer?.user?.phone?.includes(query) ||
      order.id.toLowerCase().includes(query);
    return matchesFilter && matchesSearch;
  });

  // Calculate Metrics
  const activeOrders = orders.filter(o => o.status !== 'cancelled' && o.status !== 'delivered');
  const readyOrders = orders.filter(o => o.status === 'ready');
  const totalOutstandingBalance = activeOrders.reduce((sum, o) => sum + (o.balanceAmount || Math.round(o.total * 0.8)), 0);
  const totalAdvanceCollected = orders
    .filter(o => ['advance_paid', 'fully_paid', 'verified'].includes(o.paymentStatus) || ['accepted', 'preparing', 'ready', 'delivered'].includes(o.status))
    .reduce((sum, o) => sum + (o.advanceAmount || Math.round(o.total * 0.2)), 0);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full bg-primary text-white">
              Shop Ops
            </span>
            <span className="text-xs text-text-secondary">
              Real-time Counter Hub
            </span>
          </div>
          <h1 className="text-2xl font-heading font-black text-text-primary tracking-tight">
            Pickup Management & Task Board
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Track 20% advance payments, prep statuses, and collect 80% balance at the counter.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <StoreStatusToggle />
          <button
            onClick={() => loadPickups(true)}
            className="btn-outline px-3.5 py-2 text-xs font-bold flex items-center gap-2 bg-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Orders
          </button>
        </div>
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
            onClick={() => loadPickups(true)}
            className="btn-primary bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 font-bold rounded-xl"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Top Operations KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="card p-4 sm:p-5 border-2 border-border-subtle bg-white shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-text-secondary uppercase">Active Pickups</span>
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-mono font-black text-text-primary">{activeOrders.length}</div>
          <span className="text-[11px] text-text-secondary font-medium">Orders in queue today</span>
        </div>

        <div className="card p-4 sm:p-5 border-2 border-border-subtle bg-white shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-text-secondary uppercase">Ready at Counter</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-mono font-black text-emerald-700">{readyOrders.length}</div>
          <span className="text-[11px] text-text-secondary font-medium">Awaiting customer pickup</span>
        </div>

        <div className="card p-4 sm:p-5 border-2 border-emerald-300/80 bg-emerald-50/40 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-900 uppercase">20% Advance Collected</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-mono font-black text-emerald-800">₹{totalAdvanceCollected.toFixed(0)}</div>
          <span className="text-[11px] text-emerald-700 font-medium">Secured via Razorpay</span>
        </div>

        <div className="card p-4 sm:p-5 border-2 border-amber-300/80 bg-amber-50/40 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-900 uppercase">Balance to Collect (80%)</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-mono font-black text-amber-900">₹{totalOutstandingBalance.toFixed(0)}</div>
          <span className="text-[11px] text-amber-700 font-medium">Collect via Cash or QR at shop</span>
        </div>
      </div>

      {/* Date Filter & Day Summary Bar */}
      <div className="card p-3.5 sm:p-4 border-2 border-border-subtle bg-white shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-text-primary">
                Viewing Records for: <strong className="text-primary">{
                  dateFilterMode === 'today' ? 'Today' :
                  dateFilterMode === 'yesterday' ? 'Yesterday' :
                  dateFilterMode === 'custom' ? selectedDay :
                  'All Recorded Days'
                }</strong>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                {orders.length} orders processed
              </span>
            </div>
            <p className="text-[11px] text-text-secondary mt-0.5">
              Inspect order volumes, kitchen statuses, and cash settlements for any specific date.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setDateFilterMode('today')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              dateFilterMode === 'today'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-bg-base/70 text-text-secondary hover:text-text-primary border border-border-subtle'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setDateFilterMode('yesterday')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              dateFilterMode === 'yesterday'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-bg-base/70 text-text-secondary hover:text-text-primary border border-border-subtle'
            }`}
          >
            Yesterday
          </button>
          <button
            type="button"
            onClick={() => setDateFilterMode('custom')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              dateFilterMode === 'custom'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-bg-base/70 text-text-secondary hover:text-text-primary border border-border-subtle'
            }`}
          >
            Pick Date
          </button>
          {dateFilterMode === 'custom' && (
            <input
              type="date"
              value={selectedDay}
              onChange={e => setSelectedDay(e.target.value)}
              className="input-field text-xs py-1 px-2.5 bg-white border-primary/40 focus:border-primary font-medium"
            />
          )}
          <button
            type="button"
            onClick={() => setDateFilterMode('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              dateFilterMode === 'all'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-bg-base/70 text-text-secondary hover:text-text-primary border border-border-subtle'
            }`}
          >
            All Days
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex gap-2 overflow-x-auto pb-1 max-w-full">
          {PICKUP_COLUMNS.map(col => {
            const Icon = col.icon;
            const count = col.key === 'all' 
              ? orders.length 
              : orders.filter(o => o.status === col.key).length;

            return (
              <button
                key={col.key}
                onClick={() => setFilter(col.key)}
                className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 shrink-0 transition-all ${
                  filter === col.key
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-white border border-border-subtle text-text-secondary hover:text-text-primary'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{col.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  filter === col.key ? 'bg-white/20 text-white' : 'bg-bg-subtle text-text-secondary'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-auto sm:min-w-[260px]">
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

      {/* Orders Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="card p-6 h-56 animate-pulse bg-white/70" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="card p-8 sm:p-12 text-center bg-white border border-border-subtle">
          <Store className="w-12 h-12 text-border-subtle mx-auto mb-3" />
          <h3 className="font-heading font-bold text-base text-text-primary">No Pickups Found</h3>
          <p className="text-xs text-text-secondary mt-1">There are no orders matching this filter right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {filteredOrders.map(order => {
            const advance = order.advanceAmount || Math.round(order.total * 0.20);
            const balance = order.balanceAmount || Math.round(order.total - advance);
            const isDelivered = order.status === 'delivered';
            const isReady = order.status === 'ready';
            const isPreparing = order.status === 'preparing';
            const isAdvancePaid = ['advance_paid', 'fully_paid', 'verified'].includes(order.paymentStatus);
            const isAdvanceVerified = isAdvancePaid || ['accepted', 'preparing', 'ready', 'delivered'].includes(order.status);
            const isCancelled = order.status === 'cancelled';

            return (
              <div 
                key={order.id} 
                className={`card p-4 sm:p-6 border-2 transition-all hover:shadow-lg bg-white relative overflow-hidden ${
                  isReady 
                    ? 'border-emerald-500 ring-2 ring-emerald-400/20 shadow-md' 
                    : isPreparing
                    ? 'border-orange-400/80'
                    : 'border-border-subtle'
                }`}
              >
                {/* Header: Pickup Code + Status */}
                <div className="flex items-start justify-between gap-3 pb-4 border-b border-border-subtle">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-mono font-black px-3 py-1 rounded-xl bg-amber-500/15 text-amber-950 border border-amber-300">
                        Token #{order.pickupCode || 'TB-' + order.id.slice(-4).toUpperCase()}
                      </span>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full capitalize ${
                        isReady
                          ? 'bg-emerald-100 text-emerald-800 animate-pulse'
                          : isPreparing
                          ? 'bg-orange-100 text-orange-800'
                          : isDelivered
                          ? 'bg-gray-100 text-gray-800'
                          : isCancelled
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {isDelivered ? 'Picked Up / Completed' : isReady ? 'Ready at Counter' : order.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <p className="text-xs text-text-secondary mt-1 font-medium">
                      Order #{order.id.slice(-6).toUpperCase()} • {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-text-secondary font-medium block">Total Value</span>
                    <span className="text-lg font-mono font-black text-text-primary">
                      ₹{order.total.toFixed(0)}
                    </span>
                  </div>
                </div>

                {/* Customer Details */}
                <div className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-text-primary block">
                      {order.customer?.user?.name || 'Customer'}
                    </span>
                    <span className="text-text-secondary text-[11px] flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" />
                      {order.customer?.user?.phone || 'No phone'}
                    </span>
                  </div>
                  {order.couponCode && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-secondary/15 text-secondary-hover rounded-lg border border-secondary/20">
                      Coupon: {order.couponCode}
                    </span>
                  )}
                </div>

                {/* Financial Breakdown: Paid vs Outstanding */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-bg-base/80 to-amber-50/40 border border-border-subtle my-3 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-emerald-800 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Advance (20% Upfront):
                    </span>
                    <div className="flex items-center gap-2">
                      {isAdvanceVerified ? (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" /> Verified
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                          Unverified
                        </span>
                      )}
                      <span className="font-mono font-black text-emerald-700">
                        ₹{advance}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs pt-1.5 border-t border-border-subtle/70">
                    <span className="font-semibold text-amber-900 flex items-center gap-1">
                      <Store className="w-3.5 h-3.5 text-amber-600" />
                      Outstanding Balance (80% Due):
                    </span>
                    <span className={`font-mono font-black text-sm ${
                      isDelivered ? 'text-emerald-700' : 'text-primary'
                    }`}>
                      {isDelivered ? '₹0.00 (Fully Settled)' : `₹${balance}.00`}
                    </span>
                  </div>
                </div>

                {/* Itemized summary */}
                <div className="text-xs text-text-secondary py-1 max-h-20 overflow-y-auto">
                  {order.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between py-0.5">
                      <span>{item.quantity}x {item.menuItem?.name || 'Item'}</span>
                      <span className="font-mono text-text-primary font-medium">₹{(item.priceEach * item.quantity).toFixed(0)}</span>
                    </div>
                  ))}
                </div>

                {/* Customer Submitted UTR Verification Box (Shown only if not yet verified) */}
                {order.paymentStatus === 'utr_submitted' && !isCancelled && !isAdvanceVerified && (
                  <div className="p-3 my-2 rounded-2xl bg-blue-50 border border-blue-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs animate-fade-in">
                    <div>
                      <span className="font-bold text-blue-900 block">Customer Submitted Payment UTR:</span>
                      <span className="font-mono font-black text-blue-950 text-sm">{order.paymentUtr}</span>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleVerifyPayment(order.id, 'verify')}
                        disabled={actionLoading === order.id}
                        className="btn-primary bg-emerald-600 hover:bg-emerald-700 py-1.5 px-3 text-xs font-bold"
                      >
                        Verify Payment
                      </button>
                      <button
                        onClick={() => handleVerifyPayment(order.id, 'reject')}
                        disabled={actionLoading === order.id}
                        className="btn-outline text-error border-error py-1.5 px-2.5 text-xs font-bold"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}

                {/* Counter Task Actions */}
                {!isCancelled && !isDelivered && (
                  <div className="mt-4 pt-3 border-t border-border-subtle flex flex-wrap items-center gap-2">
                    {/* Status Flow Buttons */}
                    {order.status === 'received' && (
                      <>
                        <button
                          onClick={() => updateOrderStatus(order.id, 'accepted')}
                          disabled={actionLoading === order.id}
                          className="btn-outline border-blue-500 text-blue-700 hover:bg-blue-50 py-2 px-3 text-xs font-bold flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Accept Order
                        </button>
                        <button
                          onClick={() => updateOrderStatus(order.id, 'preparing')}
                          disabled={actionLoading === order.id}
                          className="btn-primary py-2 px-3 text-xs font-bold flex items-center gap-1.5"
                        >
                          <ChefHat className="w-3.5 h-3.5" /> Start Cooking
                        </button>
                      </>
                    )}

                    {order.status === 'accepted' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'preparing')}
                        disabled={actionLoading === order.id}
                        className="btn-primary py-2 px-3 text-xs font-bold flex items-center gap-1.5"
                      >
                        <ChefHat className="w-3.5 h-3.5" /> Start Cooking
                      </button>
                    )}

                    {order.status === 'preparing' && (
                      <>
                        <button
                          onClick={() => updateOrderStatus(order.id, 'ready')}
                          disabled={actionLoading === order.id}
                          className="btn-primary bg-emerald-600 hover:bg-emerald-700 py-2 px-3 text-xs font-bold flex items-center gap-1.5"
                        >
                          <Bell className="w-3.5 h-3.5" /> Mark Ready at Counter
                        </button>

                        {/* Send 10-Minute Ready Alert to Customer */}
                        <button
                          onClick={() => handleNotifyReadySoon(order.id)}
                          disabled={actionLoading === order.id || order.readySoon}
                          className={`btn-outline py-2 px-3 text-xs font-bold flex items-center gap-1.5 transition-all ${
                            order.readySoon 
                              ? 'bg-amber-100 text-amber-900 border-amber-300' 
                              : 'border-amber-600 text-amber-700 hover:bg-amber-50'
                          }`}
                          title="Alert customer that their food will be hot & ready in 10 minutes"
                        >
                          <Bell className="w-3.5 h-3.5" />
                          {order.readySoon ? '10-Min Alert Sent' : 'Notify: Ready in 10 Mins'}
                        </button>
                      </>
                    )}

                    {/* Generate Exact Balance QR */}
                    <button
                      onClick={() => handleShowBalanceQr(order.id)}
                      disabled={qrLoading}
                      className="btn-outline py-2 px-3 text-xs font-bold flex items-center gap-1.5 border-primary text-primary hover:bg-primary/5"
                      title="Show QR on screen for customer to scan at counter"
                    >
                      <QrCode className="w-3.5 h-3.5" /> Balance QR (₹{balance})
                    </button>

                    {/* Print Bill / Kitchen Token */}
                    <button
                      onClick={() => setActiveReceiptOrder(order)}
                      className="btn-outline py-2 px-3 text-xs font-bold flex items-center gap-1.5 hover:bg-neutral-900 hover:text-white transition-all"
                      title="Print Customer Bill / POS Slip"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print Bill
                    </button>

                    {/* Collect Balance & Complete */}
                    <button
                      onClick={() => handleCollectBalance(order.id)}
                      disabled={actionLoading === order.id}
                      className="btn-primary bg-amber-600 hover:bg-amber-700 py-2 px-3 text-xs font-bold flex items-center justify-center gap-1.5 w-full sm:w-auto sm:ml-auto min-h-[38px]"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Collect ₹{balance} & Finish
                    </button>
                  </div>
                )}

                {/* Cancelled State Card with Refund Code */}
                {isCancelled && (
                  <div className="mt-3 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-red-900">Order Cancelled</span>
                      <span className="text-[10px] font-semibold text-red-700">
                        {order.cancelledBy === 'admin' ? 'By Admin' : 'By Customer'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-text-primary">
                      <span className="text-text-secondary">Refund Reference:</span>
                      <span className="font-mono font-bold px-2 py-0.5 rounded bg-red-100 text-red-900 border border-red-300">
                        {order.refundCode || 'REF-TB-' + order.id.slice(-6).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-text-secondary text-[11px]">
                      <span>Refund Status:</span>
                      {order.refundStatus === 'refunded' || order.refundStatus === 'completed' ? (
                        <span className="font-bold uppercase text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Refund Completed (₹{order.refundAmount || order.total || order.advanceAmount || 0})
                        </span>
                      ) : (
                        <span className="font-bold uppercase text-amber-700 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          Pending (₹{order.refundAmount || order.total || order.advanceAmount || 0})
                        </span>
                      )}
                    </div>
                    {order.refundStatus !== 'refunded' && order.refundStatus !== 'completed' && (
                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={() => handleMarkRefundComplete(order)}
                          disabled={actionLoading === order.id}
                          className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1.5 font-bold flex items-center gap-1.5 rounded-xl shadow-xs transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Mark Refund Complete
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Settled Badge for Completed */}
                {isDelivered && (
                  <div className="mt-3 pt-3 border-t border-border-subtle flex items-center justify-between text-xs text-emerald-700 font-bold">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Pickup Completed & Balance Fully Settled
                    </span>
                    <span className="font-mono text-text-secondary text-[11px]">
                      {new Date(order.updatedAt || order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dynamic Counter QR Modal for Instant Scan & Pay */}
      {activeQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card p-4 sm:p-6 max-w-sm w-full bg-white rounded-3xl shadow-2xl text-center space-y-4 border border-border-subtle relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setActiveQr(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-bg-subtle text-text-secondary"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-center gap-2 text-primary font-heading font-black text-lg">
              <QrCode className="w-5 h-5" />
              Tea Bhatti Counter QR
            </div>

            <p className="text-xs text-text-secondary">
              Customer can scan this code to pay the exact remaining balance of:
            </p>

            <div className="text-3xl font-mono font-black text-primary py-1">
              ₹{activeQr.exactAmount}.00
            </div>

            <img 
              src={activeQr.qrDataUrl} 
              alt="Counter Exact QR" 
              className="w-56 h-56 mx-auto rounded-2xl border-2 border-primary/20 shadow-md p-1"
            />

            <div className="text-xs font-mono font-semibold text-text-secondary">
              UPI ID: <span className="text-text-primary font-bold">{activeQr.upiId}</span>
            </div>

            <div className="pt-2">
              <button
                onClick={() => {
                  handleCollectBalance(activeQr.orderId);
                  setActiveQr(null);
                }}
                className="btn-primary w-full py-3 text-xs font-bold flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Customer Paid ₹{activeQr.exactAmount} — Mark Complete
              </button>
            </div>
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
