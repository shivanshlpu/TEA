import React from 'react';

/**
 * Card — warm-tinted shadow (not flat grey), rounded-card (16px), hover lift.
 * Per Section 3.3: subtle warm-toned shadow rgba(228, 87, 46, 0.08).
 */
export default function Card({
  children,
  className = '',
  hoverable = true,
  padding = true,
  onClick,
  ...props
}) {
  return (
    <div
      className={`
        bg-bg-surface rounded-card shadow-card
        ${padding ? 'p-5' : ''}
        ${hoverable ? 'transition-all duration-200 ease-in-out hover:shadow-card-hover hover:-translate-y-0.5' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
}
