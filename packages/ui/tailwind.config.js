/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{js,jsx}',
    // Each app that uses this config will add its own content paths
  ],
  darkMode: 'class', // Locked — no dark: classes will be used ANYWHERE
  theme: {
    extend: {
      /* ── Color Palette (Section 3.1 — appetite-first, warm only) ── */
      colors: {
        // Backgrounds — warm, creamy, never stark white
        'bg-base': '#FFF8F0',
        'bg-surface': '#FFFFFF',
        'bg-subtle': '#FDECD8',

        // Primary — chili/tomato red: the "hungry" trigger
        primary: {
          DEFAULT: '#E4572E',
          hover: '#C8451F',
        },

        // Secondary — turmeric/mustard: warmth + optimism
        secondary: {
          DEFAULT: '#F4A300',
        },

        // Accent — burnt terracotta
        accent: {
          DEFAULT: '#E76F51',
        },

        // Text — warm dark roast brown, NOT pure black
        'text-primary': '#3A2618',
        'text-secondary': '#7A5C4B',

        // Status colors
        success: '#6A9955',
        warning: '#F4A300',
        error: '#D64550',
        info: '#457B9D',

        // Borders/dividers
        'border-subtle': '#F0DCC4',
      },

      /* ── Typography ── */
      fontFamily: {
        heading: ['"Fraunces"', 'Georgia', 'serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },

      /* ── Shadows — warm-tinted, not flat grey ── */
      boxShadow: {
        'card': '0 2px 12px rgba(228, 87, 46, 0.08)',
        'card-hover': '0 8px 24px rgba(228, 87, 46, 0.14)',
        'elevated': '0 12px 40px rgba(228, 87, 46, 0.12)',
      },

      /* ── Border Radius — friendly, not corporate ── */
      borderRadius: {
        'card': '16px',
        'badge': '20px',
        'button': '12px',
      },

      /* ── Animations ── */
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-warm': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(228, 87, 46, 0.2)' },
          '50%': { boxShadow: '0 0 0 8px rgba(228, 87, 46, 0)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.4s ease-out',
        'pulse-warm': 'pulse-warm 2s infinite',
        'shimmer': 'shimmer 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
