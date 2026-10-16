// ── LazyImage ──
// Image component with skeleton shimmer placeholder and smooth fade-in on load.
// Handles loading, error, and loaded states gracefully.

import React, { useState } from 'react';

export default function LazyImage({ src, alt, className = '', fallback = '🍽️', objectFit = 'object-cover' }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-bg-subtle to-bg-base ${className}`}>
        <span className="text-5xl opacity-50 select-none">{fallback}</span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Shimmer placeholder — visible until image loads */}
      {!loaded && (
        <div className="absolute inset-0 skeleton-dark" />
      )}

      {/* Actual image — starts transparent, fades in on load */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={`w-full h-full ${objectFit} transition-opacity duration-500 ease-out ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}
