// ── Menu Page — Tea Bhatti ──
// Zomato-inspired: shimmer skeletons, staggered card reveal,
// lazy image loading, animated toast, spring hover effects.

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Plus, Minus, ShoppingCart, Check, RefreshCw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import api from '../lib/api.js';
import { useCart } from '../context/CartContext.jsx';
import SkeletonCard from '../components/SkeletonCard.jsx';
import LazyImage from '../components/LazyImage.jsx';

// ── Veg indicator ──
function VegDot() {
  return (
    <div className="w-4 h-4 border-2 border-success rounded-sm flex items-center justify-center">
      <div className="w-2 h-2 bg-success rounded-full" />
    </div>
  );
}

// ── Menu Item Card ──
function MenuItemCard({ item, onAdd, index }) {
  const [qty, setQty] = useState(1);
  const [showAddOns, setShowAddOns] = useState(false);
  const [selectedAddOns, setSelectedAddOns] = useState([]);
  const [justAdded, setJustAdded] = useState(false);

  const discountedPrice = item.price * (1 - (item.discountPct || 0) / 100);

  const toggleAddOn = (addOn) => {
    setSelectedAddOns(prev =>
      prev.find(a => a.name === addOn.name)
        ? prev.filter(a => a.name !== addOn.name)
        : [...prev, { name: addOn.name, price: addOn.price }]
    );
  };

  const handleAdd = () => {
    onAdd(item, qty, selectedAddOns);
    setJustAdded(true);
    setTimeout(() => {
      setJustAdded(false);
      setQty(1);
      setSelectedAddOns([]);
      setShowAddOns(false);
    }, 800);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35, ease: 'easeOut' }}
      whileHover={{ y: -4 }}
      className="bg-bg-surface rounded-card shadow-card overflow-hidden group"
    >
      {/* Image */}
      <div className={`relative h-44 overflow-hidden ${!item.isAvailable ? 'opacity-50 grayscale' : ''}`}>
        <LazyImage
          src={item.imageUrl}
          alt={item.name}
          className="w-full h-full group-hover:scale-105 transition-transform duration-500"
        />

        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
          {!item.isAvailable ? (
            <span className="bg-error/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              Out of Stock
            </span>
          ) : (
            <>
              {item.discountPct > 0 && (
                <span className="bg-secondary/90 backdrop-blur-sm text-text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {item.discountPct}% OFF
                </span>
              )}
              {item.rating >= 4.5 && (
                <span className="bg-primary/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  ⭐ Best Seller
                </span>
              )}
            </>
          )}
        </div>
        <div className="absolute top-2.5 right-2.5">
          <VegDot />
        </div>

        {/* Bottom gradient for text readability */}
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/20 to-transparent" />
      </div>

      {/* Content */}
      <div className="p-3.5">
        <h3 className="font-heading font-semibold text-text-primary text-[15px] leading-tight mb-0.5 line-clamp-2">
          {item.name}
        </h3>
        {item.description && (
          <p className="text-text-secondary text-xs line-clamp-1 mb-1.5">
            {item.description}
          </p>
        )}

        {/* Rating */}
        {item.rating > 0 && (
          <div className="flex items-center gap-1 mb-2">
            <div className="flex items-center gap-0.5 bg-success/10 px-1.5 py-0.5 rounded">
              <span className="text-success text-xs font-bold">★ {item.rating}</span>
            </div>
          </div>
        )}

        {/* Price */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-lg font-bold text-text-primary">
            ₹{discountedPrice.toFixed(0)}
          </span>
          {item.discountPct > 0 && (
            <span className="text-xs text-text-secondary line-through">
              ₹{item.price.toFixed(0)}
            </span>
          )}
        </div>

        {/* Add-ons */}
        {item.addOns?.length > 0 && (
          <div className="mb-2.5">
            <button
              onClick={() => setShowAddOns(!showAddOns)}
              className="text-[11px] text-primary font-medium hover:underline"
            >
              {showAddOns ? 'Hide' : 'Customise'} ({item.addOns.length} add-ons)
            </button>
            <AnimatePresence>
              {showAddOns && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-1.5 space-y-1">
                    {item.addOns.map(ao => (
                      <label key={ao.name} className="flex items-center gap-2 text-xs cursor-pointer group/addon py-0.5">
                        <input
                          type="checkbox"
                          checked={selectedAddOns.some(a => a.name === ao.name)}
                          onChange={() => toggleAddOn(ao)}
                          className="rounded border-border-subtle text-primary focus:ring-primary/20 w-3.5 h-3.5"
                        />
                        <span className="text-text-secondary group-hover/addon:text-text-primary transition-colors flex-1">
                          {ao.name}
                        </span>
                        <span className="text-text-secondary text-[10px] font-medium">+₹{ao.price}</span>
                      </label>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Quantity + Add */}
        {!item.isAvailable ? (
          <button disabled className="w-full bg-bg-subtle text-text-secondary/60 text-xs font-semibold py-2.5 rounded-lg cursor-not-allowed border border-border-subtle min-h-[36px]">
            Out of Stock
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-bg-subtle rounded-lg px-1 py-0.5 shrink-0">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-bg-base active:scale-90 transition-all text-text-primary"
                aria-label="Decrease quantity"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-5 text-center font-bold text-xs text-text-primary">{qty}</span>
              <button
                onClick={() => setQty(qty + 1)}
                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-bg-base active:scale-90 transition-all text-text-primary"
                aria-label="Increase quantity"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <motion.button
              onClick={handleAdd}
              whileTap={{ scale: 0.95 }}
              className={`flex-1 text-xs font-semibold py-2 px-3 rounded-lg inline-flex items-center justify-center gap-1.5 min-h-[36px]
                         transition-all duration-300 ${
                justAdded
                  ? 'bg-success text-white'
                  : 'bg-primary text-white hover:bg-primary-hover shadow-xs'
              }`}
            >
              {justAdded ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Added!
                </>
              ) : (
                <>
                  <ShoppingCart className="w-3.5 h-3.5" /> Add
                </>
              )}
            </motion.button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Main Menu Page ──
export default function Menu() {
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [slowLoadWarning, setSlowLoadWarning] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [sortBy, setSortBy] = useState('');
  const { addItem, businessId, setBusinessId, businessConfig } = useCart();
  const [toast, setToast] = useState('');
  const bId = businessId || searchParams.get('businessId') || '';

  // Store Availability Check (Emergency Pause, Closed Days, Operating Hours)
  const storeStatus = React.useMemo(() => {
    if (!businessConfig) return { isOpen: true };

    if (businessConfig.isAcceptingOrders === false) {
      return {
        isOpen: false,
        reason: businessConfig.closureReason || 'Unable to accept orders right now. Please check back later.',
        type: 'emergency',
      };
    }

    const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = days[nowIST.getDay()];
    if (Array.isArray(businessConfig.closedDays) && businessConfig.closedDays.includes(currentDay)) {
      return {
        isOpen: false,
        reason: `Tea Bhatti is closed today (${currentDay}).`,
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
          reason: `Tea Bhatti is currently closed. Today's hours: ${businessConfig.openingTime} to ${businessConfig.closingTime}.`,
          type: 'hours',
        };
      }
    }

    return { isOpen: true };
  }, [businessConfig]);

  useEffect(() => {
    loadCategories();
    loadMenu();
  }, [bId, selectedCategory, sortBy, search]);

  useEffect(() => {
    const cat = searchParams.get('category');
    if (cat) setSelectedCategory(cat);
  }, [searchParams]);

  async function loadCategories() {
    try {
      const data = await api.getCategories(bId);
      if (Array.isArray(data)) setCategories(data);
    } catch (err) {
      console.warn('Categories load note:', err);
    }
  }

  async function loadMenu() {
    if (items.length === 0) setLoading(true);
    setFetchError(null);

    // Warm-up indicator if backend takes more than 3.5s (Render cold start)
    const timer = setTimeout(() => {
      if (items.length === 0) setSlowLoadWarning(true);
    }, 3500);

    try {
      let params = '';
      if (selectedCategory) {
        params += `&category=${encodeURIComponent(selectedCategory)}`;
      }
      if (sortBy) params += `&sortBy=${sortBy}`;
      if (search) params += `&search=${encodeURIComponent(search)}`;

      const data = await api.getMenu(bId, params);
      const menuList = data?.items || (Array.isArray(data) ? data : []);
      setItems(menuList);

      if (data?.businessId && setBusinessId && !businessId) {
        setBusinessId(data.businessId);
        localStorage.setItem('cafeos_businessId', data.businessId);
      }
    } catch (err) {
      console.error('Failed to load menu:', err);
      setFetchError(err.message || 'Could not load menu items from server');
    } finally {
      clearTimeout(timer);
      setSlowLoadWarning(false);
      setLoading(false);
    }
  }

  const handleAdd = (item, qty, addOns) => {
    addItem(item, qty, addOns);
    setToast(`${item.name} added to cart!`);
    setTimeout(() => setToast(''), 2500);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-heading font-bold text-text-primary mb-1">
          Our Menu
        </h1>
        <p className="text-text-secondary text-sm">
          Freshly prepared 100% vegetarian bites and beverages.
        </p>
      </div>

      {/* Store Closed / Paused Notice */}
      {!storeStatus.isOpen && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Store Notice:</strong> {storeStatus.reason} You can still browse our menu, but online ordering is temporarily paused.
            </span>
          </div>
          <a
            href="tel:+917000748920"
            className="text-[11px] font-bold text-amber-900 underline shrink-0 hover:text-amber-950"
          >
            Call Us (+91 7000748920)
          </a>
        </div>
      )}

      {/* Render Server Cold-Start Notice */}
      {slowLoadWarning && loading && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3 shadow-2xs"
        >
          <div className="flex items-center gap-2.5">
            <RefreshCw className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
            <span>
              <strong>Connecting to café server...</strong> The server is waking up (Render free tier may take ~20-30s on first load).
            </span>
          </div>
          <span className="text-[10px] text-amber-700 bg-amber-200/60 px-2 py-0.5 rounded-full font-bold shrink-0">
            Warming up
          </span>
        </motion.div>
      )}

      {/* Connection Error with Retry Button */}
      {fetchError && !loading && items.length === 0 && (
        <div className="text-center py-10 px-4 rounded-2xl bg-red-50/60 border border-red-200 mb-6">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-2.5" />
          <h3 className="text-base font-heading font-bold text-red-900 mb-1">
            Unable to load menu
          </h3>
          <p className="text-xs text-red-700 mb-4 max-w-md mx-auto">
            {fetchError}. If the backend just woke up, please click retry below.
          </p>
          <button
            onClick={() => {
              loadCategories();
              loadMenu();
            }}
            className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        </div>
      )}

      {/* Animated Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50
                       bg-text-primary text-white px-5 py-3 rounded-xl shadow-elevated
                       font-medium text-sm flex items-center gap-2 backdrop-blur-sm"
          >
            <div className="w-5 h-5 bg-success rounded-full flex items-center justify-center flex-shrink-0">
              <Check className="w-3 h-3 text-white" />
            </div>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5 mb-5 p-3 bg-bg-surface rounded-xl border border-border-subtle/50">
        {/* Search */}
        <div className="relative w-full sm:w-auto sm:flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadMenu()}
            placeholder="Search dishes..."
            className="input-field pl-10 py-2 text-sm w-full"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Category dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="input-field py-2 text-sm flex-1 sm:flex-initial sm:w-auto min-w-[130px]"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
          </select>

          {/* Pure Veg Badge */}
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-success/10 border border-success/30 text-success shrink-0">
            <VegDot />
            100% Pure Veg
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input-field py-2 text-sm flex-1 sm:flex-initial sm:w-auto min-w-[120px]"
          >
            <option value="">Sort By</option>
            <option value="price_low">Price: Low → High</option>
            <option value="price_high">Price: High → Low</option>
            <option value="rating">Top Rated</option>
            <option value="name">Name A-Z</option>
          </select>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-none max-w-full">
        <button
          onClick={() => setSelectedCategory('')}
          className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
            !selectedCategory
              ? 'bg-primary text-white shadow-md'
              : 'bg-bg-subtle text-text-secondary hover:bg-border-subtle'
          }`}
        >
          All
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.name === selectedCategory ? '' : cat.name)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
              selectedCategory === cat.name
                ? 'bg-primary text-white shadow-md'
                : 'bg-bg-subtle text-text-secondary hover:bg-border-subtle'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Menu Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
          {[...Array(8)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20"
        >
          <div className="w-16 h-16 rounded-3xl bg-bg-subtle mx-auto mb-4 flex items-center justify-center">
            <Search className="w-8 h-8 text-text-secondary/50" />
          </div>
          <h3 className="text-lg font-heading font-semibold text-text-primary mb-2">
            No items found
          </h3>
          <p className="text-text-secondary text-sm">
            Try adjusting your filters or search terms.
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
          {items.map((item, i) => (
            <MenuItemCard key={item.id} item={item} onAdd={handleAdd} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
