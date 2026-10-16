// ── Footer — Tea Bhatti ──
// Matches exact reference design:
// Dark forest green (#203B2C) full-width footer
// Left: Tea Bhatti + "100% Pure Veg · Crafted Fresh Daily · Indore"
// Center: Home, Menu, My Orders, Cart links
// Right: Instagram, WhatsApp icons
// Bottom: Powered by CafeOS

import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, MessageCircle } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full bg-[#203B2C] text-[#FFFDF9] mt-16 pt-10 pb-8 border-t border-[#16291E]">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main Footer Row */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-white/10 text-center md:text-left">
          
          {/* Left: Brand & Tagline */}
          <div>
            <h2 className="text-xl font-heading font-black text-[#FFFDF9] tracking-tight">
              Tea Bhatti Cafe
            </h2>
            <p className="text-xs text-[#E9DFD0]/75 mt-1 font-sans">
              100% Pure Veg · Crafted Fresh Daily · Shahdol
            </p>
          </div>

          {/* Center: Quick Links */}
          <nav className="flex flex-wrap items-center justify-center gap-6 text-xs font-medium text-[#E9DFD0]">
            <Link to="/" className="hover:text-[#E94B18] transition-colors">
              Home
            </Link>
            <Link to="/menu" className="hover:text-[#E94B18] transition-colors">
              Menu
            </Link>
            <Link to="/orders" className="hover:text-[#E94B18] transition-colors">
              My Orders
            </Link>
            <Link to="/cart" className="hover:text-[#E94B18] transition-colors">
              Cart
            </Link>
          </nav>

          {/* Right: Social Links */}
          <div className="flex items-center gap-3">
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noreferrer"
              className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-[#E9DFD0] hover:text-white hover:border-white transition-colors"
              aria-label="Instagram"
            >
              <Instagram className="w-4 h-4" />
            </a>
            <a
              href="https://wa.me/919009149694"
              target="_blank"
              rel="noreferrer"
              className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-[#E9DFD0] hover:text-white hover:border-white transition-colors"
              aria-label="WhatsApp"
            >
              <MessageCircle className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Bottom Credits */}
        <div className="pt-6 text-center text-[11px] text-[#E9DFD0]/50 font-sans tracking-wide">
          Powered by CafeOS
        </div>
      </div>
    </footer>
  );
}
