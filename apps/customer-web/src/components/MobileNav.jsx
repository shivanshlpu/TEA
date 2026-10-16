// ── Mobile Bottom Navigation Bar ──
// Visible only on mobile screens (matching reference mobile design)
// Home, Menu, Orders, Cart

import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, UtensilsCrossed, Clock, ShoppingCart } from 'lucide-react';
import { useCart } from '../context/CartContext.jsx';

export default function MobileNav() {
  const { itemCount } = useCart();

  const links = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/menu', label: 'Menu', icon: UtensilsCrossed },
    { to: '/orders', label: 'Orders', icon: Clock },
    { to: '/cart', label: 'Cart', icon: ShoppingCart, badge: itemCount },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#EFE5D8] pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] px-2 sm:px-4 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-around">
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-semibold transition-colors relative min-h-[44px] min-w-[54px] ${
                  isActive
                    ? 'text-[#E94B18]'
                    : 'text-[#746A60] hover:text-[#203B2C]'
                }`
              }
            >
              <div className="relative">
                <Icon className="w-4 h-4 mb-0.5" />
                {item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-[#E94B18] text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
