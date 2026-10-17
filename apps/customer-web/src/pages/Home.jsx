// ── Home Page — Tea Bhatti (Shahdol ki apni) ──
// High-fidelity background integration:
// 1. Hero Section using exact supplied image `/images/tea-bhatti-hero-bg.png`
//    - Storefront sketch, TEA BHATTI signage, and food platter natively rendered in background
//    - Real HTML text, eyebrow, headline, subhead, and orange CTA interactive on top
// 2. Overlapping Service Benefits Bar (Fast Prep, Store Pickup, 20% Advance, Fresh Quality)
// 3. Food Category Row (Burger, Vada Pav, Sandwich, Maggie, Pizza, Pasta, French Fries, Combos)
// 4. Best Sellers 6-grid with crisp food photos and dynamic Add to Cart
// 5. Promotional Offer Banner using exact supplied image `/images/tea-bhatti-offer-bg.png`
//    - Burger, fries, and kulhad tea natively on left of the background
//    - Dynamic coupon data fetched from backend (editable from Owner Dashboard)
// 6. Featured Cafe Specials Carousel preserving user's original poster artworks

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Zap, 
  Store, 
  CreditCard, 
  Leaf, 
  Star, 
  Heart, 
  Plus, 
  ArrowRight, 
  ChevronLeft,
  ChevronRight,
  Ticket
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCart } from '../context/CartContext.jsx';
import api from '../lib/api.js';

// ── 8 Categories defined in exact reference order ──
const CATEGORIES = [
  { id: 'burger', name: 'Burger', image: '/assets/burger.png', query: 'BURGERRR' },
  { id: 'vada-pav', name: 'Vada Pav', image: '/assets/vada-pav.png', query: 'VADA PAV' },
  { id: 'sandwich', name: 'Sandwich', image: '/assets/sandwich.png', query: 'SANDWICH' },
  { id: 'maggie', name: 'Maggie', image: '/assets/maggie.png', query: 'MAGGIE' },
  { id: 'pizza', name: 'Pizza', image: '/assets/pizza.png', query: 'PIZZAAAH' },
  { id: 'pasta', name: 'Pasta', image: '/assets/pasta.png', query: 'PAAAASTA' },
  { id: 'fries', name: 'French Fries', image: '/assets/fries.png', query: 'FRENCH FRIES' },
  { id: 'combo', name: 'Combos', image: '/assets/combo.png', query: 'COMBOS' },
];

// ── 6 Best Sellers defined in exact reference order & pricing ──
const BEST_SELLERS = [
  {
    id: '6acd71bc90fc89567f0d0007',
    name: 'Tandoori Paneer Sandwich',
    price: 79,
    rating: 4.8,
    reviews: 320,
    image: '/assets/tandoori-paneer-sandwich.jpg',
    category: 'SANDWICH',
    isVeg: true,
    description: 'Grilled sandwich with succulent tandoori paneer & melted cheese',
  },
  {
    id: '6acd71bc90fc89567f0cfffe',
    name: 'Cheese Peppy Paneer',
    price: 149,
    rating: 4.8,
    reviews: 412,
    image: '/assets/cheese-peppy-paneer.jpg',
    category: 'PIZZAAAH',
    isVeg: true,
    description: 'Crisp hand-tossed pizza with peppy paneer & fresh bell peppers',
  },
  {
    id: '6acd71bc90fc89567f0d0000',
    name: 'Cheese Butter Vadapav',
    price: 35,
    rating: 4.8,
    reviews: 210,
    image: '/assets/cheese-butter-vadapav.jpg',
    category: 'VADA PAV',
    isVeg: true,
    description: 'Golden spiced potato dumpling in butter-toasted pav with cheese',
  },
  {
    id: '6acd71bc90fc89567f0d0001',
    name: 'Veggie Cheese Maggie',
    price: 60,
    rating: 4.8,
    reviews: 180,
    image: '/assets/veggie-cheese-maggie.jpg',
    category: 'MAGGIE',
    isVeg: true,
    description: 'Comforting cheesy noodles with garden veggies & mild spices',
  },
  {
    id: '6acd71bc90fc89567f0d0004',
    name: '1 Ch. Peppy Paneer Pizza + 1 Ch. Corn Sandwich + 2 Cold...',
    price: 299,
    rating: 4.8,
    reviews: 95,
    image: '/assets/combo-pizza-sandwich-cold-drink.jpg',
    category: 'COMBOS',
    isVeg: true,
    description: 'Ultimate party combo with pizza, sandwich, and chilled beverages',
  },
  {
    id: '6acd71bc90fc89567f0d0002',
    name: 'Veggie Cheese Corn',
    price: 139,
    rating: 4.8,
    reviews: 145,
    image: '/assets/veggie-cheese-corn.jpg',
    category: 'PIZZAAAH',
    isVeg: true,
    description: 'Cheesy pizza loaded with golden sweet corn and mozzarella',
  },
];

