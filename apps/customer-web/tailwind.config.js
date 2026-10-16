import sharedConfig from '@cafeos/ui/tailwind-config';

/** @type {import('tailwindcss').Config} */
export default {
  ...sharedConfig,
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
    '../../packages/ui/src/**/*.{js,jsx}',
  ],
};
