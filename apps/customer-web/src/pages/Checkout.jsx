// ── Modern Checkout Page — Tea Bhatti ──
// Pure Store Pickup Hub, Exact Amount UPI "Pay Now" Redirection with Multi-App Intent Detection,
// Persistent State upon Return, UTR / Reference ID Submission & Verification, Zero AI Emojis.

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Store, 
  CreditCard, 
  Smartphone, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  ArrowRight, 
  ShoppingBag,
  Sparkles,
  AlertCircle,
  Copy,
  Receipt,
  QrCode,
  ExternalLink,
  RefreshCw,
  Laptop,
  Download,
  HelpCircle,
  Check,
  X
} from 'lucide-react';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api, { SOCKET_URL } from '../lib/api.js';
import { PaymentDoneModal, firePaymentCelebration } from '../components/CelebrationEffects.jsx';
import PaymentReceiptModal from '../components/PaymentReceiptModal.jsx';
import { io } from 'socket.io-client';

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
  const [upiUtr, setUpiUtr] = useState('');
  const [utrSubmitting, setUtrSubmitting] = useState(false);
  const [utrSuccess, setUtrSuccess] = useState(false);

  // Dynamic UPI payment links & QR
  const [upiData, setUpiData] = useState(null);
  const [copiedUpi, setCopiedUpi] = useState(false);

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

  // Payment Method Selection: 'upi_app' vs 'qr_code'
  const [paymentTab, setPaymentTab] = useState(() => {
    if (typeof window === 'undefined') return 'upi_app';
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    return isMobile ? 'upi_app' : 'qr_code';
  });
  const [appLaunchAttempted, setAppLaunchAttempted] = useState(false);

  // Success modals
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState(null);

  // Check for existing pending order on mount (Ensures NO DATA LOSS when returning from UPI app!)
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
          loadUpiData(parsed.id);
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
      if (data.orderId === pendingOrder.id && (data.paymentStatus === 'verified' || data.paymentStatus === 'advance_paid')) {
        // Payment verified by owner!
        localStorage.removeItem('cafeos_pending_order');
        clearCart();
        setShowPaymentSuccess(true);
      }
    });

    socket.on('order-status-update', (data) => {
      if (data.orderId === pendingOrder.id && data.status === 'accepted') {
        localStorage.removeItem('cafeos_pending_order');
        clearCart();
        setShowPaymentSuccess(true);
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

  // Load dynamic UPI deep links and QR from backend
  async function loadUpiData(orderId) {
    try {
      const qrRes = await api.getOrderQr(orderId);
      setUpiData(qrRes);
    } catch (e) {
      console.warn('Failed to load UPI info:', e);
    }
  }

  // 1. Create order and initiate UPI App Redirection
  async function handlePayNow(preferredApp = 'universal') {
    if (!isAuthenticated) {
      navigate('/login?redirect=/checkout');
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

        // Persist order in localStorage to prevent data loss on return
        localStorage.setItem('cafeos_pending_order', JSON.stringify(currentOrder));
        setPendingOrder(currentOrder);
      }

      // Fetch dynamic UPI URLs for this order
      const upiRes = await api.getOrderQr(currentOrder.id);
      setUpiData(upiRes);

      // Determine deep link target
      let targetUri = upiRes.upiUri;
      if (preferredApp === 'phonepe' && upiRes.phonepeUri) targetUri = upiRes.phonepeUri;
      else if (preferredApp === 'gpay' && upiRes.gpayUri) targetUri = upiRes.gpayUri;
      else if (preferredApp === 'paytm' && upiRes.paytmUri) targetUri = upiRes.paytmUri;
      else if (preferredApp === 'supermoney' && upiRes.supermoneyUri) targetUri = upiRes.supermoneyUri;
      else if (preferredApp === 'cred' && upiRes.credUri) targetUri = upiRes.credUri;
      else if (preferredApp === 'bhim' && upiRes.bhimUri) targetUri = upiRes.bhimUri;

      if (preferredApp === 'qr') {
        setPaymentTab('qr_code');
        return;
      }

      // Detect if user is on a mobile device (phone/tablet) vs laptop/desktop
      const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      if (isMobile) {
        setAppLaunchAttempted(true);
        // On mobile devices, launch the installed UPI app intent
        window.location.href = targetUri;
      } else {
        // On laptop/desktop: NEVER attempt to navigate to upi:// protocol (which crashes on desktop browsers)!
        // Instead, smoothly switch to QR Code tab
        setPaymentTab('qr_code');
        setTimeout(() => {
          const qrBox = document.getElementById('upi-payment-section');
          if (qrBox) qrBox.scrollIntoView({ behavior: 'smooth' });
        }, 120);
      }

    } catch (err) {
      setError(err.message || 'Failed to initialize payment');
    } finally {
      setPlacing(false);
    }
  }

  // 2. Submit 12-digit UTR / Reference ID after paying
  async function handleSubmitUtr(e) {
    e?.preventDefault();
    if (!pendingOrder?.id) {
      setError('Please initiate an order first by clicking Pay Now or generating a QR code.');
      return;
    }

    const cleanUtr = upiUtr.replace(/[^a-zA-Z0-9]/g, '').trim();
    if (!cleanUtr || cleanUtr.length < 6 || cleanUtr.length > 30) {
      setError('Please enter a valid 12-digit UTR or Reference ID from your UPI app receipt');
      return;
    }

    setUtrSubmitting(true);
    setError('');

    try {
      await api.submitUtr(pendingOrder.id, { utr: cleanUtr }, token);
      setUtrSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to submit UTR');
    } finally {
      setUtrSubmitting(false);
    }
  }

  // Download QR code image for same-phone gallery scanning
  function handleDownloadQr() {
    if (!upiData?.qrDataUrl) return;
    const link = document.createElement('a');
    link.href = upiData.qrDataUrl;
    link.download = `TeaBhatti-Payment-QR-${pendingOrder?.pickupCode || 'order'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Copy UPI ID to clipboard
  function handleCopyUpi() {
    const upiId = upiData?.upiId || '9009149694@ybl';
    navigator.clipboard.writeText(upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2500);
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
      setUpiData(null);
      setUtrSuccess(false);
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
                Welcome back! Please complete your UPI payment of <strong className="text-primary font-mono">₹{exactAmountToPay}</strong> and provide the UTR below to confirm.
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

          {/* 2. Exact Amount & UPI "Pay Now" Section */}
          <div id="upi-payment-section" className="card p-6 border-2 border-primary/30 bg-gradient-to-br from-white via-white to-amber-50/20 shadow-md space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-border-subtle">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-primary block">
                  Secure UPI Payment
                </span>
                <h2 className="font-heading font-extrabold text-xl text-text-primary">
                  Choose Payment Method
                </h2>
              </div>
              
              {/* Exact Amount Display */}
              <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 text-right sm:text-right">
                <span className="text-[10px] font-bold text-text-secondary uppercase block">
                  Exact Advance to Pay (20%)
                </span>
                <span className="text-2xl font-mono font-black text-primary">
                  ₹{exactAmountToPay}
                </span>
                <span className="text-[10px] text-text-secondary block font-medium">
                  Remaining ₹{balanceAtCounter} at pickup
                </span>
              </div>
            </div>

            {/* Payment Method Selector Tabs */}
            <div className="flex rounded-2xl bg-bg-base/80 p-1.5 border border-border-subtle gap-1.5">
              <button
                type="button"
                onClick={() => setPaymentTab('upi_app')}
                className={`flex-1 py-3 px-3 rounded-xl font-heading font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                  paymentTab === 'upi_app'
                    ? 'bg-white text-primary shadow-sm border border-border-subtle'
                    : 'text-text-secondary hover:text-text-primary hover:bg-white/50'
                }`}
              >
                <Smartphone className="w-4 h-4 shrink-0" />
                <span>Pay with UPI App</span>
                {isMobileDevice && (
                  <span className="hidden sm:inline-block text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-sans font-bold">
                    Direct
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentTab('qr_code');
                  if (pendingOrder?.id && !upiData?.qrDataUrl) {
                    loadUpiData(pendingOrder.id);
                  }
                }}
                className={`flex-1 py-3 px-3 rounded-xl font-heading font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                  paymentTab === 'qr_code'
                    ? 'bg-white text-primary shadow-sm border border-border-subtle'
                    : 'text-text-secondary hover:text-text-primary hover:bg-white/50'
                }`}
              >
                <QrCode className="w-4 h-4 shrink-0" />
                <span>Pay with QR Code</span>
                {!isMobileDevice && (
                  <span className="hidden sm:inline-block text-[10px] bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-sans font-bold">
                    Desktop
                  </span>
                )}
              </button>
            </div>

            {/* TAB 1: Pay with UPI App */}
            {paymentTab === 'upi_app' && (
              <div className="space-y-4 animate-fade-in">
                {!isMobileDevice ? (
                  /* Laptop / Desktop notification when on UPI App tab */
                  <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200/80 space-y-3 text-amber-900">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                        <Laptop className="w-5 h-5 text-amber-800" />
                      </div>
                      <div className="text-xs">
                        <p className="font-bold">Ordering on a Laptop or Desktop?</p>
                        <p className="text-amber-800/80">
                          Direct UPI app launching is supported on mobile devices. For laptop/desktop, switch to the <strong>Pay with QR Code</strong> tab to scan with your phone.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentTab('qr_code');
                        if (pendingOrder?.id && !upiData?.qrDataUrl) {
                          loadUpiData(pendingOrder.id);
                        }
                      }}
                      className="btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2"
                    >
                      <QrCode className="w-4 h-4" />
                      <span>Switch to Pay with QR Code</span>
                    </button>
                  </div>
                ) : (
                  /* Mobile Phone UPI App Flow */
                  <div className="space-y-4">
                    <p className="text-xs text-text-secondary leading-relaxed">
                      Tap <strong>Pay Now</strong> below to launch your UPI app with the exact advance amount of <strong>₹{exactAmountToPay}</strong> pre-filled!
                    </p>

                    {/* Master "Pay Now" Button (Triggers Mobile OS Intent Chooser) */}
                    <div>
                      <button
                        type="button"
                        onClick={() => handlePayNow('universal')}
                        disabled={placing}
                        className="btn-primary w-full py-4 text-sm font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all"
                      >
                        {placing ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Opening UPI App...</span>
                          </>
                        ) : (
                          <>
                            <Smartphone className="w-4 h-4" />
                            <span>Pay ₹{exactAmountToPay} (Open Any UPI App)</span>
                            <ExternalLink className="w-4 h-4 ml-1" />
                          </>
                        )}
                      </button>
                      <span className="text-[10px] text-text-secondary text-center block mt-1.5 font-medium">
                        Opens PhonePe, Google Pay, Paytm, SuperMoney, BHIM, or Cred installed on your phone
                      </span>
                    </div>

                    {/* Direct App Selection Grid */}
                    <div className="pt-2">
                      <span className="text-xs font-bold text-text-primary block mb-3">
                        Or select your preferred UPI app directly:
                      </span>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                        {/* PhonePe */}
                        <button
                          type="button"
                          onClick={() => handlePayNow('phonepe')}
                          disabled={placing}
                          className="p-3 rounded-2xl border-2 border-border-subtle bg-white hover:border-[#5f259f] hover:bg-[#5f259f]/5 transition-all flex flex-col items-center gap-1.5 text-center shadow-sm"
                        >
                          <div className="w-9 h-9 rounded-xl bg-[#5f259f] text-white flex items-center justify-center font-black text-xs shadow-sm">
                            Pe
                          </div>
                          <span className="text-xs font-bold text-text-primary">PhonePe</span>
                        </button>

                        {/* Google Pay */}
                        <button
                          type="button"
                          onClick={() => handlePayNow('gpay')}
                          disabled={placing}
                          className="p-3 rounded-2xl border-2 border-border-subtle bg-white hover:border-[#1a73e8] hover:bg-[#1a73e8]/5 transition-all flex flex-col items-center gap-1.5 text-center shadow-sm"
                        >
                          <div className="w-9 h-9 rounded-xl bg-[#1a73e8] text-white flex items-center justify-center font-black text-xs shadow-sm">
                            G
                          </div>
                          <span className="text-xs font-bold text-text-primary">Google Pay</span>
                        </button>

                        {/* Paytm */}
                        <button
                          type="button"
                          onClick={() => handlePayNow('paytm')}
                          disabled={placing}
                          className="p-3 rounded-2xl border-2 border-border-subtle bg-white hover:border-[#00b9f5] hover:bg-[#00b9f5]/5 transition-all flex flex-col items-center gap-1.5 text-center shadow-sm"
                        >
                          <div className="w-9 h-9 rounded-xl bg-[#00b9f5] text-white flex items-center justify-center font-black text-xs shadow-sm">
                            Pay
                          </div>
                          <span className="text-xs font-bold text-text-primary">Paytm</span>
                        </button>

                        {/* SuperMoney */}
                        <button
                          type="button"
                          onClick={() => handlePayNow('supermoney')}
                          disabled={placing}
                          className="p-3 rounded-2xl border-2 border-border-subtle bg-white hover:border-[#0f172a] hover:bg-[#0f172a]/5 transition-all flex flex-col items-center gap-1.5 text-center shadow-sm"
                        >
                          <div className="w-9 h-9 rounded-xl bg-[#0f172a] text-white flex items-center justify-center font-black text-xs shadow-sm">
                            S
                          </div>
                          <span className="text-xs font-bold text-text-primary">SuperMoney</span>
                        </button>

                        {/* BHIM / Cred */}
                        <button
                          type="button"
                          onClick={() => handlePayNow('bhim')}
                          disabled={placing}
                          className="p-3 rounded-2xl border-2 border-border-subtle bg-white hover:border-primary hover:bg-primary/5 transition-all flex flex-col items-center gap-1.5 text-center shadow-sm col-span-2 sm:col-span-1"
                        >
                          <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center font-black text-xs shadow-sm">
                            UPI
                          </div>
                          <span className="text-xs font-bold text-text-primary">BHIM / Cred</span>
                        </button>
                      </div>
                    </div>

                    {/* Feedback & Fallback prompt if app launch attempted */}
                    {appLaunchAttempted && (
                      <div className="p-3.5 rounded-2xl bg-blue-50/90 border border-blue-200/80 space-y-1.5 text-blue-900 text-xs animate-fade-in">
                        <div className="flex items-center gap-2 font-bold">
                          <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
                          <span>App opened? Complete payment and submit UTR below.</span>
                        </div>
                        <p className="text-blue-800/80 text-[11px] leading-relaxed">
                          Web browsers cannot detect installed apps directly due to operating system sandboxing. If your app did not open automatically, try tapping another app button above, or switch to the <strong>Pay with QR Code</strong> tab.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Pay with QR Code */}
            {paymentTab === 'qr_code' && (
              <div className="space-y-4 animate-fade-in">
                {upiData?.qrDataUrl ? (
                  <div className="p-6 rounded-2xl bg-white border-2 border-primary/20 shadow-sm flex flex-col items-center text-center space-y-4">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Dynamic Payment QR Ready
                    </div>

                    {/* QR Code Graphic */}
                    <div className="p-3 bg-white rounded-2xl border-2 border-border-subtle shadow-md inline-block">
                      <img
                        src={upiData.qrDataUrl}
                        alt="Scan UPI QR Code to Pay"
                        className="w-56 h-56 object-contain rounded-xl"
                      />
                    </div>

                    <div className="space-y-1 max-w-sm">
                      <p className="text-xs font-bold text-text-primary">
                        Scan with PhonePe, Google Pay, Paytm, SuperMoney, BHIM
                      </p>
                      <p className="text-[11px] text-text-secondary">
                        The exact advance amount of <strong className="text-primary font-mono font-bold">₹{exactAmountToPay}</strong> is encoded automatically.
                      </p>
                    </div>

                    {/* Action Buttons: Download QR & Refresh */}
                    <div className="flex flex-wrap items-center justify-center gap-2 w-full max-w-xs">
                      <button
                        type="button"
                        onClick={handleDownloadQr}
                        className="btn-secondary flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
                        title="Download QR code image to your phone gallery"
                      >
                        <Download className="w-4 h-4 text-primary" />
                        <span>Download QR</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePayNow('qr')}
                        disabled={placing}
                        className="btn-ghost py-2.5 px-3 text-xs font-bold flex items-center justify-center gap-1 hover:bg-primary/5 transition-all text-text-secondary"
                        title="Refresh QR Code"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${placing ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                      </button>
                    </div>

                    {/* Mobile Phone Same-Screen Scan Instructions */}
                    {isMobileDevice && (
                      <div className="w-full text-left p-3.5 rounded-xl bg-amber-50/90 border border-amber-200/80 text-amber-900 text-xs space-y-1.5">
                        <p className="font-bold flex items-center gap-1.5">
                          <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
                          Paying on this phone?
                        </p>
                        <ol className="list-decimal list-inside text-[11px] space-y-0.5 text-amber-800/90">
                          <li>Tap <strong>Download QR</strong> above to save to your photo gallery.</li>
                          <li>Open your UPI app (PhonePe, GPay, Paytm).</li>
                          <li>Tap <strong>Scan QR</strong>, then tap the <strong>Gallery/Photo icon</strong> to choose the saved QR image!</li>
                        </ol>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <button
                      type="button"
                      onClick={() => handlePayNow('qr')}
                      disabled={placing}
                      className="btn-primary w-full py-4 text-sm font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all"
                    >
                      {placing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Generating Payment QR Code...</span>
                        </>
                      ) : (
                        <>
                          <QrCode className="w-4 h-4" />
                          <span>Show QR Code to Pay ₹{exactAmountToPay}</span>
                        </>
                      )}
                    </button>
                    <span className="text-[10px] text-text-secondary text-center block mt-1.5 font-medium">
                      Generates a secure dynamic QR code for ₹{exactAmountToPay} payable with any UPI app
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Official UPI ID & One-click Copy */}
            <div className="p-3.5 rounded-2xl bg-bg-base/70 border border-border-subtle flex items-center justify-between text-xs">
              <span className="font-semibold text-text-secondary">Official Tea Bhatti Cafe UPI ID:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-text-primary">
                  {upiData?.upiId || '9009149694@ybl'}
                </span>
                <button
                  type="button"
                  onClick={handleCopyUpi}
                  className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1 text-[11px] font-bold transition-all"
                  title="Copy UPI ID"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedUpi ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* 3. UTR / UPI Reference ID Verification Card */}
            <div className="pt-4 border-t-2 border-border-subtle space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-bold text-sm text-text-primary flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Step 2: Enter UTR / UPI Reference ID to Verify
                </h3>
              </div>

              <p className="text-xs text-text-secondary">
                After paying in PhonePe, GPay, or Paytm, copy the <strong>12-digit UTR / UPI Transaction ID</strong> from your payment receipt and submit below:
              </p>

              <form onSubmit={handleSubmitUtr} className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={upiUtr}
                    onChange={(e) => {
                      setUpiUtr(e.target.value.replace(/\s+/g, ''));
                      setError('');
                    }}
                    placeholder="E.g. 429182749102"
                    className="input-field flex-1 font-mono font-bold text-sm"
                  />
                  <button
                    type="submit"
                    disabled={utrSubmitting || !upiUtr.trim()}
                    className="btn-primary px-5 text-xs font-bold uppercase tracking-wider shrink-0"
                  >
                    {utrSubmitting ? 'Submitting...' : 'Verify Payment'}
                  </button>
                </div>

                {utrSuccess && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center gap-2 animate-fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      UTR Reference submitted! Waiting for Tea Bhatti Cafe staff confirmation. Your screen will update automatically.
                    </span>
                  </div>
                )}
              </form>
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
          utr={upiUtr}
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
