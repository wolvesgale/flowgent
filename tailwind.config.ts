import type { Config } from 'tailwindcss';

const config = {
  content: [
    './src/**/*.{ts,tsx,js,jsx}',
    './components/**/*.{ts,tsx,js,jsx}',
    './app/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      borderRadius: {
        lg: '1rem',
        md: '0.75rem',
        sm: '0.5rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        xs: '0 1px 2px rgba(0, 0, 0, 0.06)',
        card: '0 8px 24px rgba(20, 24, 40, 0.06)',
        soft: '0 4px 14px rgba(20, 24, 40, 0.05)',
        inset: 'inset 0 1px 0 rgba(255, 255, 255, 0.6)',
      },
      colors: {
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f7f8fb',
        },
        line: {
          DEFAULT: '#e6e8f0',
          strong: '#d5d9e2',
        },
        brand: {
          DEFAULT: '#5668ff',
          50: '#eef4ff',
          100: '#e0eaff',
          500: '#5668ff',
          600: '#4153f4',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;

export default config;
