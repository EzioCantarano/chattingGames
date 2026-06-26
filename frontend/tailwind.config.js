/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        twitch: {
          purple: '#9146FF',
          dark: '#0e0e10',
          chatBg: 'rgba(24, 24, 27, 0.75)',
        }
      }
    },
  },
  plugins: [],
}