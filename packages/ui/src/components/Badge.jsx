import React from 'react';

/**
 * Badge — filled pill tag for "Best Seller", "Spicy 🌶️", "Chef's Special", etc.
 * Uses secondary/accent colors per Section 3.3.
 */
const VARIANTS = {
  bestseller: {
    bg: 'bg-secondary',
    text: 'text-text-primary',
    label: '⭐ Best Seller',
  },
  spicy: {
    bg: 'bg-accent',
    text: 'text-white',
    label: '🌶️ Spicy',
  },
  chef: {
    bg: 'bg-primary',
    text: 'text-white',
    label: '👨‍🍳 Chef\'s Special',
  },
  new: {
    bg: 'bg-success',
    text: 'text-white',
    label: '✨ New',
  },
  offer: {
    bg: 'bg-secondary',
    text: 'text-text-primary',
    label: '🎉 Offer',
  },
  custom: {
    bg: 'bg-bg-subtle',
    text: 'text-text-primary',
    label: '',
  },
};

export default function Badge({ variant = 'custom', label, className = '' }) {
  const config = VARIANTS[variant] || VARIANTS.custom;
  const displayLabel = label || config.label;

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-3 py-1
        rounded-badge text-xs font-semibold font-body
        ${config.bg} ${config.text}
        ${className}
      `}
    >
      {displayLabel}
    </span>
  );
}
