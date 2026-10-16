// ── LazyImage ──
// High-performance image component with CDN-first loading,
// backend fallback, skeleton shimmer placeholder, and smooth fade-in.

import React, { useState } from 'react';
import { API_BASE } from '../lib/api.js';

export default function LazyImage({ src, alt, className = '', fallback = '🍽️', objectFit = 'object-cover' }) {
  const [loaded, setLoaded] = useState(false);
  const [useBackendFallback, setUseBackendFallback] = useState(false);
  const [error, setError] = useState(false);

  // Normalize image URL
  const backendBase = (API_BASE || '').replace(/\/api\/v1\/?$/, '');
  
  let currentSrc = src;
  if (useBackendFallback && src?.startsWith('/uploads/') && backendBase) {
    currentSrc = `${backendBase}${src}`;
  }

  const handleError = () => {
    // If loading relative /uploads failed, try backend URL once before showing emoji fallback
    if (!useBackendFallback && src?.startsWith('/uploads/') && backendBase) {
      setUseBackendFallback(true);
    } else {
      setError(true);
    }
  };

  if (!currentSrc || error) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-bg-subtle to-bg-base ${className}`}>
        <span className="text-4xl opacity-40 select-none">{fallback}</span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-bg-subtle/50 ${className}`}>
      {/* Shimmer placeholder — visible until image loads */}
      {!loaded && (
        <div className="absolute inset-0 skeleton-dark" />
      )}

      {/* Actual image — starts transparent, fades in on load */}
      <img
        src={currentSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={handleError}
        className={`w-full h-full ${objectFit} transition-opacity duration-300 ease-out ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}
