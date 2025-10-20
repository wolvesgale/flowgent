import type { Config } from 'tailwindcss';

const config = {
  content: [
    './src/**/*.{ts,tsx,js,jsx}',
    './components/**/*.{ts,tsx,js,jsx}',
    './app/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'var(--fg-primary)',
          600: 'var(--fg-primary-600)',
        },
      },
      boxShadow: {
        xs: '0 1px 2px rgba(0, 0, 0, 0.06)',
      },
    },
  },
  plugins: [],
} satisfies Config;

export default config;
