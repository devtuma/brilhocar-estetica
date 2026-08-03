/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0b0b0f',
        surface: '#151515',
        primary: '#e22',
        accent: '#D4AF37', // Gold for premium detailing
      }
    },
  },
  plugins: [],
}
