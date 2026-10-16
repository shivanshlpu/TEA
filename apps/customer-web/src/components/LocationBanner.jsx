// ── Store Pickup Banner Component ──
import React from 'react';
import { Store, MapPin, Clock } from 'lucide-react';

export default function LocationBanner() {
  return (
    <div className="bg-gradient-to-r from-amber-700 via-primary to-amber-800 text-white py-2 px-4 text-xs font-semibold text-center flex flex-wrap items-center justify-center gap-2.5 shadow-sm">
      <div className="flex items-center gap-1.5 font-bold">
        <Store className="w-3.5 h-3.5 text-amber-200" />
        <span>Tea Bhatti Cafe Store Pickup</span>
      </div>
      <span className="hidden sm:inline text-white/50">•</span>
      <div className="flex items-center gap-1 text-white/90 font-medium">
        <MapPin className="w-3.5 h-3.5 text-amber-200" />
        <span>Near Medical College, Shahdol</span>
      </div>
      <span className="hidden sm:inline text-white/50">•</span>
      <div className="flex items-center gap-1 text-white/90">
        <Clock className="w-3.5 h-3.5 text-amber-200" />
        <span>Freshly prepared in ~15 mins</span>
      </div>
    </div>
  );
}
