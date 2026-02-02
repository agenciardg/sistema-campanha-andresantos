/** @type {import('tailwindcss').Config} */
import plugin from 'tailwindcss/plugin';

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: {
          dark: '#0a0e13',
          light: '#ffffff',
        },
      },
    },
  },
  plugins: [
    plugin(function({ addVariant }) {
      // Add 'light' variant that applies when NOT in dark mode
      addVariant('light', ':not(.dark) &');
    }),
  ],
}
