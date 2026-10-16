// ── Order Tracking Page — Tea Bhatti ──
// Dedicated Store Pickup Progression, Live Pickup Token Display, Exact UTR Verification,
// 10-Minute Pre-Ready Notification Banner, Preparing Lockout Rule, and Refund Code Tracking.
// Zero AI emojis; crisp Lucide vector icons and high-fidelity celebratory animations.

import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { 
  CheckCircle2, 
  Clock, 
  Phone, 
  ArrowLeft, 
  MapPin, 
  Star, 
  Send, 
  Store, 
  QrCode, 
  Receipt, 
  AlertTriangle,
  ShieldCheck,
  XCircle,
  Sparkles,
  ChefHat,
  Bell,
  CreditCard,
  Lock,
  RefreshCw
} from 'lucide-react';
import api, { SOCKET_URL } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import PaymentReceiptModal from '../components/PaymentReceiptModal.jsx';
import { OrderDoneModal, firePaymentCelebration } from '../components/CelebrationEffects.jsx';

const PICKUP_STEPS = [
  { key: 'received', label: 'Order Received', desc: 'Payment submitted & awaiting confirmation', icon: CreditCard },
  { key: 'accepted', label: 'Order Accepted', desc: 'Shop acknowledged & scheduled', icon: CheckCircle2 },
  { key: 'preparing', label: 'Preparing Fresh', desc: 'Chef is cooking your items (Cancellation locked)', icon: ChefHat },
  { key: 'ready', label: 'Ready at Counter', desc: 'Packaged & hot for pickup', icon: Bell },
  { key: 'delivered', label: 'Picked Up & Completed', desc: 'Order collected & completed', icon: CheckCircle2 },
];

