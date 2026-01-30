/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'macos-dark': {
          'bg-1': '#1C1C1E',
          'bg-2': '#2C2C2E',
          'bg-3': '#3A3A3C',
          'border': '#3D3D3D',
          'text': '#FFFFFF',
          'text-secondary': '#EBEBEB',
          'text-tertiary': '#8E8E93',
        },
        'macos-light': {
          'bg-1': '#FFFFFF',
          'bg-2': '#F5F5F5',
          'bg-3': '#E5E5E5',
          'border': '#D1D1D6',
          'text': '#000000',
          'text-secondary': '#3C3C43',
          'text-tertiary': '#8E8E93',
        },
        'accent': '#0A84FF',
        'accent-hover': '#0077ED',
      },
      fontFamily: {
        'system': ['-apple-system', 'BlinkMacSystemFont', '"SF Pro"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '11': '11px',
        '13': '13px',
        '15': '15px',
      },
      spacing: {
        '52px': '52px',
        '220px': '220px',
      },
      animation: {
        'fade-in': 'fadeIn 150ms ease-out',
        'scale-in': 'scaleIn 200ms ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
