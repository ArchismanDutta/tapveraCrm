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
        babyPink: '#ffe6f0',
        pinkAccent: '#ffb6c1',
        gradientPink: '#f19ad2',
        gradientViolet: '#ab4ee1',
        gradientDeepViolet: '#9743c8',
      },
      backdropBlur: {
        sm: '4px', // Enable blur small for backdrop-blur-sm usage
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
};
