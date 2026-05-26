/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      colors: {
        /* ── dark mode surfaces ── */
        ink:   '#000000',
        panel: '#0a0a0a',
        line:  '#262626',
        /* ── accent palette ── */
        cyan:  '#38bdf8',
        mint:  '#ffffff',
        gold:  '#f59e0b',
        rose:  '#fb7185',
        /* ── semantic tokens (override via CSS vars in globals.css) ── */
        surface:  'var(--surface)',
        border:   'var(--border)',
        text:     'var(--text)',
        muted:    'var(--muted)',
        bg:       'var(--bg)',
      },
      boxShadow: {
        soft: '0 18px 60px rgba(0,0,0,0.25)',
        glow: '0 0 24px rgba(255,255,255,0.18)',
      },
      keyframes: {
        'slide-in-right': {
          '0%':   { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-in-left': {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'fade-in': {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%':   { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'spin-slow': {
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'slide-in-right': 'slide-in-right 0.22s cubic-bezier(0.4,0,0.2,1)',
        'slide-in-left':  'slide-in-left 0.22s cubic-bezier(0.4,0,0.2,1)',
        'fade-in':        'fade-in 0.2s ease-out',
        'scale-in':       'scale-in 0.15s ease-out',
        'spin-slow':      'spin-slow 1.4s linear infinite',
      },
    },
  },
  plugins: [],
};
