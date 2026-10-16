import React from 'react';

/**
 * PriceTag — always bold, always prominent, never grey/muted.
 * Per Section 3.2: prices use --color-primary or --text-primary.
 */
export default function PriceTag({
  price,
  originalPrice,
  currency = '₹',
  size = 'md',
  className = '',
}) {
  const sizes = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
    xl: 'text-3xl',
  };

  const hasDiscount = originalPrice && originalPrice > price;

  return (
    <div className={`inline-flex items-baseline gap-2 ${className}`}>
      <span
        className={`font-bold text-text-primary font-body ${sizes[size]}`}
      >
        {currency}{price.toFixed(2)}
      </span>
      {hasDiscount && (
        <span className="text-text-secondary line-through text-sm font-body">
          {currency}{originalPrice.toFixed(2)}
        </span>
      )}
      {hasDiscount && (
        <span className="text-success text-xs font-semibold font-body">
          {Math.round(((originalPrice - price) / originalPrice) * 100)}% off
        </span>
      )}
    </div>
  );
}