// ── User's Original Promotional Posters Preserved ──
const PROMO_POSTERS = [
  { id: 1, image: '/assets/poster1.png', title: 'Welcome to Tea Bhatti Cafe', subtitle: 'A premium pure-veg cafe experience in Shahdol.', link: '/menu' },
  { id: 2, image: '/assets/poster2.png', title: 'Combo Offer — Save 10%', subtitle: 'Add 4+ items to cart for instant discount.', link: '/menu?category=COMBOS' },
  { id: 3, image: '/assets/poster3.png', title: 'Freshly Baked Pizzas', subtitle: 'Loaded with real mozzarella and fresh herbs.', link: '/menu?category=PIZZAAAH' },
  { id: 4, image: '/assets/poster4.png', title: 'Crispy Burgers', subtitle: 'Toasted buns, fresh veggies & golden patties.', link: '/menu?category=BURGERRR' },
  { id: 5, image: '/assets/poster5.png', title: 'Midnight Cravings', subtitle: 'Hot steaming Maggie made fresh.', link: '/menu?category=MAGGIE' },
  { id: 6, image: '/assets/poster6.png', title: 'Creamy Pasta Delights', subtitle: 'Rich, spicy, and perfectly seasoned.', link: '/menu?category=PAAAASTA' },
  { id: 7, image: '/assets/poster7.png', title: 'Signature Vadapav', subtitle: 'Authentic taste with spicy chutneys.', link: '/menu?category=VADA%20PAV' },
];

