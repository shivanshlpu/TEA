import React from 'react';

/**
 * Button — primary, secondary, outline, ghost variants.
 * All use warm palette, rounded-button, micro-animations on hover/active.
 */
const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  outline: 'btn-outline',
  ghost: `bg-transparent text-primary font-semibold py-3 px-6 rounded-button
          transition-all duration-200 ease-in-out
          hover:bg-primary/10 active:scale-[0.98]
          focus:outline-none focus:ring-2 focus:ring-primary/20`,
  danger: `bg-error text-white font-semibold py-3 px-6 rounded-button
           transition-all duration-200 ease-in-out
           hover:brightness-110 hover:shadow-card-hover
           active:scale-[0.98]
           focus:outline-none focus:ring-2 focus:ring-error/30`,
};

const SIZES = {
  sm: 'text-sm py-2 px-4',
  md: 'text-base py-3 px-6',
  lg: 'text-lg py-4 px-8',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  className = '',
  ...props
}) {
  return (
    <button
      className={`
        ${VARIANTS[variant]}
        ${SIZES[size]}
        ${fullWidth ? 'w-full' : ''}
        ${disabled || loading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
        inline-flex items-center justify-center gap-2
        font-body
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