export default function OrderTracking() {
  const { orderId } = useParams();
  const { token, isAuthenticated } = useAuth();
  const { toast, confirm } = useToast();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const socketRef = useRef(null);

  // 10-Minute Ready Alert state
  const [readySoonAlert, setReadySoonAlert] = useState(false);

  // Order Done Modal state
  const [showOrderDoneModal, setShowOrderDoneModal] = useState(false);
  const [hasCelebratedReady, setHasCelebratedReady] = useState(false);

  // Cancellation & refund state
  const [cancelling, setCancelling] = useState(false);
  const [cancelNotice, setCancelNotice] = useState(null);

  // Counter QR Modal state
  const [balanceQrData, setBalanceQrData] = useState(null);
  const [loadingQr, setLoadingQr] = useState(false);

  // Digital Receipt modal state
  const [receiptData, setReceiptData] = useState(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  // Review state
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [existingReview, setExistingReview] = useState(null);

  useEffect(() => {
    loadOrder();

    // Real-time Socket.io updates
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-order', orderId);
    });

    socket.on('order-status-update', (data) => {
      if (data.orderId === orderId) {
        setOrder(prev => prev ? { ...prev, ...data } : prev);
        
        // Trigger celebration on Ready or Delivered
        if ((data.status === 'ready' || data.status === 'delivered') && !hasCelebratedReady) {
          setShowOrderDoneModal(true);
          setHasCelebratedReady(true);
        }
        loadOrder();
      }
    });

    socket.on('order-ready-soon', (data) => {
      if (data.orderId === orderId) {
        setReadySoonAlert(true);
        try {
          // Play a pleasant chime if possible
          const audio = new Audio('/notification.mp3');
          audio.play().catch(() => {});
        } catch (_) {}
      }
    });

    socket.on('payment-update', (data) => {
      if (data.orderId === orderId) {
        setOrder(prev => prev ? { ...prev, paymentStatus: data.paymentStatus } : prev);
        if (data.paymentStatus === 'verified') {
          firePaymentCelebration();
        }
      }
    });

    return () => socket.disconnect();
  }, [orderId]);

  async function loadOrder() {
    try {
      const data = await api.getOrder(orderId, token);
      setOrder(data);

      if (data.readySoon) {
        setReadySoonAlert(true);
      }

      if (data.status === 'delivered' && token) {
        try {
          const rev = await api.checkReview(orderId, token);
          if (rev.reviewed) {
            setExistingReview(rev.review);
            setReviewSubmitted(true);
          }
        } catch (_) {}
      }
    } catch (err) {
      setError(err.message || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }

  // Handle Cancellation
  async function handleCancelOrder() {
    const ok = await confirm({
      title: 'Cancel Order?',
      message: 'Are you sure you want to cancel this order? Once food preparation starts, cancellation is locked.',
      confirmText: 'Yes, Cancel Order',
      cancelText: 'Keep Order',
      isDestructive: true,
    });
    if (!ok) return;

    setCancelling(true);
    try {
      const res = await api.cancelAndRefund(orderId, token);
      setCancelNotice(res.displayMessage);
      toast.info(res.displayMessage || 'Cancellation request processed');
      loadOrder();
    } catch (err) {
      toast.error(err.message || 'Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  }

  // Load Digital Receipt
  async function handleOpenReceipt() {
    setLoadingReceipt(true);
    try {
      const rec = await api.getOrderReceipt(orderId, token);
      setReceiptData(rec);
    } catch (err) {
      toast.error(err.message || 'Failed to load receipt');
    } finally {
      setLoadingReceipt(false);
    }
  }

  // Load Counter Balance QR
  async function handleOpenBalanceQr() {
    setLoadingQr(true);
    try {
      const qr = await api.getOrderQr(orderId);
      setBalanceQrData(qr);
    } catch (err) {
      toast.error(err.message || 'Failed to load payment QR');
    } finally {
      setLoadingQr(false);
    }
  }

  // Review Submission
  async function handleSubmitReview(e) {
    e.preventDefault();
    if (reviewRating === 0) return;
    setReviewSubmitting(true);
    try {
      await api.submitReview({
        orderId,
        rating: reviewRating,
        comment: reviewComment || undefined,
      }, token);
      setReviewSubmitted(true);
      setExistingReview({ rating: reviewRating, comment: reviewComment });
      toast.success('Thank you! Your review has been submitted.');
    } catch (err) {
      toast.error(err.message || 'Failed to submit review');
    } finally {
      setReviewSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-3xl bg-primary/10 mx-auto mb-4 flex items-center justify-center">
          <Clock className="w-8 h-8 text-primary animate-spin" />
        </div>
        <p className="text-sm font-bold text-text-primary">Loading order details...</p>
        <p className="text-xs text-text-secondary mt-1">Connecting to Tea Bhatti Cafe live kitchen</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-3xl bg-error/10 mx-auto mb-4 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-error" />
        </div>
        <p className="text-base font-bold text-error mb-4">{error || 'Order not found'}</p>
        <Link to="/orders" className="btn-primary text-xs px-6 py-2.5">
          Back to My Orders
        </Link>
      </div>
    );
  }

  const currentStepIdx = PICKUP_STEPS.findIndex(s => s.key === order.status);
  const isCancelled = order.status === 'cancelled';
  const isPreparing = order.status === 'preparing';
  const isReady = order.status === 'ready';
  const isDelivered = order.status === 'delivered';
  
  // Strict cancellation rule: Customer can cancel ONLY before preparing starts!
  const canCancel = ['received', 'accepted'].includes(order.status);

  const advancePaid = ['advance_paid', 'fully_paid', 'verified'].includes(order.paymentStatus);
  const advanceAmount = order.advanceAmount || Math.round(order.total * 0.20);
  const balanceAmount = order.balanceAmount || Math.round(order.total - advanceAmount);
  const refundCode = order.refundCode || `REF-TB-${order.id.slice(-6).toUpperCase()}`;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-fade-in space-y-6 pb-28 md:pb-8">
      
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <Link 
          to="/orders" 
          className="flex items-center gap-2 text-xs font-bold text-text-secondary hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to My Orders
        </Link>
        <button
          onClick={handleOpenReceipt}
          disabled={loadingReceipt}
          className="btn-outline px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5"
        >
          <Receipt className="w-3.5 h-3.5" />
          {loadingReceipt ? 'Loading...' : 'Digital Receipt'}
        </button>
      </div>

      {/* 10-Minute Pre-Ready Notification Banner */}
      {readySoonAlert && !isReady && !isDelivered && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-600 via-primary to-orange-600 text-white flex items-center justify-between shadow-xl animate-bounce">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <p className="font-heading font-black text-sm text-white">
                Ready in 10 Minutes!
              </p>
              <p className="text-xs text-white/90">
                Your order is almost finished. Please head over to the counter at Tea Bhatti Cafe to collect it hot & fresh.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Notice Banner */}
      {cancelNotice && (
        <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 text-xs font-medium space-y-1 animate-fade-in">
          <p className="font-bold flex items-center gap-1.5 text-emerald-800 text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Order Cancelled & Refund Initiated
          </p>
          <p>{cancelNotice}</p>
        </div>
      )}

      {/* Main Order & Pickup Header Card */}
      <div className="card p-6 border-2 border-primary/20 bg-gradient-to-br from-white via-white to-amber-50/20 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border-subtle">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full bg-primary text-white">
                Store Pickup
              </span>
              <span className="text-xs text-text-secondary font-mono">
                Order #{order.id.slice(-6).toUpperCase()}
              </span>
            </div>
            <h1 className="text-2xl font-heading font-black text-text-primary tracking-tight">
              Tea Bhatti Cafe Pickup
            </h1>
            <p className="text-xs text-text-secondary mt-0.5">
              Placed on {new Date(order.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>

          {/* Large Pickup Token Display */}
          <div className="bg-gradient-to-br from-primary to-amber-700 text-white p-4 rounded-2xl text-center shadow-lg shrink-0">
            <span className="text-[10px] text-white/80 uppercase font-black tracking-wider block">
              Pickup Token
            </span>
            <div className="text-3xl font-mono font-black tracking-wider text-amber-200">
              {order.pickupCode || 'TB-READY'}
            </div>
            <span className="text-[10px] text-white/90 block mt-1 font-semibold">
              Show at Counter
            </span>
          </div>
        </div>

        {/* Payment Breakdown: Paid Advance vs Due at Counter */}
        <div className="mt-6 grid sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
              UPI Advance Paid
            </span>
            <div className="flex items-center justify-between">
              <span className="text-xl font-mono font-black text-emerald-700">₹{advanceAmount}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                {advancePaid ? 'Verified & Confirmed' : order.paymentStatus === 'utr_submitted' ? 'UTR Verification Pending' : 'Pending'}
              </span>
            </div>
            {order.paymentUtr && (
              <p className="text-[10px] text-emerald-800 font-mono">UTR: {order.paymentUtr}</p>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-1">
            <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider block">
              Remaining Balance at Counter
            </span>
            <div className="flex items-center justify-between">
              <span className="text-xl font-mono font-black text-amber-900">
                {isDelivered ? '₹0.00 (Settled)' : `₹${balanceAmount}.00`}
              </span>
              {!isDelivered ? (
                <button
                  onClick={handleOpenBalanceQr}
                  disabled={loadingQr}
                  className="text-xs font-bold px-2.5 py-1 rounded-xl bg-primary text-white hover:bg-primary-hover transition-colors flex items-center gap-1 shadow-sm"
                >
                  <QrCode className="w-3 h-3" /> Pay Balance QR
                </button>
              ) : (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Fully Settled
                </span>
              )}
            </div>
            <p className="text-[10px] text-amber-800">
              {isDelivered ? 'Settled upon food pickup' : 'Pay via Cash or Counter QR on arrival'}
            </p>
          </div>
        </div>

        {/* Counter Ready Announcement */}
        {isReady && (
          <div className="mt-4 p-4 rounded-2xl bg-emerald-600 text-white flex items-center justify-between shadow-lg animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5 text-amber-200" />
              </div>
              <div>
                <p className="font-heading font-black text-base">Your Order is Hot & Ready!</p>
                <p className="text-xs text-white/90">Please present token #{order.pickupCode} at Tea Bhatti Cafe counter.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stepper Progression UI */}
      {!isCancelled ? (
        <div className="card p-6 border-2 border-border-subtle">
          <h2 className="font-heading font-bold text-base text-text-primary mb-6 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Live Pickup Progression
          </h2>

          <div className="space-y-6">
            {PICKUP_STEPS.map((step, idx) => {
              const isPast = idx < currentStepIdx;
              const isCurrent = idx === currentStepIdx;
              const StepIcon = step.icon;

              return (
                <div key={step.key} className="flex items-start gap-4 relative">
                  {/* Connecting Line */}
                  {idx < PICKUP_STEPS.length - 1 && (
                    <div 
                      className={`absolute left-5 top-10 bottom-0 w-0.5 -mb-6 ${
                        idx < currentStepIdx ? 'bg-primary' : 'bg-border-subtle'
                      }`} 
                    />
                  )}

                  {/* Icon Circle */}
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 z-10 transition-all ${
                    isCurrent
                      ? 'bg-primary text-white shadow-md ring-4 ring-primary/20 scale-105'
                      : isPast
                      ? 'bg-emerald-600 text-white'
                      : 'bg-bg-subtle text-text-secondary'
                  }`}>
                    {isPast ? <CheckCircle2 className="w-5 h-5 text-white" /> : <StepIcon className="w-5 h-5" />}
                  </div>

                  {/* Step Text */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center justify-between">
                      <h3 className={`font-heading font-bold text-sm ${
                        isCurrent ? 'text-primary' : isPast ? 'text-text-primary' : 'text-text-secondary'
                      }`}>
                        {step.label}
                      </h3>
                      {isCurrent && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary animate-pulse">
                          Current Stage
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary mt-0.5">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Cancelled State Card with Dedicated Refund Code */
        <div className="card p-6 border-2 border-red-300 bg-red-50/50 space-y-4">
          <div className="flex items-center gap-3 text-red-900">
            <XCircle className="w-6 h-6 text-red-600 shrink-0" />
            <div>
              <h2 className="font-heading font-bold text-lg">Order Cancelled</h2>
              <p className="text-xs text-red-700">This order has been cancelled and will not be prepared.</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-red-200 text-xs space-y-2.5">
            <div className="flex justify-between items-center font-bold text-text-primary">
              <span className="text-text-secondary">Refund Reference Code:</span>
              <span className="font-mono text-sm px-2.5 py-1 bg-amber-100 text-amber-900 rounded-lg border border-amber-300">
                {refundCode}
              </span>
            </div>
            <div className="flex justify-between font-semibold text-text-primary">
              <span className="text-text-secondary">Refund Status:</span>
              <span className="text-emerald-700 font-bold uppercase">{order.refundStatus || 'Refunded'}</span>
            </div>
            <div className="flex justify-between font-semibold text-text-primary">
              <span className="text-text-secondary">Refund Amount:</span>
              <span className="font-mono font-bold text-emerald-700">₹{order.refundAmount || advanceAmount}.00</span>
            </div>
            <p className="text-[11px] text-text-secondary pt-2 border-t border-border-subtle">
              This Refund Reference Code (<strong>{refundCode}</strong>) is specifically provided for you and the Tea Bhatti Cafe owner to track and settle your refund.
            </p>
          </div>
        </div>
      )}

      {/* Pickup Store Location Info */}
      <div className="card p-5 border border-border-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <MapPin className="w-5 h-5 text-primary" />
          </div>
          <div className="text-xs">
            <h3 className="font-heading font-bold text-text-primary text-sm">Tea Bhatti Cafe</h3>
            <p className="text-text-secondary">Near Medical College, Shahdol, Madhya Pradesh</p>
            <p className="text-text-secondary font-medium">Phone: +91 9009149694</p>
          </div>
        </div>

        <a 
          href="tel:+919009149694" 
          className="btn-outline px-4 py-2 text-xs font-bold flex items-center gap-1.5 shrink-0"
        >
          <Phone className="w-3.5 h-3.5" /> Call Store
        </a>
      </div>

      {/* Order Item Details */}
      <div className="card p-6 border border-border-subtle space-y-4">
        <h2 className="font-heading font-bold text-base text-text-primary pb-3 border-b border-border-subtle">
          Order Items ({order.items?.length || 0})
        </h2>

        <div className="divide-y divide-border-subtle/70">
          {order.items?.map((item, idx) => (
            <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-primary w-5">{item.quantity}x</span>
                <div>
                  <span className="font-semibold text-text-primary">{item.menuItem?.name || 'Dish'}</span>
                  {item.addOns && item.addOns !== '[]' && (
                    <p className="text-[10px] text-text-secondary">
                      + {JSON.parse(item.addOns).map(a => a.name).join(', ')}
                    </p>
                  )}
                </div>
              </div>
              <span className="font-bold text-text-primary font-mono">
                ₹{(item.priceEach * item.quantity).toFixed(0)}
              </span>
            </div>
          ))}
        </div>

        {/* Cancellation Eligibility vs Preparation Lockout Rule */}
        {canCancel && (
          <div className="pt-4 border-t border-border-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-red-50/50 p-4 rounded-2xl">
            <div className="text-xs text-red-900">
              <span className="font-bold block">Need to cancel?</span>
              <span className="text-[11px] text-red-700">
                You can cancel before kitchen preparation starts. Once the chef marks the order as "preparing", cancellation is locked.
              </span>
            </div>
            <button
              onClick={handleCancelOrder}
              disabled={cancelling}
              className="btn-outline border-error text-error hover:bg-error hover:text-white px-4 py-2 text-xs font-bold shrink-0 transition-colors"
            >
              {cancelling ? 'Processing...' : 'Cancel Order & Process Refund'}
            </button>
          </div>
        )}

        {/* Lockout Notice when Preparing */}
        {isPreparing && (
          <div className="pt-4 border-t border-border-subtle p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs space-y-1">
            <span className="font-bold text-amber-900 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-700" />
              Kitchen Preparation in Progress — Cancellation Closed
            </span>
            <p className="text-[11px] text-text-secondary">
              Our chef is actively preparing your order. In accordance with store policy, orders cannot be cancelled once cooking starts.
            </p>
          </div>
        )}
      </div>

      {/* Review Section on Delivered */}
      {isDelivered && (
        <div className="card p-6 border-2 border-secondary/30 bg-gradient-to-br from-amber-50/30 via-white to-orange-50/20">
          <h2 className="font-heading font-bold text-lg text-text-primary mb-2 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-secondary" />
            How was your Tea Bhatti Cafe experience?
          </h2>
          <p className="text-xs text-text-secondary mb-4">
            Rate your food and pickup service to help us maintain peak quality!
          </p>

          {reviewSubmitted ? (
            <div className="p-4 rounded-2xl bg-white border border-border-subtle flex items-center gap-3">
              <Star className="w-6 h-6 text-secondary fill-secondary" />
              <div>
                <p className="text-xs font-bold text-text-primary">Thank you for your feedback!</p>
                <div className="flex gap-1 text-secondary mt-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${star <= (existingReview?.rating || 0) ? 'fill-secondary text-secondary' : 'text-gray-300'}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmitReview} className="space-y-4">
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    type="button"
                    key={star}
                    onClick={() => setReviewRating(star)}
                    onMouseEnter={() => setReviewHover(star)}
                    onMouseLeave={() => setReviewHover(0)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-7 h-7 ${
                        star <= (reviewHover || reviewRating)
                          ? 'fill-secondary text-secondary'
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>

              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share your thoughts on the food flavor, hot temperature, and pickup ease..."
                rows={3}
                className="input-field text-xs resize-none"
              />

              <button
                type="submit"
                disabled={reviewRating === 0 || reviewSubmitting}
                className="btn-primary text-xs font-bold px-6 py-2.5 flex items-center gap-2"
              >
                <Send className="w-3.5 h-3.5" />
                {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Dynamic Counter Balance QR Modal */}
      {balanceQrData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card p-4 sm:p-6 max-w-sm w-full text-center space-y-4 bg-white rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-heading font-black text-lg text-text-primary">
              Pay Remaining Balance at Counter
            </h3>
            <p className="text-xs text-text-secondary">
              Scan this dynamic QR code to settle the remaining balance of:
            </p>
            <div className="text-2xl font-mono font-black text-primary">
              ₹{balanceQrData.exactAmount}.00
            </div>
            {balanceQrData.qrDataUrl && (
              <img 
                src={balanceQrData.qrDataUrl} 
                alt="Counter Balance QR" 
                className="w-56 h-56 mx-auto rounded-2xl shadow-md border-2 border-primary/20 p-1"
              />
            )}
            <button
              onClick={() => setBalanceQrData(null)}
              className="btn-outline w-full py-2.5 text-xs font-bold"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* High-Quality Order Done Modal */}
      {showOrderDoneModal && (
        <OrderDoneModal
          order={order}
          isReady={isReady}
          onClose={() => setShowOrderDoneModal(false)}
        />
      )}

      {/* Payment Receipt Modal */}
      {receiptData && (
        <PaymentReceiptModal
          receipt={receiptData}
          onClose={() => setReceiptData(null)}
        />
      )}

    </div>
  );
}
