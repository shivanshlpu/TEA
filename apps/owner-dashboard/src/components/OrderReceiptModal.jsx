// ── Owner Dashboard Order Receipt / POS Bill Modal ──
// Professional Cafe Bill & Kitchen Pickup Token for store printing.
// Single-page print isolation, 0% page bleed, POS 80mm & Standard A4 switcher.

import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  X, 
  Store, 
  CheckCircle2, 
  FileText
} from 'lucide-react';
import QRCode from 'qrcode';
import { printReceipt } from '../lib/printReceipt.js';

export default function OrderReceiptModal({ order, onClose }) {
  if (!order) return null;

  const [qrDataUrl, setQrDataUrl] = useState('');
  const [printMode, setPrintMode] = useState('standard'); // 'standard' | 'pos'

  const pickupToken = order.pickupCode || order.id?.slice(-6)?.toUpperCase() || 'TB-READY';
  const receiptNumber = `REC-TB-${order.id?.slice(-6)?.toUpperCase()}`;
  const advanceAmount = Math.round(order.advanceAmount || (order.total * 0.20));
  const balanceAmount = Math.round(order.balanceAmount || (order.total - advanceAmount));
  const customerName = order.customer?.user?.name || order.customer?.name || 'Valued Customer';
  const customerPhone = order.customer?.user?.phone || order.customer?.phone || '';

  const cleanPaymentMethod = () => {
    if (order.paymentStatus === 'fully_paid') return 'Fully Paid (Online / Cash)';
    if (['advance_paid', 'verified'].includes(order.paymentStatus)) {
      return '20% Advance Confirmed (Balance Due at Counter)';
    }
    if (order.paymentStatus === 'utr_submitted') return 'UTR Submitted (Pending Verification)';
    return 'Pending Payment';
  };

  useEffect(() => {
    const upiId = 'teabhatti@upi';
    const qrPayload = balanceAmount > 0
      ? `upi://pay?pa=${upiId}&pn=Tea%20Bhatti%20Cafe&am=${balanceAmount}&tn=Token%20${pickupToken}&cu=INR`
      : `https://teabhatticafe.com/order/${order.id}`;

    QRCode.toDataURL(qrPayload, {
      width: 180,
      margin: 1,
      color: { dark: '#1A0E05', light: '#FFFFFF' }
    })
      .then(url => setQrDataUrl(url))
      .catch(err => console.warn('QR code generation warning:', err));
  }, [order, balanceAmount, pickupToken]);

  const handlePrint = () => {
    printReceipt('tea-bhatti-printable-bill', {
      printMode,
      title: `Bill_Token_${pickupToken}_Tea_Bhatti`,
    });
  };

  const formattedDate = new Date(order.paidAt || order.createdAt || Date.now()).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-border-subtle my-auto overflow-hidden max-h-[90vh] flex flex-col">
        
        {/* On-Screen Modal Top Bar (Hidden on print) */}
        <div className="bg-gradient-to-r from-amber-600 via-primary to-orange-600 text-white p-4 sm:p-5 relative print:hidden shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="/teabhatti-logo.png" 
                alt="Tea Bhatti" 
                className="w-10 h-10 rounded-2xl bg-white p-1 shadow-md object-contain"
              />
              <div>
                <h2 className="text-lg font-heading font-black tracking-tight text-white leading-tight">
                  Customer Bill & Kitchen Token
                </h2>
                <p className="text-xs text-white/90 font-medium">
                  Tea Bhatti Cafe • Official Commercial Invoice
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Print Style Switcher */}
          <div className="mt-3.5 pt-3 border-t border-white/20 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-white/90 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Print Format:
            </span>
            <div className="flex items-center bg-black/25 rounded-xl p-0.5 border border-white/20">
              <button
                onClick={() => setPrintMode('standard')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  printMode === 'standard' ? 'bg-white text-primary shadow-sm' : 'text-white/80 hover:text-white'
                }`}
              >
                Standard Bill (Half A4)
              </button>
              <button
                onClick={() => setPrintMode('pos')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  printMode === 'pos' ? 'bg-white text-primary shadow-sm' : 'text-white/80 hover:text-white'
                }`}
              >
                POS Slip (80mm)
              </button>
            </div>
          </div>
        </div>

        {/* ── Bill Body (Active on Screen AND Targeted in Print) ── */}
        <div className="overflow-y-auto flex-1">
          <div 
            id="tea-bhatti-printable-bill"
            className={`bg-white text-neutral-900 mx-auto transition-all ${
              printMode === 'pos' ? 'max-w-[420px] p-4 text-xs font-mono' : 'p-5 sm:p-6 text-xs font-sans max-w-xl'
            }`}
          >
          {/* Header */}
          <div className="bill-header text-center pb-2 border-b-2 border-neutral-900">
            <div className="flex items-center justify-center gap-2 mb-0.5">
              <img 
                src="/teabhatti-logo.png" 
                alt="Logo" 
                className="w-7 h-7 sm:w-8 sm:h-8 object-contain rounded-lg"
              />
              <h1 className="text-lg sm:text-xl font-black uppercase tracking-wider text-neutral-900 font-serif">
                Tea Bhatti Cafe
              </h1>
            </div>
            <p className="text-[10px] font-semibold text-neutral-600 italic tracking-wide">
              "Chai se zyada, Ek Habit hai."
            </p>
            <p className="text-[9.5px] sm:text-[10px] text-neutral-700 font-medium leading-snug">
              Near Medical College, Shahdol, Madhya Pradesh • 484001
            </p>
            <p className="text-[9px] text-neutral-600">
              Helpline: +91 90091 49694 • UPI ID: teabhatti@upi
            </p>
            <div className="bill-tag mt-1 inline-block px-2.5 py-0.5 text-[8.5px] font-black uppercase tracking-widest bg-neutral-900 text-white rounded">
              Commercial Bill & Kitchen Token
            </div>
          </div>

          {/* Prominent High-Visibility Pickup Token Box */}
          <div className="bill-token-box my-2 py-1.5 px-3 text-center border-2 border-dashed border-neutral-900 rounded-lg bg-amber-50/60 print:bg-white print:border-neutral-900">
            <span className="text-[8.5px] font-bold uppercase tracking-widest text-neutral-600 block">
              Pickup Token Number
            </span>
            <div className="bill-token-number text-2xl sm:text-3xl font-mono font-black tracking-wider text-neutral-900 my-0.5">
              #{pickupToken}
            </div>
            <div className="flex items-center justify-center gap-2 text-[9px] font-bold uppercase tracking-wider text-emerald-800">
              <span>★ Store Pickup / Dine-in ★</span>
              <span>•</span>
              <span>{order.paymentStatus === 'fully_paid' ? 'Fully Paid' : '20% Advance Confirmed'}</span>
            </div>
          </div>

          {/* Meta Details 2-Column Grid */}
          <div className="bill-meta-grid grid grid-cols-2 gap-x-4 gap-y-1 py-1.5 text-[10px] border-b border-neutral-300">
            <div>
              <span className="text-neutral-500 font-semibold block text-[9px] uppercase">Receipt No:</span>
              <span className="font-mono font-bold text-neutral-900">{receiptNumber}</span>
            </div>
            <div className="text-right">
              <span className="text-neutral-500 font-semibold block text-[9px] uppercase">Date & Time:</span>
              <span className="font-bold text-neutral-900">{formattedDate}</span>
            </div>
            <div>
              <span className="text-neutral-500 font-semibold block text-[9px] uppercase">Customer:</span>
              <span className="font-bold text-neutral-900 truncate block">
                {customerName} {customerPhone ? `(${customerPhone})` : ''}
              </span>
            </div>
            <div className="text-right">
              <span className="text-neutral-500 font-semibold block text-[9px] uppercase">Payment Status:</span>
              <span className="font-bold text-emerald-800">{cleanPaymentMethod()}</span>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="bill-items-table py-1.5">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-neutral-900 text-[9px] font-black uppercase text-neutral-800">
                  <th className="py-1 w-6">#</th>
                  <th className="py-1">Item Description</th>
                  <th className="py-1 text-center w-12">Qty</th>
                  <th className="py-1 text-right w-16">Rate</th>
                  <th className="py-1 text-right w-16">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 text-[10px]">
                {order.items?.map((item, idx) => {
                  const name = item.menuItem?.name || item.name || 'Item';
                  const qty = item.quantity || 1;
                  const rate = item.priceEach || (item.price ? item.price : Math.round((item.total || 0) / qty));
                  const lineTotal = item.total || (rate * qty);
                  return (
                    <tr key={idx} className="py-1">
                      <td className="py-1 font-mono text-neutral-400">{idx + 1}</td>
                      <td className="py-1 font-bold text-neutral-900 pr-2">
                        {name}
                      </td>
                      <td className="py-1 text-center font-bold text-neutral-800">{qty}</td>
                      <td className="py-1 text-right font-mono text-neutral-600">₹{rate}</td>
                      <td className="py-1 text-right font-mono font-bold text-neutral-900">₹{lineTotal}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Financial Breakdown & Split */}
          <div className="bill-financial-summary pt-1.5 border-t-2 border-neutral-900 space-y-0.5 text-[10px]">
            <div className="flex justify-between text-neutral-600">
              <span>Item Subtotal</span>
              <span className="font-mono font-semibold">₹{order.subtotal || order.total}</span>
            </div>

            {order.discount > 0 && (
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>Special Coupon Discount</span>
                <span className="font-mono font-bold">-₹{order.discount}</span>
              </div>
            )}

            <div className="flex justify-between text-neutral-600">
              <span>Packaging & Store Service</span>
              <span className="font-mono font-semibold">₹0 (Free)</span>
            </div>

            <div className="flex justify-between text-neutral-600">
              <span>Taxes / GST</span>
              <span className="font-mono font-semibold">₹0 (0% GST)</span>
            </div>

            {/* Total Order Value */}
            <div className="bill-total-row flex justify-between items-center py-1 border-y-2 border-neutral-900 text-neutral-900 font-black text-xs">
              <span className="uppercase tracking-wider">Total Order Value</span>
              <span className="font-mono text-sm font-black">₹{order.total}</span>
            </div>

            {/* Advance & Balance Split — Side by Side Grid for Half-A4 Format */}
            <div className="bill-split-grid pt-1 grid grid-cols-2 gap-2">
              <div className="bill-split-box flex justify-between items-center px-2 py-1 rounded bg-emerald-50 border border-emerald-300 text-emerald-950 font-bold print:border-neutral-900 print:bg-white">
                <span className="flex items-center gap-1 text-[9px] leading-tight">
                  <CheckCircle2 className="w-3 h-3 text-emerald-700 shrink-0" />
                  <span>20% Paid Online</span>
                </span>
                <span className="font-mono font-black text-[11px] text-emerald-800">
                  ₹{advanceAmount}
                </span>
              </div>

              <div className="bill-split-box flex justify-between items-center px-2 py-1 rounded bg-amber-100/70 border-2 border-amber-500 text-neutral-950 font-black print:border-2 print:border-neutral-900 print:bg-white">
                <span className="flex items-center gap-1 text-[9px] uppercase tracking-tight leading-tight">
                  <Store className="w-3 h-3 text-primary shrink-0" />
                  <span>{order.paymentStatus === 'fully_paid' ? 'Paid' : 'Due at Shop (80%)'}</span>
                </span>
                <span className="font-mono font-black text-xs text-primary print:text-neutral-900">
                  ₹{order.paymentStatus === 'fully_paid' ? 0 : balanceAmount}
                </span>
              </div>
            </div>
          </div>

          {/* Counter QR Code & Pickup Instructions */}
          <div className="bill-qr-section mt-2 pt-1.5 border-t border-dashed border-neutral-300 flex items-center gap-2.5">
            {qrDataUrl && (
              <div className="shrink-0 p-0.5 bg-white border border-neutral-400 rounded-lg shadow-xs text-center">
                <img 
                  src={qrDataUrl} 
                  alt="Pickup QR" 
                  className="w-14 h-14 object-contain mx-auto"
                />
                <span className="text-[7.5px] font-bold text-neutral-600 block mt-0.5">
                  Scan at Counter
                </span>
              </div>
            )}
            <div className="space-y-0.5 text-[9.5px] leading-tight text-neutral-700">
              <p className="font-bold text-neutral-900 text-[10px]">
                Pickup Instructions:
              </p>
              <p>
                1. Present Token <span className="font-bold text-neutral-900">#{pickupToken}</span> at the counter.
              </p>
              <p>
                2. Collect your fresh, hot order once prepared.
              </p>
              <p className="text-neutral-500 text-[8.5px] pt-0.5">
                📍 Location: Near Medical College, Shahdol • Tea Bhatti Cafe
              </p>
            </div>
          </div>

          {/* Footer Note */}
          <div className="bill-footer mt-2 pt-1 border-t-2 border-neutral-900 text-center text-[8.5px] text-neutral-500 font-medium space-y-0.5">
            <p className="font-bold text-neutral-800">
              Thank You for Dining with Tea Bhatti Cafe! Visit Again.
            </p>
            <p>
              This is a computer-generated receipt • CafeOS Enterprise POS System
            </p>
          </div>

          {/* Half-Page Cut / Fold Guide for A4 Sheet */}
          <div className="bill-cut-guide mt-2 pt-1.5 text-center text-[8px] text-neutral-400 font-mono border-t border-dashed border-neutral-300 print:block hidden">
            - - - - - - - - - - - - - - - - ✂ Cut / Fold Here (A4 Half Sheet) ✂ - - - - - - - - - - - - - - - -
          </div>
        </div>
      </div>

        {/* ── Modal Footer Action Buttons (Hidden during Print) ── */}
        <div className="p-4 bg-neutral-50 border-t border-border-subtle flex items-center justify-end gap-2.5 print:hidden shrink-0">
          <button
            onClick={onClose}
            className="btn-outline py-2.5 px-4 text-xs font-bold"
          >
            Close
          </button>

          <button
            onClick={handlePrint}
            className="py-2.5 px-5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all active:scale-[0.98]"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            Print Bill / POS Slip
          </button>
        </div>

      </div>
    </div>
  );
}
