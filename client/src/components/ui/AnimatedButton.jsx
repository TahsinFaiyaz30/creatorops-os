'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * AnimatedButton — the platform's master button.
 *
 * Every variant is one focusable element with a clipped decoration layer
 * underneath it. Two structural details are load-bearing:
 *
 *   · `overflow-hidden` lives on the decoration layer, never on the button.
 *     `.focus-ring` draws with box-shadow, and a box-shadow is clipped by
 *     overflow-hidden on the same element — putting it on the button would
 *     erase the keyboard focus ring.
 *
 *   · Motion components are built once at module scope. `motion(Tag)` called
 *     during render returns a new component type every render, so React
 *     unmounts and remounts the node, dropping focus and restarting animation.
 *
 * Everything animates on transform and opacity only, so the sheen and the press
 * stay on the compositor.
 *
 * Colours resolve through the app's theme tokens rather than literal
 * `white/[0.08]` values: `--border` already *is* rgba(255,255,255,0.10) in dark,
 * and flips to rgba(9,9,11,0.10) in light — so the frosted look is identical in
 * dark and stays visible in light instead of disappearing.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { motion, useReducedMotion } from 'motion/react';
import { Loader2 } from 'lucide-react';

import { cn } from '../../lib/utils';

/* Built once — see note above. */
const MOTION_TAGS = {
  button: motion.button,
  a: motion.a,
  div: motion.div,
  span: motion.span,
  label: motion.label
};

/*
 * `min-h` rather than `h`: single-line labels (nearly all of them) land on the
 * same baseline grid, but a button that does wrap grows instead of clipping.
 */
const SIZES = {
  xs: 'min-h-7 px-2 py-1 text-[11px] gap-1 rounded-lg',
  sm: 'min-h-8 px-2.5 py-1.5 text-xs gap-1.5 rounded-lg',
  md: 'min-h-9 px-3.5 py-2 text-sm gap-2 rounded-lg',
  lg: 'min-h-11 px-5 py-2.5 text-sm gap-2 rounded-xl',
  icon: 'min-h-8 w-8 px-0 py-0 text-xs rounded-lg'
};

const SPINNER_SIZE = {
  xs: 'h-3 w-3',
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-4 w-4',
  icon: 'h-3.5 w-3.5'
};

/*
 * Surface only. The animated border and glow are separate layers so a variant
 * can opt in or out of them without duplicating colour rules.
 */
const SURFACES = {
  primary: 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold',
  secondary:
    'border border-[var(--border)] bg-[var(--surface)]/60 text-[var(--text)] font-semibold backdrop-blur-md ' +
    'hover:border-[var(--border-strong)] hover:bg-[var(--surface2)]/70',
  ghost:
    'text-[var(--muted)] font-semibold hover:bg-[var(--surface2)] hover:text-[var(--text)]',
  danger:
    'border border-danger/30 bg-danger/10 text-danger font-semibold backdrop-blur-md ' +
    'hover:border-danger/50 hover:bg-danger/20',
  outline:
    'border border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)] font-semibold backdrop-blur-md ' +
    'hover:bg-[var(--accent)]/20'
};

/* Resting glow, deepened on hover. Kept off `ghost` so toolbars stay quiet. */
const GLOWS = {
  primary: 'shadow-[0_2px_20px_-6px_var(--glow)] hover:shadow-[0_4px_30px_-6px_var(--glow)]',
  secondary: 'hover:shadow-[0_2px_20px_-8px_var(--glow)]',
  ghost: '',
  danger: 'hover:shadow-[0_2px_20px_-8px_rgb(var(--danger-rgb)/0.35)]',
  outline: 'hover:shadow-[0_2px_20px_-8px_var(--glow)]'
};

const SHEEN_VARIANTS = new Set(['primary']);

export function AnimatedButton({
  as: Tag = 'button',
  variant = 'secondary',
  size = 'md',
  loading = false,
  shimmer,
  className,
  children,
  disabled,
  ...rest
}) {
  const reduce = useReducedMotion();
  const Comp = typeof Tag === 'string' ? MOTION_TAGS[Tag] ?? motion.button : Tag;

  const surface = SURFACES[variant] ?? SURFACES.secondary;
  const glow = GLOWS[variant] ?? '';
  const isInert = Boolean(disabled) || loading;
  /* Opt in explicitly, or automatically for primary. */
  const showSheen = (shimmer ?? SHEEN_VARIANTS.has(variant)) && !reduce && !isInert;

  const interaction = reduce || isInert
    ? {}
    : {
        whileHover: { scale: 1.02 },
        whileTap: { scale: 0.95 }
      };

  return (
    <Comp
      {...interaction}
      transition={{ type: 'spring', stiffness: 400, damping: 22, mass: 0.6 }}
      disabled={Tag === 'button' ? isInert : undefined}
      aria-busy={loading || undefined}
      data-loading={loading ? '' : undefined}
      className={cn(
        'focus-ring relative isolate inline-flex select-none items-center justify-center whitespace-nowrap',
        'tracking-tight transition-colors duration-200',
        'disabled:pointer-events-none disabled:opacity-50',
        SIZES[size] ?? SIZES.md,
        surface,
        glow,
        loading && 'cursor-progress',
        className
      )}
      {...rest}
    >
      {/* Decoration layer — clipped here so the focus ring on the button survives. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]"
      >
        {/* Animated top-edge highlight: reads as a lit 1px border seam. */}
        {variant === 'primary' ? (
          <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
        ) : null}

        {showSheen ? (
          <motion.span
            className="absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent"
            initial={{ x: '-60%' }}
            animate={{ x: '360%' }}
            transition={{
              duration: 2.4,
              ease: 'easeInOut',
              repeat: Infinity,
              repeatDelay: 1.6
            }}
          />
        ) : null}
      </span>

      {loading ? (
        <Loader2 className={cn('animate-spin', SPINNER_SIZE[size] ?? SPINNER_SIZE.md)} />
      ) : null}
      {children}
    </Comp>
  );
}

export default AnimatedButton;
