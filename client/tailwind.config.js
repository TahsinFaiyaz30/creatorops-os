import colors from 'tailwindcss/colors';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      colors: {
        /* ── legacy fixed surfaces (unused by app code, kept for safety) ── */
        ink:   '#000000',
        panel: '#0a0a0a',
        line:  '#262626',

        /*
         * Accent palette — now theme-aware.
         *
         * `mint` was literally #ffffff, so its 110 `text-mint` usages rendered
         * white-on-white in light mode. Routing these through RGB-channel vars
         * gives the app a real accent colour AND keeps the ~170 opacity
         * modifiers (bg-mint/10, border-gold/30, …) working, which a plain
         * `var(--accent)` hex would silently break in Tailwind 3.
         */
        /*
         * `DEFAULT` + spread scale, not a bare string.
         *
         * Assigning `rose: 'rgb(...)'` REPLACES Tailwind's whole `rose` key, which
         * silently deleted the numeric scale — `from-rose-500/40` and the five
         * `cyan-400`/`cyan-500` utilities inside ui/lamp.tsx compiled to nothing.
         * DEFAULT keeps `text-mint` / `bg-gold/10` working while the spread keeps
         * `rose-500`, `cyan-400`, … alive.
         */
        mint: { DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)' },
        gold: { DEFAULT: 'rgb(var(--warning-rgb) / <alpha-value>)', ...colors.amber },
        rose: { DEFAULT: 'rgb(var(--danger-rgb) / <alpha-value>)', ...colors.rose },
        cyan: { DEFAULT: 'rgb(var(--info-rgb) / <alpha-value>)', ...colors.cyan },

        /* ── semantic surface tokens ── */
        surface:  'var(--surface)',
        surface2: 'var(--surface2)',
        surface3: 'var(--surface3)',
        border:   'var(--border)',
        text:     'var(--text)',
        muted:    'var(--muted)',
        bg:       'var(--bg)',
        accent:   'rgb(var(--accent-rgb) / <alpha-value>)',
        success:  'rgb(var(--success-rgb) / <alpha-value>)',
        warning:  'rgb(var(--warning-rgb) / <alpha-value>)',
        danger:   'rgb(var(--danger-rgb) / <alpha-value>)',
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
  plugins: [
    /*
     * Aceternity's `bg-grid-*` / `bg-dot-*` background utilities. These are not
     * part of Tailwind — Aceternity ships them as a config plugin — so classes
     * like `bg-grid-white/[0.02]` would otherwise compile to nothing.
     *
     * Written self-contained on purpose: the upstream snippet pulls in
     * `mini-svg-data-uri` plus a CJS-only `flattenColorPalette`, neither of
     * which imports cleanly into this ESM config. CSS gradients give the same
     * result with no new dependency.
     */
    function ({ matchUtilities, theme }) {
      const flatten = (colors, prefix = '') =>
        Object.entries(colors).reduce((acc, [key, value]) => {
          const name = prefix ? `${prefix}-${key}` : key;
          if (value && typeof value === 'object') return { ...acc, ...flatten(value, name) };
          return { ...acc, [name]: value };
        }, {});

      matchUtilities(
        {
          'bg-grid': value => ({
            backgroundImage: `linear-gradient(to right, ${value} 1px, transparent 1px), linear-gradient(to bottom, ${value} 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }),
          'bg-grid-small': value => ({
            backgroundImage: `linear-gradient(to right, ${value} 1px, transparent 1px), linear-gradient(to bottom, ${value} 1px, transparent 1px)`,
            backgroundSize: '16px 16px',
          }),
          'bg-dot': value => ({
            backgroundImage: `radial-gradient(${value} 1px, transparent 1px)`,
            backgroundSize: '16px 16px',
          }),
        },
        { values: flatten(theme('colors')), type: 'color' }
      );
    },
  ],
};
