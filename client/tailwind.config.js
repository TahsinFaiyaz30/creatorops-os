/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0b0f14',
        panel: '#121821',
        line: '#253142',
        mint: '#22c55e',
        cyan: '#38bdf8',
        gold: '#f59e0b',
        rose: '#fb7185'
      },
      boxShadow: {
        soft: '0 18px 60px rgba(0, 0, 0, 0.25)'
      }
    }
  },
  plugins: []
};