export default function Home() {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [activeCategory, setActiveCategory] = useState('burger');
  const [favorites, setFavorites] = useState({});
  const [backendItems, setBackendItems] = useState([]);
  const [addedIds, setAddedIds] = useState({});
  const [currentPoster, setCurrentPoster] = useState(0);

  // Dynamic offer data from owner dashboard
  const [activeOffer, setActiveOffer] = useState({
    title: 'Order 4+ Items,',
    highlightText: 'Get 10% Off!',
    code: 'TASTE10',
    subtitle: 'Automatic combo discount applied at checkout',
    discountType: 'percentage',
    value: 10,
  });

  // Auto-play for promotional poster carousel
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentPoster(prev => (prev + 1) % PROMO_POSTERS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  // Fetch live active coupon and menu items in parallel (SWR 0ms instant display)
  useEffect(() => {
    let isMounted = true;

    // 1. Fetch menu in parallel (0ms instant display from local SWR cache)
    api.getMenu().then(data => {
      if (!isMounted) return;
      if (Array.isArray(data)) setBackendItems(data);
      else if (data?.items && Array.isArray(data.items)) setBackendItems(data.items);
    }).catch(() => {});

    // 2. Fetch business & coupon in parallel
    api.getDefaultBusiness().then(b => {
      if (!isMounted || !b?.id) return;
      api.getActiveCoupon(b.id).then(coupon => {
        if (isMounted && coupon && coupon.active) {
          setActiveOffer(coupon);
        }
      }).catch(() => {});
    }).catch(() => {});

    return () => { isMounted = false; };
  }, []);

  const toggleFavorite = (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddToCart = (product, e) => {
    e.preventDefault();
    e.stopPropagation();

    const matchedBackend = backendItems.find(
      b => b.name.toLowerCase().includes(product.name.slice(0, 10).toLowerCase())
    );

    const itemToSubmit = matchedBackend ? {
      ...matchedBackend,
      isVeg: true,
      price: product.price,
      imageUrl: product.image,
    } : {
      id: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.image,
      category: product.category,
      isVeg: true,
      isAvailable: true,
    };

    addItem(itemToSubmit, 1, []);
    setAddedIds(prev => ({ ...prev, [product.id]: true }));
    setTimeout(() => {
      setAddedIds(prev => ({ ...prev, [product.id]: false }));
    }, 900);
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#3A2618] selection:bg-[#E94B18]/20">
      
      {/* ── SECTION 1: HERO SECTION INTEGRATING tea-bhatti-hero-bg.png ── */}
      <section 
        className="relative overflow-hidden pt-24 sm:pt-28 md:pt-32 pb-20 sm:pb-24 md:pb-28 border-b border-[#EBE1D2] bg-[#F7F2E8] bg-no-repeat"
        style={{
          backgroundImage: `url('/images/tea-bhatti-hero-bg.png')`,
          backgroundPosition: 'center 46px',
          backgroundSize: 'cover',
        }}
      >
        {/* Soft gradient wash on mobile to guarantee crystal-clear text readability over food */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#F7F2E8]/95 via-[#F7F2E8]/80 to-transparent sm:bg-none pointer-events-none" />

        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center min-h-[220px] sm:min-h-[260px] md:min-h-[300px]">
            
            {/* Left Content Area Layered Above Cream Background Space */}
            <div className="lg:col-span-7 xl:col-span-6 relative">
              
              {/* Eyebrow */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] sm:text-xs font-bold tracking-[0.2em] text-[#746A60] uppercase">
                  SHAHDOL KI APNI
                </span>
                <span className="w-8 h-[1px] bg-[#CBBFB2]" />
              </div>

              {/* Main Headline */}
              <h1 className="text-3xl sm:text-4xl lg:text-[46px] font-heading font-black text-[#203B2C] leading-[1.12] tracking-tight mb-3">
                Chai se zyada,<br />
                <span className="text-[#203B2C]">Ek Habit hai.</span>
              </h1>

              {/* Supporting Line */}
              <p className="text-xs sm:text-sm font-medium text-[#4A382A]/85 tracking-wide mb-6">
                100% Pure Veg · Freshly Prepared · Quick Pickup
              </p>

              {/* Primary Call to Action */}
              <div className="flex items-center gap-4">
                <Link
                  to="/menu"
                  className="inline-flex items-center gap-2 bg-[#E94B18] hover:bg-[#C8451F] text-white font-semibold text-xs sm:text-sm px-6 py-3 rounded-full transition-all duration-200 shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Order for Pickup</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                {/* Hand-written micro doodle note */}
                <div className="hidden sm:flex flex-col text-[11px] font-heading italic text-[#746A60] leading-tight">
                  <span>Good</span>
                  <span>Food</span>
                  <span>Good Mood</span>
                </div>
              </div>
            </div>

            {/* Right Spacer Area so the background's sandwich, chai, and café details shine through */}
            <div className="lg:col-span-5 xl:col-span-6 hidden lg:block h-full min-h-[240px] pointer-events-none" />

          </div>
        </div>
      </section>

      {/* ── SECTION 2: SERVICE BENEFITS BAR (OVERLAPPING STRIP) ── */}
      <section className="relative -mt-8 sm:-mt-10 z-20 max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#FFFDF9] rounded-xl sm:rounded-2xl border border-[#E9DFD0] shadow-[0_6px_24px_rgba(74,56,42,0.07)] p-3 sm:p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 divide-y sm:divide-y-0 sm:divide-x divide-[#E9DFD0]/60">
            
            <div className="flex items-center gap-3 p-1 sm:px-3">
              <div className="w-9 h-9 rounded-full bg-[#E94B18]/10 text-[#E94B18] flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div className="text-left">
                <h2 className="text-xs sm:text-[13px] font-bold text-[#203B2C] leading-tight">Fast Prep</h2>
                <p className="text-[10px] sm:text-[11px] text-[#746A60]">Ready in 15 mins</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-1 pt-3 sm:pt-1 sm:px-3">
              <div className="w-9 h-9 rounded-full bg-[#E94B18]/10 text-[#E94B18] flex items-center justify-center shrink-0">
                <Store className="w-4 h-4" />
              </div>
              <div className="text-left">
                <h2 className="text-xs sm:text-[13px] font-bold text-[#203B2C] leading-tight">Store Pickup</h2>
                <p className="text-[10px] sm:text-[11px] text-[#746A60]">Zero waiting at shop</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-1 pt-3 sm:pt-1 sm:px-3">
              <div className="w-9 h-9 rounded-full bg-[#E94B18]/10 text-[#E94B18] flex items-center justify-center shrink-0">
                <CreditCard className="w-4 h-4" />
              </div>
              <div className="text-left">
                <h2 className="text-xs sm:text-[13px] font-bold text-[#203B2C] leading-tight">20% Advance</h2>
                <p className="text-[10px] sm:text-[11px] text-[#746A60]">Balance at counter</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-1 pt-3 sm:pt-1 sm:px-3">
              <div className="w-9 h-9 rounded-full bg-[#203B2C]/10 text-[#203B2C] flex items-center justify-center shrink-0">
                <Leaf className="w-4 h-4" />
              </div>
              <div className="text-left">
                <h2 className="text-xs sm:text-[13px] font-bold text-[#203B2C] leading-tight">Fresh Quality</h2>
                <p className="text-[10px] sm:text-[11px] text-[#746A60]">100% Pure Veg Bites</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── SECTION 3: WHAT'S ON YOUR MIND? (CATEGORIES) ── */}
      <section className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 mt-12 sm:mt-14">
        
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-heading font-black text-[#203B2C] tracking-tight">
              What’s on your mind?
            </h2>
            <div className="w-4 h-2 text-[#E94B18]">
              <svg viewBox="0 0 24 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M2 10C8 2 16 2 22 10" />
              </svg>
            </div>
          </div>

          <Link
            to="/menu"
            className="text-xs font-bold text-[#E94B18] hover:text-[#C8451F] inline-flex items-center gap-1 transition-colors"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Categories Row */}
        <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto pb-3 scrollbar-none snap-x">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id);
                  navigate(`/menu?category=${encodeURIComponent(cat.query)}`);
                }}
                className={`snap-start flex flex-col items-center justify-between p-2.5 sm:p-3 rounded-2xl min-w-[90px] sm:min-w-[110px] flex-1 transition-all duration-200 border ${
                  isActive
                    ? 'bg-[#F9E5D2]/70 border-[#E94B18]/40 shadow-sm scale-[1.02]'
                    : 'bg-[#F8F3E9] hover:bg-[#F4ECE0] border-[#EAE0D1]'
                }`}
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center mb-2">
                  <img
                    src={cat.image}
                    alt={cat.name}
                    className="w-full h-full object-contain drop-shadow-sm group-hover:scale-105 transition-transform"
                    onError={(e) => { e.target.src = '/teabhatti-logo.png'; }}
                  />
                </div>
                <span className={`text-[11px] sm:text-xs font-bold leading-tight ${
                  isActive ? 'text-[#E94B18]' : 'text-[#4A382A]'
                }`}>
                  {cat.name}
                </span>
                {isActive && (
                  <div className="w-6 h-[2px] bg-[#E94B18] rounded-full mt-1" />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── SECTION 4: BEST SELLERS (6-GRID) ── */}
      <section className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 mt-12 sm:mt-14">
        
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-heading font-black text-[#203B2C] tracking-tight">
              Best Sellers
            </h2>
            <div className="w-4 h-2 text-[#E94B18]">
              <svg viewBox="0 0 24 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M2 10C8 2 16 2 22 10" />
              </svg>
            </div>
          </div>

          <Link
            to="/menu"
            className="text-xs font-bold text-[#E94B18] hover:text-[#C8451F] inline-flex items-center gap-1 transition-colors"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* 6 Products Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {BEST_SELLERS.map((item) => {
            const isFav = !!favorites[item.id];
            const isJustAdded = !!addedIds[item.id];

            return (
              <div
                key={item.id}
                className="bg-[#FFFDF9] rounded-xl border border-[#E9DFD0] overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-200 group"
              >
                {/* Image & Heart Badge */}
                <div className="relative aspect-[4/3] w-full bg-[#F4ECE0] overflow-hidden">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => { e.target.src = '/assets/hero-food.jpg'; }}
                  />
                  <button
                    onClick={(e) => toggleFavorite(item.id, e)}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-[#746A60] hover:text-[#E94B18] transition-colors shadow-xs"
                    aria-label="Save to favorites"
                  >
                    <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-[#E94B18] text-[#E94B18]' : ''}`} />
                  </button>
                </div>

                {/* Content */}
                <div className="p-2.5 sm:p-3 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs sm:text-[13px] font-bold text-[#203B2C] leading-snug line-clamp-2 mb-1">
                      {item.name}
                    </h3>
                    
                    <div className="flex items-center gap-1 text-[10px] text-[#746A60] mb-3">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span className="font-bold text-[#203B2C]">{item.rating}</span>
                      <span>({item.reviews})</span>
                    </div>
                  </div>

                  {/* Price & Add Button */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#F0E6D8]/60 mt-auto">
                    <span className="text-sm sm:text-base font-bold text-[#E94B18]">
                      ₹{item.price}
                    </span>
                    
                    <button
                      onClick={(e) => handleAddToCart(item, e)}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all duration-200 flex items-center gap-1 ${
                        isJustAdded
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[#E94B18] hover:bg-[#C8451F] text-white shadow-xs'
                      }`}
                    >
                      <span>{isJustAdded ? 'Added' : 'Add'}</span>
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      </section>

      {/* ── SECTION 5: PROMOTION OFFER BANNER INTEGRATING tea-bhatti-offer-bg.png ── */}
      {/* Background image contains burger, fries, and kulhad tea on left; open forest green space on center/right */}
      <section className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 mt-14 sm:mt-16">
        <div 
          className="relative rounded-2xl bg-[#1B3626] text-white overflow-hidden p-6 sm:p-8 lg:p-10 shadow-lg bg-cover bg-no-repeat bg-left md:bg-center"
          style={{
            backgroundImage: `url('/images/tea-bhatti-offer-bg.png')`,
          }}
        >
          {/* Subtle overlay on small screens to keep text legible */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#1B3626]/80 to-[#1B3626]/95 sm:bg-none pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 min-h-[140px] sm:min-h-[160px]">
            
            {/* Left Spacer Area preserving the background image's burger, fries & terracotta chai */}
            <div className="w-full md:w-1/3 lg:w-2/5 h-20 sm:h-28 md:h-auto pointer-events-none" />

            {/* Center Dynamic Offer Content (Connected to Owner Dashboard Coupons) */}
            <div className="text-center md:text-left flex-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-white text-[11px] font-bold uppercase tracking-wider mb-2">
                <Ticket className="w-3 h-3 text-[#E94B18]" />
                <span>Featured Coupon: {activeOffer.code}</span>
              </div>

              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-heading font-black leading-tight text-white tracking-tight">
                {activeOffer.title}<br />
                <span className="text-[#E94B18]">{activeOffer.highlightText}</span>
              </h2>
              
              <p className="text-xs sm:text-sm text-[#E9DFD0]/90 mt-1.5 font-sans max-w-md">
                {activeOffer.subtitle}
              </p>
            </div>

            {/* Right: Call to Action Button */}
            <div className="shrink-0 flex items-center gap-4">
              <div className="hidden lg:block bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl p-2.5 text-center text-[10px] text-[#E9DFD0]">
                <span>Fresh Taste</span><br />
                <span className="font-bold text-white uppercase tracking-wider">Everyday</span>
              </div>

              <Link
                to="/menu"
                className="bg-[#FFFDF9] hover:bg-white text-[#203B2C] font-bold text-xs sm:text-sm px-6 py-3 rounded-full transition-all duration-200 inline-flex items-center gap-2 shadow-md hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Start Ordering</span>
                <ArrowRight className="w-4 h-4 text-[#E94B18]" />
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* ── SECTION 6: USER'S ORIGINAL PROMOTIONAL POSTERS CAROUSEL ── */}
      {/* Kept intact so all original posters and promotional artworks are preserved */}
      <section className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 mt-14 sm:mt-16">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-heading font-black text-[#203B2C] tracking-tight">
              Featured Cafe Specials
            </h2>
            <p className="text-xs text-[#746A60]">Explore handcrafted bites and seasonal specials</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPoster(prev => (prev - 1 + PROMO_POSTERS.length) % PROMO_POSTERS.length)}
              className="p-1.5 rounded-full bg-[#F4ECE0] hover:bg-[#EAE0D1] text-[#4A382A] transition-colors"
              aria-label="Previous poster"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPoster(prev => (prev + 1) % PROMO_POSTERS.length)}
              className="p-1.5 rounded-full bg-[#F4ECE0] hover:bg-[#EAE0D1] text-[#4A382A] transition-colors"
              aria-label="Next poster"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="relative rounded-2xl overflow-hidden shadow-sm border border-[#E9DFD0] aspect-[16/9] sm:aspect-[21/9] lg:aspect-[24/7] bg-[#3A2618]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPoster}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0"
            >
              <img
                src={PROMO_POSTERS[currentPoster].image}
                alt={PROMO_POSTERS[currentPoster].title}
                className="w-full h-full object-cover object-center"
                onError={(e) => { e.target.src = '/assets/poster1.png'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-transparent sm:via-black/35 flex flex-col justify-center px-4 sm:px-8 lg:px-12">
                <span className="text-[9px] sm:text-xs font-bold text-[#E94B18] uppercase tracking-wider mb-0.5 sm:mb-1">
                  Special Highlight
                </span>
                <h3 className="text-base sm:text-2xl lg:text-3xl font-heading font-black text-white leading-tight max-w-[200px] sm:max-w-md">
                  {PROMO_POSTERS[currentPoster].title}
                </h3>
                <p className="text-[11px] sm:text-sm text-white/85 mt-0.5 sm:mt-1 max-w-[210px] sm:max-w-md line-clamp-2 leading-snug">
                  {PROMO_POSTERS[currentPoster].subtitle}
                </p>
                <Link
                  to={PROMO_POSTERS[currentPoster].link}
                  className="mt-2.5 sm:mt-4 inline-flex items-center gap-1.5 bg-[#E94B18] hover:bg-[#C8451F] text-white text-[11px] sm:text-xs font-bold px-3 py-1.5 sm:px-4 sm:py-2 rounded-full w-fit transition-colors shadow-sm"
                >
                  <span>Explore Now</span>
                  <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

    </div>
  );
}
