// ── Customer Profile Details Modal ──
// Shows full customer profile information: Name, Phone, Role/Status,
// Total Orders, Total Spent, Loyalty Points, Referral Code, and Store Pickup branch.

import React, { useState, useEffect } from 'react';
import { 
  User, 
  Phone, 
  Mail, 
  Award, 
  ShoppingBag, 
  IndianRupee, 
  Gift, 
  Calendar, 
  ShieldCheck, 
  X, 
  Store,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../lib/api.js';

export default function ProfileModal({ isOpen, onClose }) {
  const { user, token, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && token) {
      setLoading(true);
      api.getProfile(token)
        .then(data => setProfile(data))
        .catch(err => console.error('Fetch profile error:', err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, token]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-[#E9DFD0] overflow-hidden flex flex-col max-h-[90vh] overflow-y-auto"
      >
        {/* Header with gourmet parchment styling */}
        <div className="p-4 sm:p-5 bg-[#F8F3E9] border-b border-[#E9DFD0] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#E94B18] text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
              {(profile?.name || user?.name || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-heading font-black text-lg text-[#203B2C] leading-tight">
                  {profile?.name || user?.name || 'Customer'}
                </h3>
                {profile?.isPremium && (
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                    <Sparkles className="w-2.5 h-2.5 text-amber-600" /> VIP
                  </span>
                )}
              </div>
              <p className="text-xs text-[#746A60] font-medium flex items-center gap-1 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span className="capitalize">{profile?.role || user?.role || 'Customer'} Account</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/5 text-[#746A60] hover:text-[#203B2C] transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-xs bg-[#FFFDF9]">
          
          {loading ? (
            <div className="py-8 text-center text-[#746A60]">
              <div className="w-6 h-6 border-2 border-[#E94B18] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <span>Loading profile details...</span>
            </div>
          ) : (
            <>
              {/* Account Quick Stats Grid */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl bg-[#F8F3E9] border border-[#EAE0D1] text-center">
                  <ShoppingBag className="w-4 h-4 text-[#E94B18] mx-auto mb-1" />
                  <div className="text-[10px] text-[#746A60]">Total Orders</div>
                  <div className="font-black text-sm text-[#203B2C]">{profile?.totalOrders ?? 0}</div>
                </div>

                <div className="p-3 rounded-xl bg-[#F8F3E9] border border-[#EAE0D1] text-center">
                  <IndianRupee className="w-4 h-4 text-[#203B2C] mx-auto mb-1" />
                  <div className="text-[10px] text-[#746A60]">Total Spent</div>
                  <div className="font-black text-sm text-[#203B2C]">₹{profile?.totalSpent ?? 0}</div>
                </div>

                <div className="p-3 rounded-xl bg-[#F8F3E9] border border-[#EAE0D1] text-center">
                  <Award className="w-4 h-4 text-amber-600 mx-auto mb-1" />
                  <div className="text-[10px] text-[#746A60]">Reward Points</div>
                  <div className="font-black text-sm text-[#203B2C]">{profile?.loyaltyPoints ?? 0}</div>
                </div>
              </div>

              {/* Personal Information */}
              <div className="space-y-2.5 pt-2 border-t border-[#EFE5D8]">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-[#EFE5D8]">
                  <div className="flex items-center gap-2 text-[#746A60]">
                    <Phone className="w-4 h-4 text-[#E94B18]" />
                    <span>Phone Number</span>
                  </div>
                  <span className="font-bold text-[#203B2C]">{profile?.phone || user?.phone || 'N/A'}</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-[#EFE5D8]">
                  <div className="flex items-center gap-2 text-[#746A60]">
                    <Mail className="w-4 h-4 text-[#E94B18]" />
                    <span>Email Address</span>
                  </div>
                  <span className="font-bold text-[#203B2C]">{profile?.email || 'N/A'}</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-[#EFE5D8]">
                  <div className="flex items-center gap-2 text-[#746A60]">
                    <Store className="w-4 h-4 text-[#E94B18]" />
                    <span>Pickup Branch</span>
                  </div>
                  <span className="font-bold text-[#203B2C]">{profile?.businessName || 'Tea Bhatti Cafe, Shahdol'}</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-[#EFE5D8]">
                  <div className="flex items-center gap-2 text-[#746A60]">
                    <Gift className="w-4 h-4 text-[#E94B18]" />
                    <span>Referral Code</span>
                  </div>
                  <span className="font-mono font-bold text-[#E94B18] bg-[#E94B18]/10 px-2 py-0.5 rounded">
                    {profile?.referralCode || 'TB-VIP'}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 bg-[#203B2C] hover:bg-[#16291E] text-white font-bold rounded-xl transition-colors shadow-sm text-xs cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    logout();
                    onClose();
                  }}
                  className="py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl transition-colors text-xs border border-red-200 cursor-pointer"
                >
                  Log Out
                </button>
              </div>
            </>
          )}

        </div>
      </motion.div>
    </div>
  );
}
