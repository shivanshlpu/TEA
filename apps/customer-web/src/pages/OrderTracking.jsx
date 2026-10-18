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
  RefreshCw,
  MessageCircle,
  X
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
  const [cancelSecondsLeft, setCancelSecondsLeft] = useState(0);
  const [showRefundPolicyModal, setShowRefundPolicyModal] = useState(false);

  // UTR Re-submission state
  const [resubmitUtr, setResubmitUtr] = useState('');
  const [submittingUtr, setSubmittingUtr] = useState(false);

  // 5-minute cancellation window countdown
  useEffect(() => {
    if (!order?.createdAt || order.status === 'cancelled' || order.status === 'delivered') return;

    const updateTimer = () => {
      const orderCreatedTime = new Date(order.createdAt).getTime();
      const fiveMinutesMs = 5 * 60 * 1000;
      const elapsed = Date.now() - orderCreatedTime;
      const remaining = Math.max(0, Math.floor((fiveMinutesMs - elapsed) / 1000));
      setCancelSecondsLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [order?.createdAt, order?.status]);

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
        setOrder(prev => prev ? {
          ...prev,
          ...data,
          cancelledBy: data.cancelledBy || prev.cancelledBy,
          refundStatus: data.refundStatus || prev.refundStatus,
          refundAmount: data.refundAmount !== undefined ? data.refundAmount : prev.refundAmount,
          refundedAt: data.refundedAt || prev.refundedAt,
          paymentRejectReason: data.paymentRejectReason !== undefined ? data.paymentRejectReason : prev.paymentRejectReason,
        } : prev);
        
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
        setOrder(prev => prev ? {
          ...prev,
          paymentStatus: data.paymentStatus,
          refundStatus: data.refundStatus || prev.refundStatus,
          refundAmount: data.refundAmount !== undefined ? data.refundAmount : prev.refundAmount,
          refundedAt: data.refundedAt || prev.refundedAt,
          paymentUtr: data.paymentUtr !== undefined ? data.paymentUtr : prev.paymentUtr,
          paymentRejectReason: data.paymentRejectReason !== undefined ? data.paymentRejectReason : prev.paymentRejectReason,
        } : prev);
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

  // Handle UTR Re-submission after payment rejection
  async function handleResubmitUtr(e) {
    if (e) e.preventDefault();
    const clean = resubmitUtr.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (clean.length < 6) {
      toast.error('Please enter a valid 12-digit UTR reference number');
      return;
    }
    setSubmittingUtr(true);
    try {
      const res = await api.submitUtr(orderId, { utr: clean }, token);
      toast.success(res.message || 'UTR re-submitted! The cafe owner has been notified to verify.');
      setOrder(prev => prev ? {
        ...prev,
        paymentStatus: 'utr_submitted',
        paymentUtr: clean,
        paymentRejectReason: null,
      } : prev);
      setResubmitUtr('');
    } catch (err) {
      toast.error(err.message || 'Failed to submit UTR');
    } finally {
      setSubmittingUtr(false);
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
  
  // Strict cancellation rule: Customer can cancel ONLY within 5 minutes AND before preparing starts!
  const isWithinFiveMinutes = cancelSecondsLeft > 0;
  const canCancelOnline = ['received', 'accepted'].includes(order.status) && isWithinFiveMinutes;
  const cancelMinutes = Math.floor(cancelSecondsLeft / 60);
  const cancelSeconds = cancelSecondsLeft % 60;
  const cancelCountdownStr = `${cancelMinutes}:${cancelSeconds < 10 ? '0' : ''}${cancelSeconds}`;

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRefundPolicyModal(true)}
            className="text-xs font-bold text-primary hover:underline px-2.5 py-1.5 rounded-xl border border-primary/20 hover:bg-primary/5 transition-colors"
          >
            Refund Policy
          </button>
          <button
            onClick={handleOpenReceipt}
            disabled={loadingReceipt}
            className="btn-outline px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5"
          >
            <Receipt className="w-3.5 h-3.5" />
            {loadingReceipt ? 'Loading...' : 'Digital Receipt'}
          </button>
        </div>
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
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                advancePaid 
                  ? 'bg-emerald-200 text-emerald-900' 
                  : (order.paymentStatus === 'rejected' || order.paymentStatus === 'failed')
                  ? 'bg-rose-200 text-rose-950 font-black border border-rose-300'
                  : order.paymentStatus === 'utr_submitted'
                  ? 'bg-blue-100 text-blue-900'
                  : 'bg-amber-100 text-amber-900'
              }`}>
                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                {advancePaid 
                  ? 'Verified & Confirmed' 
                  : order.paymentStatus === 'utr_submitted' 
                  ? 'UTR Verification Pending' 
                  : (order.paymentStatus === 'rejected' || order.paymentStatus === 'failed')
                  ? 'UTR Incorrect'
                  : 'Pending'}
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

        {/* UTR Verification Required Alert & Dedicated UTR Re-entry Form */}
        {(order.paymentStatus === 'rejected' || order.paymentStatus === 'failed') && !isCancelled && (
          <div className="mt-4 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-rose-50 via-red-50 to-amber-50 border-2 border-rose-300 text-rose-950 space-y-3 animate-fade-in shadow-md">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-200 flex items-center justify-center text-rose-800 shrink-0 mt-0.5 shadow-xs">
                <AlertTriangle className="w-5 h-5 text-rose-700" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-heading font-black text-rose-900 text-sm sm:text-base">
                    UTR / Reference Number Incorrect
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 border border-rose-300 uppercase">
                    Action Required
                  </span>
                </div>
                <p className="text-xs font-bold text-rose-900 leading-relaxed">
                  {order.paymentRejectReason && !order.paymentRejectReason.includes('rejected by cafe')
                    ? order.paymentRejectReason
                    : 'Payment reference needs verification.'}
                </p>
                <p className="text-[11px] text-rose-800">
                  Please verify the 12-digit UTR or transaction ID in your UPI app and submit it below to confirm your order.
                </p>
              </div>
            </div>

            <form onSubmit={handleResubmitUtr} className="pt-2 flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={resubmitUtr}
                onChange={(e) => setResubmitUtr(e.target.value.toUpperCase())}
                placeholder="Enter correct 12-digit UPI / UTR number"
                maxLength={30}
                className="flex-1 px-4 py-2.5 rounded-xl border border-rose-300 bg-white font-mono text-xs sm:text-sm font-bold text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-inner"
                required
              />
              <button
                type="submit"
                disabled={submittingUtr || !resubmitUtr.trim()}
                className="btn-primary bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shrink-0 transition-colors shadow-sm disabled:opacity-50"
              >
                {submittingUtr ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Re-submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Submit UTR Again
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* UTR Submitted Pending Verification Alert */}
        {order.paymentStatus === 'utr_submitted' && !isCancelled && (
          <div className="mt-4 p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-950 flex items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
              <div>
                <p className="font-bold text-xs text-blue-900">
                  UTR #{order.paymentUtr} Submitted for Verification
                </p>
                <p className="text-[11px] text-blue-700">
                  Payment reference submitted. Verifying transaction automatically...
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setResubmitUtr(order.paymentUtr || '');
                setOrder(prev => ({ ...prev, paymentStatus: 'rejected' }));
              }}
              className="text-[11px] font-bold text-blue-800 hover:underline shrink-0"
              title="Need to update UTR?"
            >
              Edit UTR
            </button>
          </div>
        )}

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
        /* Cancelled State Card with Dedicated Refund Code & Admin Cancellation 100% Refund Guarantee */
        <div className={`card p-6 border-2 space-y-4 ${
          order.cancelledBy === 'admin'
            ? 'border-red-400 bg-gradient-to-br from-red-50 via-rose-50 to-amber-50/50 shadow-md'
            : 'border-red-300 bg-red-50/50'
        }`}>
          <div className="flex items-start gap-3.5 text-red-900">
            <div className="w-11 h-11 rounded-2xl bg-red-100 border border-red-200 flex items-center justify-center text-red-600 shrink-0 mt-0.5 shadow-xs">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-heading font-black text-lg sm:text-xl text-red-950">
                  {order.cancelledBy === 'admin' ? 'Cancelled by the Cafe Admin' : 'Order Cancelled'}
                </h2>
                {order.cancelledBy === 'admin' && (
                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-red-600 text-white shadow-xs">
                    Admin Action
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm font-semibold text-red-900 leading-relaxed">
                {order.cancelledBy === 'admin'
                  ? `Your order has been cancelled by the admin. Your 20% advance payment of ₹${order.refundAmount || advanceAmount}.00 has been refunded to your original payment method via Razorpay.`
                  : `This order has been cancelled and will not be prepared. Your 20% advance payment of ₹${order.refundAmount || advanceAmount}.00 has been refunded to your original payment method via Razorpay.`}
              </p>
            </div>
          </div>

          {/* Refund Notice Banner */}
          {(order.refundStatus === 'refunded' || order.refundStatus === 'completed' || (order.refundAmount && order.refundAmount > 0)) && (
            <div className="p-4 rounded-2xl border-2 space-y-2 animate-fade-in shadow-xs bg-emerald-50 border-emerald-400 text-emerald-950">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-emerald-900 font-black text-sm">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <span>20% Advance Refund Processed via Razorpay</span>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 font-mono bg-emerald-600 text-white border-emerald-700 shadow-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" /> Refund Initiated
                </span>
              </div>
              <p className="text-xs text-emerald-900 leading-relaxed">
                Your 20% advance payment of ₹{order.refundAmount || advanceAmount}.00 has been refunded through Razorpay back to your original source account (UPI / Bank).
              </p>
            </div>
          )}

          <div className="p-4 rounded-2xl bg-white border border-red-200 text-xs space-y-2.5 shadow-inner">
            <div className="flex justify-between items-center font-bold text-text-primary">
              <span className="text-text-secondary">Refund Reference Code:</span>
              <span className="font-mono text-sm px-2.5 py-1 bg-amber-100 text-amber-900 rounded-lg border border-amber-300">
                {refundCode}
              </span>
            </div>
            <div className="flex justify-between font-semibold text-text-primary">
              <span className="text-text-secondary">Refund Status:</span>
              {order.refundStatus === 'refunded' || order.refundStatus === 'completed' ? (
                <span className="text-emerald-700 font-bold uppercase flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" /> Processed via Razorpay
                </span>
              ) : (
                <span className="text-amber-700 font-bold uppercase flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-600 inline" /> Pending (Processing)
                </span>
              )}
            </div>
            <div className="flex justify-between font-semibold text-text-primary">
              <span className="text-text-secondary">Refund Amount:</span>
              <span className="font-mono font-bold text-emerald-700 text-sm">
                ₹{order.refundAmount || advanceAmount}.00 (20% Advance)
              </span>
            </div>
            <div className="flex justify-between font-semibold text-text-primary">
              <span className="text-text-secondary">
                {order.refundStatus === 'refunded' || order.refundStatus === 'completed' ? 'Refund Initiated At:' : 'Expected Bank Credit:'}
              </span>
              <span className="text-emerald-800 font-bold">
                {order.refundStatus === 'refunded' || order.refundStatus === 'completed'
                  ? (order.refundedAt ? new Date(order.refundedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Initiated')
                  : '5–7 Working Days (Bank TAT)'}
              </span>
            </div>
            <p className="text-[11px] text-text-secondary pt-2 border-t border-border-subtle">
              {order.refundStatus === 'refunded' || order.refundStatus === 'completed'
                ? `The refund has been completed under reference ${refundCode}. If you have any questions, you can present this reference code to Tea Bhatti Cafe.`
                : (order.cancelledBy === 'admin'
                  ? `The cafe admin has scheduled your advance refund under code ${refundCode}. You can present this reference if you have any questions.`
                  : `This Refund Reference Code (${refundCode}) is specifically provided for you and the Tea Bhatti Cafe owner to track and settle your refund.`)}
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
            <p className="text-text-secondary font-medium">Phone: +91 7000748920</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a 
            href="https://wa.me/917000748920?text=Hi%20Tea%20Bhatti%2C%20I%20have%20an%20inquiry%20regarding%20my%20order" 
            target="_blank"
            rel="noreferrer"
            className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 rounded-xl transition-colors shadow-xs"
          >
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
          </a>
          <a 
            href="tel:+917000748920" 
            className="btn-outline px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 rounded-xl shrink-0"
          >
            <Phone className="w-3.5 h-3.5" /> Call Store
          </a>
        </div>
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

        {/* Cancellation Section with 5-min timer & preparation lockout */}
        {!isCancelled && !isDelivered && (
          canCancelOnline ? (
            <div className="pt-4 border-t border-border-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-red-50/60 border border-red-200/80 p-4 rounded-2xl animate-fade-in">
              <div className="text-xs text-red-950 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-red-900 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-red-700 animate-spin" /> Need to cancel?
                  </span>
                  <span className="font-mono font-black text-xs px-2 py-0.5 rounded-full bg-red-200 text-red-900 border border-red-300">
                    ⏱️ {cancelCountdownStr} left
                  </span>
                </div>
                <p className="text-[11px] text-red-800">
                  Online cancellation is available only within the first 5 minutes of placing your order. Once the kitchen starts cooking, online cancellation is closed.
                </p>
                <button
                  type="button"
                  onClick={() => setShowRefundPolicyModal(true)}
                  className="text-[10px] text-primary hover:underline font-bold inline-block"
                >
                  View Full Refund Policy →
                </button>
              </div>
              <button
                onClick={handleCancelOrder}
                disabled={cancelling}
                className="btn-outline border-error text-error hover:bg-error hover:text-white px-4 py-2 text-xs font-bold shrink-0 transition-colors rounded-xl shadow-xs"
              >
                {cancelling ? 'Processing...' : 'Cancel Order (Instant Refund)'}
              </button>
            </div>
          ) : (
            <div className="pt-4 border-t border-border-subtle p-4 sm:p-5 rounded-2xl bg-amber-50/90 border border-amber-300/80 text-xs space-y-3 animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-200/80 flex items-center justify-center text-amber-900 shrink-0 mt-0.5">
                  <Lock className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <span className="font-bold text-amber-950 block text-sm">
                    {isPreparing ? 'Kitchen Preparation in Progress · Online Cancellation Closed' : '5-Minute Grace Window Closed · Online Cancellation Locked'}
                  </span>
                  <p className="text-[11px] text-amber-900/90 leading-relaxed">
                    {isPreparing
                      ? 'Our chef is actively cooking your fresh items. In accordance with store policy, orders cannot be cancelled online once kitchen preparation starts.'
                      : 'The 5-minute online cancellation window has closed as your order has been queued for kitchen preparation.'}
                  </p>
                  <p className="text-[11px] font-bold text-red-800">
                    If you still wish to cancel, you are required to call us directly. Please note: No refunds will be provided once food preparation has started.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200">
                <a
                  href="tel:+917000748920"
                  className="btn-primary bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 text-xs font-bold flex items-center gap-1.5 rounded-xl shadow-xs"
                >
                  <Phone className="w-3.5 h-3.5" /> Call Store to Request (+91 7000748920)
                </a>
                <button
                  type="button"
                  onClick={() => setShowRefundPolicyModal(true)}
                  className="btn-outline border-amber-400 text-amber-900 hover:bg-amber-100/70 px-3.5 py-2 text-xs font-bold rounded-xl"
                >
                  View Refund Policy
                </button>
              </div>
            </div>
          )
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

      {/* Cancellation & Refund Policy Modal */}
      {showRefundPolicyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="card max-w-lg w-full p-6 bg-white shadow-2xl rounded-3xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="font-heading font-black text-lg text-text-primary">
                  Cancellation & Refund Policy
                </h3>
              </div>
              <button
                onClick={() => setShowRefundPolicyModal(false)}
                className="p-1 text-text-secondary hover:text-text-primary rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-text-secondary leading-relaxed">
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-1">
                <span className="font-bold block text-emerald-900 text-sm">1. 5-Minute Free Cancellation Window</span>
                <p className="text-xs text-emerald-800">
                  Customers can cancel any order directly within the first <strong>5 minutes</strong> of placing it. When cancelled within this grace window, your 20% advance payment is automatically refunded.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 space-y-1">
                <span className="font-bold block text-amber-900 text-sm">2. Kitchen Preparation Lockout</span>
                <p className="text-xs text-amber-800">
                  Because Tea Bhatti prepares each meal fresh to order, online cancellation is locked once the chef begins cooking (status marked as <strong>Preparing</strong>).
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-950 space-y-1">
                <span className="font-bold block text-red-900 text-sm">3. Call Required & No Refunds Once Cooking Begins</span>
                <p className="text-xs text-red-800">
                  If you still wish to request a cancellation after preparation has begun, you must call Tea Bhatti directly at <strong className="text-red-950">+91 7000748920</strong>. In accordance with food hygiene and waste policies, <strong>no refunds will be provided once preparation has started</strong>.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-bg-base border border-border-subtle text-text-primary space-y-1">
                <span className="font-bold block text-sm">4. Refund Reference Tracking</span>
                <p className="text-xs text-text-secondary">
                  Eligible cancelled orders receive an official reference code (<code>REF-TB-XXXXXX</code>) to verify and track your refund status directly with Tea Bhatti management.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowRefundPolicyModal(false)}
                className="btn-primary w-full py-2.5 text-xs font-bold rounded-xl"
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
