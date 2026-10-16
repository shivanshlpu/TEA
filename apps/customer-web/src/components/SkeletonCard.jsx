// ── SkeletonCard ──
// Shimmer loading placeholder that mirrors the exact MenuItemCard layout.
// Shows during data fetch so the transition from loading → loaded is seamless.

import React from 'react';

export default function SkeletonCard() {
  return (
    <div className="bg-bg-surface rounded-card shadow-card overflow-hidden">
      {/* Image placeholder */}
      <div className="h-48 skeleton-dark" />

      {/* Content area */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <div className="h-5 skeleton w-3/4" />
        {/* Description */}
        <div className="h-3.5 skeleton w-full" />
        <div className="h-3.5 skeleton w-2/3" />
        {/* Rating */}
        <div className="h-4 skeleton w-16" />
        {/* Price */}
        <div className="h-6 skeleton w-20 mt-1" />
        {/* Add to cart button */}
        <div className="flex items-center gap-3 pt-1">
          <div className="h-9 skeleton w-24 rounded-button" />
          <div className="h-9 skeleton flex-1 rounded-button" />
        </div>
      </div>
    </div>
  );
}
