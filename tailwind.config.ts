import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/app/**/*.{js,ts,jsx,tsx,mdx}', './src/components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fffe',
          100: '#d4faf8',
          200: '#AFEEEE',
          300: '#7de5e5',
          400: '#45d6d6',
          500: '#00CED1',
          600: '#00b3b5',
          700: '#009196',
          800: '#007275',
          900: '#005758',
        },
      },
      fontSize: {
        'title-lg': ['1.25rem', { lineHeight: '1.35', letterSpacing: '-0.015em', fontWeight: '600' }],
        'title': ['1.125rem', { lineHeight: '1.35', letterSpacing: '-0.01em', fontWeight: '600' }],
        'title-sm': ['1rem', { lineHeight: '1.4', letterSpacing: '-0.005em', fontWeight: '600' }],
        'body': ['0.9375rem', { lineHeight: '1.6' }],
        'body-sm': ['0.8125rem', { lineHeight: '1.55' }],
        'caption': ['0.75rem', { lineHeight: '1.5' }],
        'overline': ['0.6875rem', { lineHeight: '1.4', letterSpacing: '0.04em', fontWeight: '500' }],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        'card-hover': '0 4px 12px -2px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.04)',
      },
      borderRadius: {
        'card': '0.875rem',
      },
    },
  },
  plugins: [],
};

export default config;
