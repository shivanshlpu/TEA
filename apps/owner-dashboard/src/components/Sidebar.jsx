// ── Sidebar — Tea Bhatti Owner Dashboard ──
// Light admin sidebar with warm gourmet palette and pickup operations.

import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  UtensilsCrossed, 
  Users, 
  Ticket, 
  Star, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  Store, 
  Clock,
  Megaphone,
  BarChart3
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/pickups', icon: Store, label: 'Pickup Operations' },
  { to: '/reports', icon: BarChart3, label: 'Sales Reports & BI' },
  { to: '/orders', icon: ShoppingBag, label: 'All Orders' },
  { to: '/menu', icon: UtensilsCrossed, label: 'Menu Catalog' },
  { to: '/marketing', icon: Megaphone, label: 'Marketing & WhatsApp' },
  { to: '/coupons', icon: Ticket, label: 'Coupons & Usage' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/reviews', icon: Star, label: 'Reviews & Feedback' },
  { to: '/settings', icon: Settings, label: 'Store Settings' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const sidebarContent = (
    <>
      {/* Brand Header with Teabhatti Logo */}
      <div className="p-6 border-b border-border-subtle">
        <div className="flex items-center gap-3">
          <img 
            src="/teabhatti-logo.png" 
            alt="Tea Bhatti" 
            className="w-11 h-11 rounded-2xl object-contain shadow-sm border border-border-subtle bg-white p-1"
          />
          <div>
            <h1 className="text-base font-heading font-black text-text-primary tracking-tight">
              Tea Bhatti
            </h1>
            <p className="text-[11px] text-primary font-bold uppercase tracking-wider">
              Owner Management
            </p>
          </div>
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all duration-200 ${
                isActive
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'text-text-secondary hover:bg-bg-subtle hover:text-text-primary'
              }`
            }
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-border-subtle bg-bg-base/30">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
            <span className="text-sm font-black text-primary">
              {user?.name?.charAt(0) || 'O'}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-text-primary truncate">{user?.name || 'Owner'}</p>
            <p className="text-[10px] text-text-secondary capitalize font-medium">{user?.role || 'Admin'}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-xl text-xs font-bold
                   text-error hover:bg-error/10 transition-colors border border-error/20"
        >
          <LogOut className="w-3.5 h-3.5" />
          Logout
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Responsive Mobile Top App Bar */}
      <header className="md:hidden sticky top-0 z-30 bg-bg-surface/95 backdrop-blur-md border-b border-border-subtle px-4 py-2.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 -ml-1 text-text-primary hover:bg-bg-subtle active:scale-95 rounded-xl border border-border-subtle focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer transition-all"
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <img 
              src="/teabhatti-logo.png" 
              alt="Tea Bhatti" 
              className="w-7 h-7 rounded-lg object-contain bg-white p-0.5 border border-border-subtle shadow-2xs" 
            />
            <div>
              <span className="font-heading font-black text-sm text-text-primary tracking-tight block leading-tight">
                Tea Bhatti
              </span>
              <span className="text-[10px] text-primary font-bold uppercase tracking-wider block leading-none">
                Cafe Management
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 shadow-2xs">
            <span className="text-xs font-black text-primary">
              {user?.name?.charAt(0) || 'O'}
            </span>
          </div>
        </div>
      </header>

      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 md:hidden animate-fade-in" 
          onClick={() => setMobileOpen(false)} 
        />
      )}

      {/* Sidebar Navigation Drawer */}
      <aside className={`fixed top-0 left-0 bottom-0 w-64 bg-bg-surface border-r border-border-subtle
                        flex flex-col z-50 transition-transform duration-200 ease-out shadow-2xl md:shadow-none
                        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        {sidebarContent}
      </aside>
    </>
  );
}
