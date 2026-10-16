// ── Cart Context ──
// Client-side cart with localStorage persistence.
// Server-side price validation happens at checkout via /cart/compute.

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext.jsx';
import api from '../lib/api.js';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [businessId, setBusinessId] = useState(localStorage.getItem('cafeos_businessId') || '');
  const [businessConfig, setBusinessConfig] = useState(null);
  const [initialized, setInitialized] = useState(false);
  
  const cartStorageKey = user ? `cafeos_cart_${user.id}` : 'cafeos_cart_guest';

  // Resolve Business ID — always verify against server to avoid stale IDs
  useEffect(() => {
    async function resolveBusinessId() {
      const urlParams = new URLSearchParams(window.location.search);
      const urlBId = urlParams.get('businessId');
      
      try {
        // Always fetch the actual default business from the server
        const serverBusiness = await api.getDefaultBusiness();
        if (serverBusiness) setBusinessConfig(serverBusiness);

        const serverId = serverBusiness?.id;

        // URL param takes priority, then server response, then cached
        const bId = urlBId || serverId || localStorage.getItem('cafeos_businessId');

        if (bId) {
          setBusinessId(bId);
          localStorage.setItem('cafeos_businessId', bId);
        }
      } catch (err) {
        console.error('Could not fetch default business', err);
        // Fallback: try URL param or cached value
        const fallback = urlBId || localStorage.getItem('cafeos_businessId');
        if (fallback) {
          setBusinessId(fallback);
        }
      }
    }
    resolveBusinessId();
  }, []);

  // Load cart from localStorage when user changes or on mount
  useEffect(() => {
    const saved = localStorage.getItem(cartStorageKey);
    if (saved) {
      try { setItems(JSON.parse(saved)); } catch { setItems([]); }
    } else {
      setItems([]);
    }
    setInitialized(true);
  }, [cartStorageKey]);

  // Persist cart to localStorage
  useEffect(() => {
    if (initialized) {
      localStorage.setItem(cartStorageKey, JSON.stringify(items));
    }
  }, [items, cartStorageKey, initialized]);

  const addItem = (menuItem, quantity = 1, selectedAddOns = []) => {
    setItems(prev => {
      // Check if item with same add-ons already exists
      const existingIndex = prev.findIndex(
        i => i.menuItemId === menuItem.id &&
        JSON.stringify(i.addOns) === JSON.stringify(selectedAddOns)
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].quantity += quantity;
        return updated;
      }

      return [...prev, {
        menuItemId: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        discountPct: menuItem.discountPct || 0,
        imageUrl: menuItem.imageUrl,
        isVeg: menuItem.isVeg !== undefined ? Boolean(menuItem.isVeg) : true,
        quantity,
        addOns: selectedAddOns,
      }];
    });
  };

  const updateQuantity = (index, quantity) => {
    if (quantity <= 0) {
      removeItem(index);
      return;
    }
    setItems(prev => {
      const updated = [...prev];
      updated[index].quantity = quantity;
      return updated;
    });
  };

  const removeItem = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setItems([]);
    localStorage.removeItem(cartStorageKey);
  };

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  const subtotal = items.reduce((sum, item) => {
    const discountedPrice = item.price * (1 - (item.discountPct || 0) / 100);
    const addOnTotal = item.addOns.reduce((s, a) => s + a.price, 0);
    return sum + (discountedPrice + addOnTotal) * item.quantity;
  }, 0);

  return (
    <CartContext.Provider value={{
      items, businessId, setBusinessId, businessConfig,
      addItem, updateQuantity, removeItem, clearCart,
      itemCount, subtotal,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
