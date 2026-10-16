// ── Cart Page ──
// Full cart view with line items, quantity controls, and checkout CTA.

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, UtensilsCrossed, Store } from 'lucide-react';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Cart() {
  const { items, updateQuantity, removeItem, clearCart, subtotal } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center animate-fade-in">
        <div className="w-20 h-20 rounded-3xl bg-bg-subtle mx-auto mb-6 flex items-center justify-center">
          <ShoppingBag className="w-10 h-10 text-text-secondary/60" />
        </div>
        <h1 className="text-2xl font-heading font-bold text-text-primary mb-3">
          Your cart is empty
        </h1>
        <p className="text-text-secondary mb-8">
          Browse our menu and add some delicious items!
        </p>
        <Link to="/menu" className="btn-primary inline-flex items-center gap-2">
          <ShoppingBag className="w-5 h-5" />
          Browse Menu
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-fade-in pb-28 md:pb-8">
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text-primary">
          Your Cart
        </h1>
        <button
          onClick={clearCart}
          className="text-sm text-error hover:text-error/80 font-medium transition-colors"
        >
          Clear All
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item, index) => {
            const discountedPrice = item.price * (1 - (item.discountPct || 0) / 100);
            const addOnTotal = item.addOns.reduce((s, a) => s + a.price, 0);
            const lineTotal = (discountedPrice + addOnTotal) * item.quantity;

            return (
              <div key={index} className="card p-4 flex gap-4 animate-fade-in">
                {/* Image */}
                <div className="w-20 h-20 rounded-button bg-bg-subtle flex items-center justify-center shrink-0 overflow-hidden">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <UtensilsCrossed className="w-8 h-8 text-text-secondary/40" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {/* 100% Pure Veg Indicator (Tea Bhatti is Pure Veg) */}
                        <div className="w-3.5 h-3.5 border-2 border-emerald-600 rounded-xs flex items-center justify-center shrink-0" title="100% Pure Veg">
                          <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full" />
                        </div>
                        <h3 className="font-semibold text-text-primary truncate">
                          {item.name}
                        </h3>
                      </div>
                      {item.addOns.length > 0 && (
                        <p className="text-xs text-text-secondary">
                          + {item.addOns.map(a => a.name).join(', ')}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => removeItem(index)}
                      className="p-1.5 rounded-lg text-text-secondary hover:text-error
                               hover:bg-error/10 transition-all duration-200"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    {/* Quantity Controls */}
                    <div className="flex items-center gap-2 bg-bg-subtle rounded-button px-1.5 py-1">
                      <button
                        onClick={() => updateQuantity(index, item.quantity - 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg
                                 hover:bg-bg-base transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-6 text-center font-semibold text-sm">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(index, item.quantity + 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg
                                 hover:bg-bg-base transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Price */}
                    <span className="font-bold text-text-primary">
                      ₹{lineTotal.toFixed(0)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="card p-6 sticky top-20">
            <h2 className="font-heading font-bold text-lg text-text-primary mb-4">
              Order Summary
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-text-secondary">
                <span>Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items)</span>
                <span className="font-medium text-text-primary">₹{Math.round(subtotal)}</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Packing Charge</span>
                <span className="text-emerald-600 font-medium">Free</span>
              </div>
            </div>

            {(() => {
              const totalEst = Math.round(subtotal);
              const advEst = Math.round(totalEst * 0.20);
              const balEst = totalEst - advEst;
              return (
                <>
                  <div className="flex justify-between font-heading font-bold text-lg text-text-primary">
                    <span>Estimated Total</span>
                    <span>₹{totalEst}</span>
                  </div>
                  <div className="mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                    <span className="font-bold text-primary flex items-center gap-1.5 mb-0.5">
                      <Store className="w-3.5 h-3.5" /> Store Pickup Booking:
                    </span>
                    <span className="text-[11px] text-text-secondary">
                      Pay ₹{advEst} (20% advance) online. Pay remaining ₹{balEst} at the counter!
                    </span>
                  </div>
                </>
              );
            })()}

            <button
              onClick={() => {
                if (!isAuthenticated) {
                  navigate('/login?redirect=/checkout');
                } else {
                  navigate('/checkout');
                }
              }}
              className="btn-primary w-full mt-4 inline-flex items-center justify-center gap-2"
            >
              Proceed to Checkout
              <ArrowRight className="w-5 h-5" />
            </button>

            <Link
              to="/menu"
              className="block text-center text-sm text-primary font-medium mt-3
                       hover:text-primary-hover transition-colors"
            >
              + Add more items
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
