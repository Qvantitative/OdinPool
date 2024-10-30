/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      animation: {
        'pulse-color': 'pulseColor 2s infinite',
        'scale-in': 'scale-in 0.5s ease-out',
        'pop-in': 'pop-in 0.5s ease-out forwards',
        'fade-in': 'fade-in 0.3s ease-out',
        'orbit': 'orbit 20s linear infinite',
      },
      keyframes: {
        pulseColor: {
          '0%, 100%': { backgroundColor: '#9a3412' },
          '50%': { backgroundColor: '#f97316' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0)' },
          '100%': { transform: 'scale(1)' }
        },
        'pop-in': {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '80%': { transform: 'scale(1.1)', opacity: '0.8' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        'orbit': {
          '0%': { transform: 'rotate(0deg) translateX(10px) rotate(0deg)' },
          '100%': { transform: 'rotate(360deg) translateX(10px) rotate(-360deg)' }
        }
      },
      // Add some useful colors for the bubble map
      colors: {
        'bubble': {
          'bg': '#13111C',
          'overlay': 'rgba(0, 0, 0, 0.8)',
          'line': 'rgba(255, 255, 255, 0.1)',
        }
      },
      transitionProperty: {
        'bubble': 'transform, opacity, stroke-width',
      },
      transitionDuration: {
        '2000': '2000ms',
      },
      transitionTimingFunction: {
        'bounce-gentle': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      }
    },
  },
  plugins: [],
};