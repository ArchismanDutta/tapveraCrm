// tailwind.config.js
module.exports = {
 content: [
  './src/**/*.{js,jsx,ts,tsx}',
  './public/index.html',
],

  theme: {
    extend: {
      colors: {
        background: '#0F0F0F',
        surface: '#1A1A1A',
        border: '#2E2E2E',
        textMain: '#FFFFFF',
        textMuted: '#CCCCCC',
        primary: '#FF9900',
        secondary: '#FFC300',
        orangeDark: '#CC7A00',
        yellowSoft: '#FFD966',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
