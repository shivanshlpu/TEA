// ── My Orders Page ──
// List of past orders with status and link to tracking.

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Package, ArrowRight, Lock, CheckCircle2, XCircle } from 'lucide-react';
import api from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const STATUS_COLORS = {
  received: 'bg-secondary/20 text-secondary',
  accepted: 'bg-info/20 text-info',
  preparing: 'bg-secondary/20 text-secondary',
  ready: 'bg-success/20 text-success',
  delivered: 'bg-success/20 text-success',
  cancelled: 'bg-error/20 text-error',
};

export default function MyOrders() {
  const { token, isAuthenticated } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadOrders();
  }, [isAuthenticated]);

  async function loadOrders() {
    try {
      const data = await api.getOrders('limit=20', token);
      setOrders(data.orders);
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-3xl bg-primary/10 mx-auto mb-6 flex items-center justify-center">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-heading font-bold text-text-primary mb-3">
          Please log in to view your orders
        </h1>
        <Link to="/login?redirect=/orders" className="btn-primary inline-flex items-center gap-2">
          Log In
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-fade-in pb-28 md:pb-8">
      <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text-primary mb-6 sm:mb-8">
        My Orders
      </h1>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-5 bg-bg-subtle rounded w-1/3 mb-3" />
              <div className="h-4 bg-bg-subtle rounded w-2/3 mb-2" />
              <div className="h-4 bg-bg-subtle rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20">
          <Package className="w-16 h-16 text-text-secondary/40 mx-auto mb-4" />
          <h2 className="text-xl font-heading font-semibold text-text-primary mb-2">
            No orders yet
          </h2>
          <p className="text-text-secondary mb-6">Place your first order and it will show up here.</p>
          <Link to="/menu" className="btn-primary inline-flex items-center gap-2">
            Browse Menu <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {orders.map(order => (
            <Link
              key={order.id}
              to={`/order/${order.id}`}
              className="card p-3.5 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 group hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-bg-subtle rounded-xl flex items-center justify-center shrink-0">
                  {order.status === 'delivered' ? (
                    <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
                  ) : order.status === 'cancelled' ? (
                    <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-error" />
                  ) : (
                    <Package className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-sm text-text-primary truncate">
                      {order.items.map(i => i.menuItem?.name || 'Item').join(', ')}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-secondary">
                    <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>{order.items.length} item{order.items.length > 1 ? 's' : ''}</span>
                    <span>•</span>
                    <span className="font-bold text-text-primary">₹{order.total.toFixed(0)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-border-subtle/50 shrink-0">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-badge capitalize ${STATUS_COLORS[order.status] || 'bg-bg-subtle text-text-secondary'}`}>
                  {order.status.replace(/_/g, ' ')}
                </span>
                <ArrowRight className="w-4 h-4 text-text-secondary group-hover:text-primary transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
