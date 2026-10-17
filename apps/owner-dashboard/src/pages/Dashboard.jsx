// ── Dashboard Page ──
// Live counters, recent orders with accept/reject.

import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { ShoppingBag, DollarSign, Users, TrendingUp, Clock, CheckCircle, XCircle, Store, Bell, Package } from 'lucide-react';
import { useAuth, SOCKET_URL } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import StoreStatusToggle from '../components/StoreStatusToggle.jsx';

const STATUS_COLORS = {
  received: 'bg-secondary/20 text-secondary border-secondary/30',
  accepted: 'bg-info/20 text-info border-info/30',
  preparing: 'bg-secondary/20 text-secondary border-secondary/30',
  ready: 'bg-success/20 text-success border-success/30',
  out_for_delivery: 'bg-primary/20 text-primary border-primary/30',
  delivered: 'bg-success/20 text-success border-success/30',
  cancelled: 'bg-error/20 text-error border-error/30',
};

export default function Dashboard() {
  const { apiFetch, user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newOrders, setNewOrders] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    loadDashboard();

    // Socket.io for real-time new orders
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      if (user?.businessId) {
        socket.emit('join-business', user.businessId);
      }
    });

    socket.on('new-order', (data) => {
      setNewOrders(prev => [data, ...prev]);
      loadDashboard(); // Refresh stats
      // Play notification sound (if available)
      try { new Audio('/notification.mp3').play(); } catch {}
    });

    socket.on('order-updated', () => loadDashboard());

    return () => socket.disconnect();
  }, []);

  async function loadDashboard() {
    try {
      const data = await apiFetch('/dashboard/summary');
      setStats(data);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function updateOrderStatus(orderId, status) {
    try {
      await apiFetch(`/orders/${orderId}/status`, { method: 'PATCH', body: { status } });
      setNewOrders(prev => prev.filter(o => o.orderId !== orderId));
      toast.success(`Order marked as ${status.replace(/_/g, ' ')}`);
      loadDashboard();
    } catch (err) {
      toast.error(err.message || 'Failed to update order');
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-5"><div className="h-16 bg-bg-subtle rounded" /></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-black text-text-primary tracking-tight">Dashboard Overview</h1>
          <p className="text-sm text-text-secondary">Welcome back, {user?.name || 'Owner'} • Pure Veg Pickup Cafe</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <StoreStatusToggle />
          <a
            href="/pickups"
            className="btn-primary text-xs font-bold px-4 py-2.5 flex items-center gap-1.5 shadow-md min-h-[38px]"
          >
            <Store className="w-3.5 h-3.5" /> Open Pickup Operations
          </a>
          <span className="text-xs text-text-secondary bg-white px-3 py-2 rounded-xl border border-border-subtle font-medium">
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { icon: DollarSign, label: "Today's Revenue", value: `₹${stats?.todayRevenue?.toFixed(0) || 0}`, color: 'primary' },
          { icon: ShoppingBag, label: "Today's Orders", value: stats?.todayOrders || 0, color: 'secondary' },
          { icon: Clock, label: 'Pending', value: stats?.pendingCount || 0, color: 'accent' },
          { icon: Users, label: 'Total Customers', value: stats?.totalCustomers || 0, color: 'success' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="card p-4 sm:p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 bg-${color}/10 rounded-xl flex items-center justify-center`}>
                <Icon className={`w-5 h-5 text-${color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-text-primary">{value}</p>
            <p className="text-sm text-text-secondary mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Order Status Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {[
          { label: 'Pending', count: stats?.pendingCount, color: 'secondary' },
          { label: 'Preparing', count: stats?.preparingCount, color: 'accent' },
          { label: 'Delivered', count: stats?.deliveredCount, color: 'success' },
          { label: 'Cancelled', count: stats?.cancelledCount, color: 'error' },
        ].map(({ label, count, color }) => (
          <div key={label} className={`p-3.5 sm:p-4 rounded-card bg-${color}/5 border border-${color}/20 text-center`}>
            <p className={`text-xl font-bold text-${color}`}>{count || 0}</p>
            <p className="text-xs text-text-secondary mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* New Order Alerts */}
      {newOrders.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-heading font-semibold text-lg text-text-primary flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" /> New Orders
            <span className="bg-primary text-white text-xs px-2 py-0.5 rounded-badge animate-pulse-warm">
              {newOrders.length}
            </span>
          </h2>
          {newOrders.map(order => (
            <div key={order.orderId} className="card p-4 border-2 border-secondary/30 animate-slide-up">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-mono text-text-secondary">#{order.orderId.slice(0, 8)}</span>
                  <p className="font-bold text-text-primary">₹{order.total} — {order.itemCount} items</p>
                  <p className="text-xs text-text-secondary capitalize">{order.orderType}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateOrderStatus(order.orderId, 'accepted')}
                    className="flex items-center gap-1.5 px-4 py-2 bg-success text-white rounded-button
                             font-medium text-sm hover:brightness-110 transition-all"
                  >
                    <CheckCircle className="w-4 h-4" /> Accept
                  </button>
                  <button
                    onClick={() => {
                      // Cancel via the cancel endpoint
                      apiFetch(`/orders/${order.orderId}/cancel`, { method: 'PATCH' })
                        .then(() => {
                          setNewOrders(prev => prev.filter(o => o.orderId !== order.orderId));
                          loadDashboard();
                        });
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-error/10 text-error rounded-button
                             font-medium text-sm hover:bg-error/20 transition-all"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent Orders */}
      <div>
        <h2 className="font-heading font-semibold text-lg text-text-primary mb-4">Recent Orders</h2>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-subtle/50">
                  <th className="text-left px-4 py-3 font-semibold text-text-secondary">Order ID</th>
                  <th className="text-left px-4 py-3 font-semibold text-text-secondary">Customer</th>
                  <th className="text-left px-4 py-3 font-semibold text-text-secondary">Items</th>
                  <th className="text-left px-4 py-3 font-semibold text-text-secondary">Total</th>
                  <th className="text-left px-4 py-3 font-semibold text-text-secondary">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-text-secondary">Time</th>
                  <th className="text-left px-4 py-3 font-semibold text-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {stats?.recentOrders?.map(order => (
                  <tr key={order.id} className="border-b border-border-subtle last:border-0 hover:bg-bg-subtle/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-primary">
                      {order.pickupCode || '#' + order.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-text-primary">{order.customer?.user?.name || 'Customer'}</p>
                        <p className="text-xs text-text-secondary">{order.customer?.user?.phone}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {order.items.map(i => i.menuItem?.name).filter(Boolean).join(', ').slice(0, 40)}
                    </td>
                    <td className="px-4 py-3 font-bold text-text-primary">₹{order.total.toFixed(0)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-badge capitalize border ${STATUS_COLORS[order.status] || ''}`}>
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs">
                      {new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      {order.status === 'received' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'accepted')}
                          className="text-xs text-success font-medium hover:underline"
                        >
                          Accept
                        </button>
                      )}
                      {order.status === 'accepted' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'preparing')}
                          className="text-xs text-primary font-medium hover:underline"
                        >
                          Start Prep
                        </button>
                      )}
                      {order.status === 'preparing' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'ready')}
                          className="text-xs text-success font-medium hover:underline"
                        >
                          Mark Ready
                        </button>
                      )}
                      {order.status === 'ready' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'delivered')}
                          className="text-xs text-success font-medium hover:underline"
                        >
                          Mark Delivered
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(!stats?.recentOrders || stats.recentOrders.length === 0) && (
            <div className="p-8 text-center text-text-secondary">
              <Package className="w-10 h-10 text-border-subtle mx-auto mb-2" />
              <p>No orders yet. They'll show up here in real-time.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
