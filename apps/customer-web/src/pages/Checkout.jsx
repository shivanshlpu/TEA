// ── Modern Checkout Page — Tea Bhatti ──
// Pure Store Pickup Hub, Exact Amount UPI "Pay Now" Redirection with Multi-App Intent Detection,
// Persistent State upon Return, UTR / Reference ID Submission & Verification, Zero AI Emojis.

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Store, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  ArrowRight, 
  ShoppingBag,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Zap
} from 'lucide-react';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api, { SOCKET_URL } from '../lib/api.js';
import { PaymentDoneModal, firePaymentCelebration } from '../components/CelebrationEffects.jsx';
import PaymentReceiptModal from '../components/PaymentReceiptModal.jsx';
import { io } from 'socket.io-client';

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function parseItemAddOns(addOns) {
  if (Array.isArray(addOns)) return addOns;
  if (typeof addOns === 'string') {
    try { return JSON.parse(addOns); } catch { return []; }
  }
  return [];
}

export default function Checkout() {
  const { items, businessId, businessConfig, clearCart } = useCart();
  const { token, user, isAuthenticated } = useAuth();
  const { toast, confirm } = useToast();
  const navigate = useNavigate();

  const [couponCode, setCouponCode] = useState('');
  const [computed, setComputed] = useState(null);
  const [loading, setLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');

  // Active Pending Order State (Persisted in localStorage)
  const [pendingOrder, setPendingOrder] = useState(null);

  // Detect mobile vs laptop/desktop
  const [isMobileDevice, setIsMobileDevice] = useState(() => {
    if (typeof window === 'undefined') return false;
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobileDevice(/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Razorpay Gateway configuration
  const [razorpayConfig, setRazorpayConfig] = useState(null);

  // Check Razorpay Gateway configuration on mount
  useEffect(() => {
    const envKey = import.meta.env.VITE_RAZORPAY_KEY_ID;
    if (envKey) {
      setRazorpayConfig({ key_id: envKey, isAvailable: true });
    }
    api.getRazorpayConfig()
      .then(cfg => {
        if (cfg?.key_id) {
          setRazorpayConfig(cfg);
        }
      })
      .catch(e => console.warn('Razorpay config check:', e));
  }, []);

  // Success modals
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState(null);

  // Check for existing pending order on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cafeos_pending_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Only restore if within the last 2 hours
        if (parsed && (Date.now() - (parsed.timestamp || 0)) < 2 * 60 * 60 * 1000) {
          if (Array.isArray(parsed.items)) {
            parsed.items = parsed.items.map(it => ({
              ...it,
              name: it.name || it.menuItem?.name || 'Item',
              price: Number(it.price ?? it.priceEach) || 0,
              priceEach: Number(it.priceEach ?? it.price) || 0,
              quantity: Number(it.quantity) || 1,
              addOns: parseItemAddOns(it.addOns),
            }));
          }
          setPendingOrder(parsed);
        } else {
          localStorage.removeItem('cafeos_pending_order');
        }
      }
    } catch (e) {
      console.warn('Error reading pending order from storage:', e);
      localStorage.removeItem('cafeos_pending_order');
    }
  }, []);

  // Socket.io real-time listener for owner verification
  useEffect(() => {
    if (!pendingOrder?.id) return;

    const socket = io(SOCKET_URL);
    socket.emit('join-order', pendingOrder.id);

    socket.on('payment-update', (data) => {
      if (data.orderId === pendingOrder.id) {
        if (data.paymentStatus === 'verified' || data.paymentStatus === 'advance_paid') {
          // Payment verified by system!
          localStorage.removeItem('cafeos_pending_order');
          clearCart();
          setShowPaymentSuccess(true);
        } else if (data.paymentStatus === 'rejected' || data.paymentStatus === 'failed') {
          const msg = data.paymentRejectReason || 'Payment could not be completed. Please try again.';
          setError(msg);
          toast.error(msg);
        }
      }
    });

    socket.on('order-status-update', (data) => {
      if (data.orderId === pendingOrder.id) {
        if (data.status === 'accepted') {
          localStorage.removeItem('cafeos_pending_order');
          clearCart();
          setShowPaymentSuccess(true);
        } else if (data.status === 'cancelled') {
          localStorage.removeItem('cafeos_pending_order');
          clearCart();
          navigate(`/order/${pendingOrder.id}`);
        } else if (data.paymentStatus === 'rejected') {
          const msg = data.paymentRejectReason || 'Payment could not be completed. Please try again.';
          setError(msg);
        }
      }
    });

    return () => socket.disconnect();
  }, [pendingOrder?.id]);

  // Compute cart on mount and coupon change
  useEffect(() => {
    if (items.length === 0 && !pendingOrder) return;
    computeCart();
  }, [couponCode, businessId, businessConfig]);

  const ID_MAP = {
    'bs-1': '6acd71bc90fc89567f0d0007',
    'bs-2': '6acd71bc90fc89567f0cfffe',
    'bs-3': '6acd71bc90fc89567f0d0000',
    'bs-4': '6acd71bc90fc89567f0d0001',
    'bs-5': '6acd71bc90fc89567f0d0004',
    'bs-6': '6acd71bc90fc89567f0d0002',
  };

  async function computeCart() {
    const bId = businessId || businessConfig?.id;
    if (!bId) return;
    setLoading(true);
    setError('');
    setCouponError('');
    try {
      const data = await api.computeCart({
        businessId: bId,
        items: items.map(i => ({
          menuItemId: ID_MAP[i.menuItemId] || i.menuItemId,
          name: i.name,
          quantity: i.quantity,
          addOns: i.addOns || [],
        })),
        orderType: 'pickup',
        couponCode: couponCode || undefined,
      });
      setComputed(data);
      if (data.appliedCoupon) {
        setCouponSuccess(`Coupon "${data.appliedCoupon.code}" applied successfully!`);
      }
    } catch (err) {
      if (couponCode) {
        setCouponError(err.message || 'Invalid coupon code or already used');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  // Store Availability Check (Emergency Pause, Closed Days, Operating Hours)
  const storeStatus = React.useMemo(() => {
    if (!businessConfig) return { isOpen: true };

    if (businessConfig.isAcceptingOrders === false) {
      return {
        isOpen: false,
        reason: businessConfig.closureReason || 'Unable to accept orders right now due to a temporary outage. Please check back later.',
        type: 'emergency',
      };
    }

    const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = days[nowIST.getDay()];
    if (Array.isArray(businessConfig.closedDays) && businessConfig.closedDays.includes(currentDay)) {
      return {
        isOpen: false,
        reason: `Tea Bhatti is closed today (${currentDay}). We look forward to serving you on our next working day!`,
        type: 'closed_day',
      };
    }

    if (businessConfig.openingTime && businessConfig.closingTime) {
      const [openH, openM] = businessConfig.openingTime.split(':').map(Number);
      const [closeH, closeM] = businessConfig.closingTime.split(':').map(Number);
      const currentMinutes = nowIST.getHours() * 60 + nowIST.getMinutes();
      const openMinutes = openH * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;

      let inHours = false;
      if (openMinutes <= closeMinutes) {
        inHours = currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
      } else {
        inHours = currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
      }

      if (!inHours) {
        return {
          isOpen: false,
          reason: `Tea Bhatti is currently closed. Today's operating hours are ${businessConfig.openingTime} to ${businessConfig.closingTime}.`,
          type: 'hours',
        };
      }
    }

    return { isOpen: true };
  }, [businessConfig]);


  // ── Razorpay Standard Web Checkout Integration ──
  async function handlePayRazorpay() {
    if (!isAuthenticated) {
      navigate('/login?redirect=/checkout');
      return;
    }

    if (!storeStatus.isOpen) {
      setError(storeStatus.reason);
      toast.error(storeStatus.reason);
      return;
    }

    const bId = businessId || businessConfig?.id;
    if (!bId) {
      setError('Store configuration not ready');
      return;
    }

    setPlacing(true);
    setError('');

    try {
      let currentOrder = pendingOrder;

      // Create new order if not already created
      if (!currentOrder) {
        const created = await api.createOrder({
          businessId: bId,
          items: items.map(i => ({
            menuItemId: ID_MAP[i.menuItemId] || i.menuItemId,
            name: i.name,
            quantity: i.quantity,
            addOns: i.addOns || [],
          })),
          orderType: 'pickup',
          couponCode: computed?.appliedCoupon?.code || undefined,
        }, token);

        currentOrder = {
          id: created.id,
          pickupCode: created.pickupCode,
          total: created.total,
          advanceAmount: created.advanceAmount || Math.round(created.total * 0.20),
          items: (created.items || items).map(it => ({
            id: it.id,
            menuItemId: it.menuItemId,
            name: it.name || it.menuItem?.name || 'Item',
            price: Number(it.price ?? it.priceEach) || 0,
            priceEach: Number(it.priceEach ?? it.price) || 0,
            quantity: Number(it.quantity) || 1,
            addOns: parseItemAddOns(it.addOns),
          })),
          timestamp: Date.now(),
        };

        localStorage.setItem('cafeos_pending_order', JSON.stringify(currentOrder));
        setPendingOrder(currentOrder);
      }

      // Step 2: Ensure Razorpay SDK is loaded
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded || typeof window.Razorpay === 'undefined') {
        throw new Error('Razorpay SDK failed to load. Please check your internet connection.');
      }

      // Step 1: Call backend create-order endpoint (orders/:id/razorpay-order)
      const rzpData = await api.createRazorpayOrder(currentOrder.id, token);
      const rzpOrderId = rzpData?.order_id || rzpData?.razorpayOrderId;
      const rzpKeyId = rzpData?.key_id || rzpData?.keyId || razorpayConfig?.key_id || import.meta.env.VITE_RAZORPAY_KEY_ID;

      if (!rzpOrderId) {
        throw new Error(rzpData?.error || 'Failed to initialize Razorpay payment');
      }

      // Step 2: Open Razorpay modal with order_id
      const options = {
        key: rzpKeyId,
        amount: rzpData.amount, // in paise
        currency: rzpData.currency || 'INR',
        name: businessConfig?.name || 'Tea Bhatti Cafe',
        description: `Order #${currentOrder.pickupCode || 'TB'} Advance Booking`,
        image: '/teabhatti-logo.png',
        order_id: rzpOrderId,
        handler: async function (response) {
          // On success: receive razorpay_payment_id, razorpay_order_id, razorpay_signature
          // Step 3: Send all three to verify endpoint
          setPlacing(true);
          try {
            const verifyRes = await api.verifyRazorpayPayment(currentOrder.id, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              order_id: response.razorpay_order_id,
              payment_id: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            }, token);

            if (verifyRes.success) {
              localStorage.removeItem('cafeos_pending_order');
              clearCart();
              firePaymentCelebration();
              setShowPaymentSuccess(true);
              toast.success('Payment verified successfully!');
            } else {
              throw new Error(verifyRes.error || 'Payment signature verification failed');
            }
          } catch (vErr) {
            console.error('Razorpay verification error:', vErr);
            setError(vErr.message || 'Payment verification failed');
            toast.error(vErr.message || 'Payment verification failed');
          } finally {
            setPlacing(false);
          }
        },
        prefill: {
          name: user?.name || '',
          contact: user?.phone || '',
          email: user?.email || '',
        },
        notes: {
          orderId: currentOrder.id,
          pickupCode: currentOrder.pickupCode,
        },
        theme: {
          color: '#0d9488',
        },
        modal: {
          ondismiss: function () {
            setPlacing(false);
          },
        },
      };

      const rzpInstance = new window.Razorpay(options);
      rzpInstance.on('payment.failed', function (resp) {
        console.error('Razorpay payment failed:', resp.error);
        const errMsg = resp.error?.description || 'Payment was unsuccessful or cancelled.';
        setError(errMsg);
        toast.error(errMsg);
      });
      rzpInstance.open();

    } catch (err) {
      console.error('Razorpay error:', err);
      setError(err.message || 'Failed to start Razorpay payment');
      toast.error(err.message || 'Failed to start Razorpay payment');
    } finally {
      setPlacing(false);
    }
  }

  // Discard pending order & restart
  async function handleResetOrder() {
    const ok = await confirm({
      title: 'Discard Order & Return to Cart?',
      message: 'Do you want to discard this pending payment and return to cart?',
      confirmText: 'Discard Order',
      cancelText: 'Stay on Payment',
      isDestructive: true,
    });
    if (ok) {
      localStorage.removeItem('cafeos_pending_order');
      setPendingOrder(null);
      toast.info('Pending payment discarded');
    }
  }

  if (items.length === 0 && !pendingOrder && !showPaymentSuccess) {
    navigate('/cart');
    return null;
  }

  // Client-side fallback calculation from cart items if server compute is pending or loading
  const clientSubtotal = items.reduce((sum, item) => {
    const discounted = item.price * (1 - (item.discountPct || 0) / 100);
    const addOnsTotal = item.addOns?.reduce((s, a) => s + a.price, 0) || 0;
    return sum + (discounted + addOnsTotal) * item.quantity;
  }, 0);
  const clientGst = 0; // No GST
  const clientTotal = Math.round(clientSubtotal);

  // Exact Payment Amount calculation (strictly integers: advance + balance === total)
  const totalAmount = Math.round(pendingOrder?.total || computed?.total || clientTotal);
  const exactAmountToPay = Math.round(pendingOrder?.advanceAmount || computed?.advanceAmount || Math.round(totalAmount * 0.20));
  const balanceAtCounter = totalAmount - exactAmountToPay;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-fade-in pb-28 md:pb-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary mb-2">
            <Store className="w-3.5 h-3.5" />
            Tea Bhatti Cafe • Direct Store Pickup
          </span>
          <h1 className="text-2xl sm:text-3xl font-heading font-black text-text-primary tracking-tight">
            {pendingOrder ? 'Complete UPI Payment' : 'Checkout & Pickup Order'}
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Pick up fresh & hot food at Tea Bhatti Cafe counter (Near Medical College, Shahdol). Zero waiting!
          </p>
        </div>

        <div className="flex items-center gap-2.5 p-3.5 bg-white rounded-2xl shadow-sm border border-border-subtle self-start sm:self-auto">
          <Clock className="w-5 h-5 text-primary" />
          <div className="text-xs">
            <span className="text-text-secondary block font-medium">Estimated Pickup</span>
            <span className="font-bold text-text-primary">In ~15 Minutes</span>
          </div>
        </div>
      </div>

      {/* Store Closed / Offline Emergency Notice Banner */}
      {!storeStatus.isOpen && (
        <div className="mb-6 p-5 rounded-2xl bg-red-50 border-2 border-red-300 text-red-950 space-y-3 shadow-md animate-fade-in">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-red-200/80 flex items-center justify-center text-red-800 shrink-0 mt-0.5">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h2 className="font-heading font-black text-sm text-red-900">
                Notice: Store is Currently Unavailable
              </h2>
              <p className="text-xs text-red-800 font-medium leading-relaxed">
                {storeStatus.reason}
              </p>
              <p className="text-[11px] text-red-700">
                New orders are temporarily paused. If you have questions or an ongoing pickup, please contact us directly.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-red-200">
            <a
              href="tel:+917000748920"
              className="btn-primary bg-red-600 hover:bg-red-700 text-white px-3.5 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs"
            >
              Call Store (+91 7000748920)
            </a>
            <a
              href="https://wa.me/917000748920?text=Hi%20Tea%20Bhatti%2C%20I%20have%20an%20inquiry%20regarding%20store%20hours"
              target="_blank"
              rel="noreferrer"
              className="btn-outline border-red-300 text-red-900 hover:bg-red-100/60 px-3.5 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5"
            >
              WhatsApp Us
            </a>
          </div>
        </div>
      )}

      {/* Notice if returning with a saved pending order */}
      {pendingOrder && (
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 flex items-center justify-between gap-4 animate-fade-in shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-black text-sm shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="font-heading font-bold text-sm text-text-primary">
                Order Data Preserved — Token #{pendingOrder.pickupCode || pendingOrder.id.slice(-6).toUpperCase()}
              </p>
              <p className="text-xs text-text-secondary">
                Welcome back! Please complete your payment of <strong className="text-primary font-mono">₹{exactAmountToPay}</strong> via Razorpay to confirm your order.
              </p>
            </div>
          </div>
          <button
            onClick={handleResetOrder}
            className="text-xs text-text-secondary hover:text-error underline shrink-0 font-medium"
          >
            Cancel & Reset
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-8">
        
        {/* Left Column: Payment & Order Options */}
        <div className="lg:col-span-7 space-y-6">

          {/* 1. Store Pickup Confirmation Card */}
          <div className="card p-6 border-2 border-primary/20 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-bold text-base text-text-primary flex items-center gap-2">
                <Store className="w-4 h-4 text-primary" />
                Store Pickup Service
              </h2>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Active & Ready
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-bg-base/70 border border-border-subtle space-y-2 text-xs">
              <div className="flex items-center gap-2 text-text-primary font-bold">
                <MapPin className="w-4 h-4 text-primary shrink-0" />
                <span>Tea Bhatti Cafe Counter</span>
              </div>
              <p className="text-text-secondary pl-6">
                Near Medical College, Shahdol, Madhya Pradesh • Phone: +91 7000748920
              </p>
              <div className="pl-6 pt-1 text-[11px] text-text-secondary font-medium">
                Show your pickup token at the counter when you arrive.
              </div>
            </div>
          </div>

          {/* 2. Razorpay Live Automated Online Payment */}
          <div id="payment-section" className="card p-6 border-2 border-emerald-500/30 bg-gradient-to-br from-white via-white to-emerald-50/20 shadow-md space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border-subtle">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Instant Automated Payment
                </span>
                <h2 className="font-heading font-extrabold text-xl text-text-primary">
                  Online Payment & Advance
                </h2>
              </div>
              
              {/* Exact Amount Display */}
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-right sm:text-right">
                <span className="text-[10px] font-bold text-text-secondary uppercase block">
                  Advance to Pay Now (20%)
                </span>
                <span className="text-2xl font-mono font-black text-emerald-700">
                  ₹{exactAmountToPay}
                </span>
                <span className="text-[10px] text-text-secondary block font-medium">
                  Remaining ₹{balanceAtCounter} due at counter pickup
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-xs text-emerald-950 space-y-2.5 font-medium">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><strong>All UPI Apps</strong> — Google Pay, PhonePe, Paytm, BHIM, Cred & Instant QR</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><strong>Debit & Credit Cards</strong> (Visa, Mastercard, RuPay) & NetBanking</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><strong>Instant Order Confirmation</strong> — Automatically sent to kitchen upon payment</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-800 text-[11px] pt-1 border-t border-emerald-200/60">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>100% Refund Guarantee — Automatically refunded to your original source account (credited in 5–7 working days) if cancelled before preparation</span>
                </div>
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-950 text-xs font-semibold flex items-start gap-2.5 animate-fade-in shadow-xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold text-rose-900">Payment Notice</p>
                    <p className="text-rose-800 text-[11px] leading-relaxed">{error}</p>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handlePayRazorpay}
                disabled={placing || !storeStatus.isOpen}
                className={`btn-primary w-full py-4 text-base font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2.5 rounded-2xl relative overflow-hidden transition-all ${
                  !storeStatus.isOpen
                    ? 'opacity-60 cursor-not-allowed bg-gray-600 hover:bg-gray-600'
                    : 'hover:scale-[1.01]'
                }`}
              >
                {!storeStatus.isOpen ? (
                  <>
                    <AlertCircle className="w-5 h-5 text-amber-200" />
                    <span>Store Offline — Orders Paused</span>
                  </>
                ) : placing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Opening Secure Payment Gateway...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 fill-current" />
                    <span>Pay ₹{exactAmountToPay} Online via Razorpay</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-text-secondary pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Secured by Razorpay • 256-bit Bank Grade Encryption • Zero Manual UTR Required</span>
              </div>
            </div>
          </div>

          {/* Coupon Code Section */}
          <div className="card p-6 border-2 border-border-subtle space-y-3">
            <h3 className="font-heading font-bold text-base text-text-primary flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-secondary" />
              Apply Coupon Code
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value.toUpperCase());
                  setCouponError('');
                  setCouponSuccess('');
                }}
                placeholder="E.g. WELCOME20"
                className="input-field flex-1 uppercase font-mono font-bold text-xs"
              />
              <button
                onClick={computeCart}
                disabled={loading || !couponCode.trim()}
                className="btn-outline px-5 text-xs font-bold uppercase"
              >
                Apply
              </button>
            </div>
            {couponSuccess && (
              <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> {couponSuccess}
              </p>
            )}
            {couponError && (
              <p className="text-xs text-error font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {couponError}
              </p>
            )}
          </div>

        </div>

        {/* Right Column: Order Summary & Settlement Breakdown */}
        <div className="lg:col-span-5">
          <div className="card p-6 sticky top-20 border-2 border-border-subtle shadow-lg space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <h2 className="font-heading font-extrabold text-lg text-text-primary">
                Order Summary
              </h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {items.length} items
              </span>
            </div>

            {/* Line Items List */}
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {(pendingOrder?.items || items).map((item, idx) => {
                const price = Number(item.price ?? item.priceEach) || 0;
                const itemAddOns = parseItemAddOns(item.addOns);
                const addOnsTotal = itemAddOns.reduce((s, a) => s + (Number(a.price) || 0), 0);
                const discounted = price * (1 - (Number(item.discountPct) || 0) / 100);
                const lineTotal = (discounted + addOnsTotal) * (Number(item.quantity) || 1);
                return (
                  <div key={idx} className="flex justify-between items-start text-xs">
                    <div className="pr-2">
                      <span className="font-bold text-primary mr-1">{item.quantity || 1}x</span>
                      <span className="font-semibold text-text-primary">{item.name || item.menuItem?.name || 'Item'}</span>
                      {itemAddOns.length > 0 && (
                        <p className="text-[10px] text-text-secondary ml-4">
                          + {itemAddOns.map(a => a.name).join(', ')}
                        </p>
                      )}
                    </div>
                    <span className="font-bold text-text-primary font-mono shrink-0">
                      ₹{lineTotal.toFixed(0)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Price Breakdown */}
            <div className="border-t border-border-subtle pt-3 space-y-2 text-xs">
              <div className="flex justify-between text-text-secondary">
                <span>Subtotal</span>
                <span className="font-mono">₹{computed?.subtotal?.toFixed(0) || clientSubtotal.toFixed(0)}</span>
              </div>
              {computed?.discount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Discount</span>
                  <span className="font-mono">-₹{computed.discount.toFixed(0)}</span>
                </div>
              )}
              <div className="flex justify-between text-text-secondary">
                <span>Packing Charge</span>
                <span className="text-emerald-600 font-medium">Free</span>
              </div>

              {/* Total Order Value */}
              <div className="pt-2 border-t border-border-subtle flex justify-between items-center font-bold text-sm text-text-primary">
                <span className="font-heading">Total Value</span>
                <span className="text-xl font-mono font-black text-text-primary">
                  ₹{totalAmount}
                </span>
              </div>

              {/* Exact Payment Split Box */}
              <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Exact Amount to Pay via UPI Now (20% Advance):
                  </span>
                  <span className="text-base font-mono font-black text-emerald-800">
                    ₹{exactAmountToPay}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs pt-2 border-t border-amber-200/60">
                  <span className="font-bold text-amber-900 flex items-center gap-1.5">
                    <Store className="w-4 h-4 text-amber-600" />
                    Remaining Balance at Counter:
                  </span>
                  <span className="text-sm font-mono font-bold text-amber-900">
                    ₹{balanceAtCounter}
                  </span>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Cancellation Guarantee */}
            <div className="pt-2 text-[11px] text-text-secondary text-center space-y-1">
              <p className="flex items-center justify-center gap-1 font-semibold text-emerald-900">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Easy Cancellation & Immediate Refund
              </p>
              <p className="text-[10px] text-text-secondary">
                Orders can be cancelled before kitchen preparation starts. Once preparing begins, cancellation is locked.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* High-Quality "Payment Done" Modal */}
      {showPaymentSuccess && (
        <PaymentDoneModal
          order={pendingOrder}
          amount={exactAmountToPay}
          utr={pendingOrder?.razorpayPaymentId || pendingOrder?.paymentUtr || 'ONLINE_VERIFIED'}
          onClose={() => {
            setShowPaymentSuccess(false);
            if (pendingOrder?.id) navigate(`/order/${pendingOrder.id}`);
          }}
          onViewOrder={() => {
            setShowPaymentSuccess(false);
            if (pendingOrder?.id) navigate(`/order/${pendingOrder.id}`);
          }}
        />
      )}

      {/* Digital Receipt Modal */}
      {activeReceipt && (
        <PaymentReceiptModal
          receipt={activeReceipt}
          onClose={() => {
            setActiveReceipt(null);
            if (pendingOrder?.id) navigate(`/order/${pendingOrder.id}`);
          }}
          onTrackOrder={(orderId) => {
            setActiveReceipt(null);
            navigate(`/order/${orderId}`);
          }}
        />
      )}

    </div>
  );
}
