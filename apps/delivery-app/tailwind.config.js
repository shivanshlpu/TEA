/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'bg-base': '#FFF8F0',
        'bg-surface': '#FFFFFF',
        'bg-subtle': '#FDECD8',
        primary: {
          DEFAULT: '#E4572E',
          hover: '#C8451F',
        },
        secondary: {
          DEFAULT: '#F4A300',
        },
        accent: {
          DEFAULT: '#E76F51',
        },
        'text-primary': '#3A2618',
        'text-secondary': '#7A5C4B',
        success: '#6A9955',
        warning: '#F4A300',
        error: '#D64550',
        info: '#457B9D',
        'border-subtle': '#F0DCC4',
      },
      fontFamily: {
        heading: ['"Fraunces"', 'Georgia', 'serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 2px 12px rgba(228, 87, 46, 0.08)',
        'card-hover': '0 8px 24px rgba(228, 87, 46, 0.14)',
        'elevated': '0 12px 40px rgba(228, 87, 46, 0.12)',
      },
      borderRadius: {
        'card': '16px',
        'badge': '20px',
        'button': '12px',
      },
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
