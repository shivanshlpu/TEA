import React from 'react';

/**
 * VegIndicator — standard green square (veg) / red-brown triangle (non-veg) dot
 * per Indian food-app convention (Section 3.3). Do NOT invent a new symbol.
 */
export default function VegIndicator({ isVeg, size = 'md', showLabel = false, className = '' }) {
  const sizes = {
    sm: { box: 'w-4 h-4', dot: 'w-2 h-2' },
    md: { box: 'w-5 h-5', dot: 'w-2.5 h-2.5' },
    lg: { box: 'w-6 h-6', dot: 'w-3 h-3' },
  };

  const { box, dot } = sizes[size];
  const borderColor = isVeg ? 'border-success' : 'border-error';
  const dotColor = isVeg ? 'bg-success' : 'bg-error';

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <div
        className={`${box} border-2 ${borderColor} rounded-sm flex items-center justify-center`}
        title={isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
      >
        {isVeg ? (
          /* Green circle for veg */
          <div className={`${dot} ${dotColor} rounded-full`} />
        ) : (
          /* Red-brown triangle for non-veg */
          <div
            className={`w-0 h-0`}
            style={{
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderBottom: '8px solid #D64550',
            }}
          />
        )}
      </div>
      {showLabel && (
        <span className={`text-xs font-medium font-body ${isVeg ? 'text-success' : 'text-error'}`}>
          {isVeg ? 'Veg' : 'Non-Veg'}
        </span>
      )}
    </div>
  );
}
