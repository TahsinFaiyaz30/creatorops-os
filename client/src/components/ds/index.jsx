'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CreatorOps Design System
 *
 * The client previously had no component abstraction — the same card markup was
 * hand-written 70 times, page headers 20 different ways, and every input
 * repeated its own 9-class string. That made a coherent redesign impossible:
 * changing "how a card looks" meant editing 70 places.
 *
 * Everything here is token-driven (see globals.css), so light/dark is automatic,
 * and mobile-first responsive by default.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { motion, useReducedMotion } from 'motion/react';
import { cn } from '../../lib/utils';
import { GlareCard } from '../ui/glare-card';
import { AnimatedButton } from '../ui/AnimatedButton';

/* ── Motion presets ───────────────────────────────────────────────────────── */

export const EASE = [0.16, 1, 0.3, 1];

export function useStagger(step = 0.05) {
  const reduce = useReducedMotion();
  return {
    container: {
      hidden: {},
      visible: { transition: { staggerChildren: reduce ? 0 : step } }
    },
    item: {
      hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 12 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration: reduce ? 0.2 : 0.5, ease: EASE }
      }
    },
    reduce
  };
}

/* ── Surface: the one card primitive ──────────────────────────────────────── */

export function Surface({
  as: Tag = 'div',
  className,
  interactive = false,
  inset = false,
  pad = 'md',
  children,
  ...rest
}) {
  const pads = { none: '', sm: 'p-3', md: 'p-4 sm:p-5', lg: 'p-5 sm:p-6' };
  return (
    <Tag
      className={cn(
        'rounded-xl border border-[var(--border)]',
        inset ? 'bg-[var(--surface2)]' : 'bg-[var(--surface)]',
        interactive &&
          'transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface2)]',
        pads[pad],
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* ── Page scaffolding ─────────────────────────────────────────────────────── */

export function Page({ className, children }) {
  const { container } = useStagger();
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className={cn('mx-auto w-full max-w-[1600px] space-y-5 sm:space-y-6', className)}
    >
      {children}
    </motion.div>
  );
}

export function PageHeader({ eyebrow, title, description, actions, className }) {
  const { item } = useStagger();
  return (
    <motion.header
      variants={item}
      className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1.5 text-balance text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </motion.header>
  );
}

export function Section({ title, description, actions, children, className }) {
  const { item } = useStagger();
  return (
    <motion.section variants={item} className={cn('space-y-3', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-base font-semibold tracking-tight text-[var(--text)]">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-xs text-[var(--muted)]">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      )}
      {children}
    </motion.section>
  );
}

/* ── Button ───────────────────────────────────────────────────────────────── */

/*
 * One button engine for the whole app.
 *
 * `Button` keeps its existing API — variant / size / as / className — but the
 * surface, physics and shimmer now come from AnimatedButton. Routing through it
 * rather than swapping call sites means every existing <Button> upgrades at
 * once; the alternative was two competing button styles sitting side by side in
 * the same panels.
 */
export { AnimatedButton };

export function Button(props) {
  return <AnimatedButton {...props} />;
}

/* ── Form fields ──────────────────────────────────────────────────────────── */

const CONTROL =
  'focus-ring w-full rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--muted)] transition-colors focus:border-[var(--accent-line)]';

export function Field({ label, hint, error, htmlFor, children, className }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? (
        <label htmlFor={htmlFor} className="text-xs font-medium text-[var(--muted)]">
          {label}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-[var(--muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...rest }) {
  return <input className={cn(CONTROL, className)} {...rest} />;
}

export function Textarea({ className, ...rest }) {
  return <textarea className={cn(CONTROL, 'min-h-24 resize-y', className)} {...rest} />;
}

export function Select({ className, children, ...rest }) {
  return (
    <select className={cn(CONTROL, 'cursor-pointer', className)} {...rest}>
      {children}
    </select>
  );
}

/* ── Badge ────────────────────────────────────────────────────────────────── */

const TONES = {
  neutral: 'border-[var(--border)] bg-[var(--surface2)] text-[var(--muted)]',
  accent: 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]',
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  danger: 'border-danger/30 bg-danger/10 text-danger'
};

export function Badge({ tone = 'neutral', className, children, ...rest }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
        TONES[tone],
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

/* ── Metric tile ──────────────────────────────────────────────────────────── */

export function StatTile({ label, value, icon: Icon, tone = 'neutral', hint, className }) {
  const accentRing = {
    neutral: 'text-[var(--muted)]',
    accent: 'text-[var(--accent)]',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger'
  }[tone];

  return (
    <Surface interactive pad="md" className={cn('min-w-0', className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
          {label}
        </span>
        {Icon ? <Icon className={cn('h-4 w-4 shrink-0', accentRing)} /> : null}
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-[var(--text)] sm:text-3xl">
        {value}
      </div>
      {hint ? <p className="mt-1 truncate text-[11px] text-[var(--muted)]">{hint}</p> : null}
    </Surface>
  );
}

export function StatGrid({ className, children }) {
  const { item } = useStagger();
  return (
    <motion.div
      variants={item}
      className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-5', className)}
    >
      {children}
    </motion.div>
  );
}

/* ── Glare metric tiles ───────────────────────────────────────────────────────
 * The Dashboard's headline metric treatment, extracted so every page renders the
 * identical component instead of a copy. Gradient tint bleeding into the surface,
 * Aceternity GlareCard hover physics, 16/11 tile.
 * ─────────────────────────────────────────────────────────────────────────── */

/** Canonical tint ramp — index into this so colours stay consistent per page. */
export const GLARE_TINTS = [
  'from-[#6344F5]/40',
  'from-sky-500/40',
  'from-amber-500/40',
  'from-emerald-500/40',
  'from-rose-500/40'
];

export function GlareStat({ label, value, icon: Icon, tint = GLARE_TINTS[0], hint }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      whileHover={reduce ? undefined : { y: -3 }}
      transition={{ type: 'spring', stiffness: 400, damping: 26 }}
    >
      {/*
        16/7, not 16/11. At five across the taller ratio made every tile ~200px
        of mostly empty gradient with a label pinned to the top and a number to
        the bottom — the metric read as an afterthought in its own card.
      */}
      <GlareCard
        containerClassName="w-full [aspect-ratio:16/7]"
        className={cn('flex flex-col justify-between bg-gradient-to-br p-5', tint, 'to-[var(--surface)]')}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="truncate text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
            {label}
          </span>
          {Icon ? <Icon className="h-4 w-4 shrink-0 text-[var(--text)]/70" /> : null}
        </div>
        <div>
          <div className="text-4xl font-bold tabular-nums text-[var(--text)]">{value}</div>
          {hint ? <p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">{hint}</p> : null}
        </div>
      </GlareCard>
    </motion.div>
  );
}

export function GlareStatGrid({ className, children }) {
  const { item } = useStagger();
  return (
    <motion.div
      variants={item}
      className={cn(
        'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
        className
      )}
    >
      {children}
    </motion.div>
  );
}

/* ── Empty / loading states ───────────────────────────────────────────────── */

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <Surface
      pad="lg"
      className={cn('flex flex-col items-center justify-center gap-3 text-center', className)}
    >
      {Icon ? (
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface2)] text-[var(--muted)]">
          <Icon className="h-4 w-4" />
        </span>
      ) : null}
      <div>
        <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
        {description ? (
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-[var(--muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </Surface>
  );
}

export function Skeleton({ className }) {
  return (
    <div
      className={cn('animate-pulse rounded-lg bg-[var(--surface3)]', className)}
      aria-hidden
    />
  );
}

/* ── Notice ───────────────────────────────────────────────────────────────── */

export function Notice({ tone = 'neutral', className, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      className={cn(
        'rounded-lg border px-4 py-2.5 text-sm',
        TONES[tone],
        tone === 'neutral' && 'text-[var(--text)]',
        className
      )}
    >
      {children}
    </motion.div>
  );
}

/* ── Responsive data list — table on desktop, cards on mobile ─────────────── */

export function DataList({ columns, rows, empty, rowKey = (_, i) => i, className }) {
  if (!rows?.length) return empty ?? null;

  return (
    <div className={className}>
      {/* Desktop table */}
      <Surface pad="none" className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface2)]">
                {columns.map(c => (
                  <th
                    key={c.key}
                    className={cn(
                      'px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]',
                      c.align === 'right' && 'text-right'
                    )}
                  >
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={rowKey(row, i)}
                  className="border-b border-[var(--border)] last:border-0 transition-colors hover:bg-[var(--surface2)]"
                >
                  {columns.map(c => (
                    <td
                      key={c.key}
                      className={cn(
                        'px-4 py-3 text-[var(--text-2)]',
                        c.align === 'right' && 'text-right'
                      )}
                    >
                      {c.render ? c.render(row) : row[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Surface>

      {/* Mobile cards — tables do not work at 375px */}
      <div className="space-y-2 md:hidden">
        {rows.map((row, i) => (
          <Surface key={rowKey(row, i)} pad="sm" interactive>
            <dl className="space-y-1.5">
              {columns.map(c => (
                <div key={c.key} className="flex items-start justify-between gap-3">
                  <dt className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                    {c.header}
                  </dt>
                  <dd className="min-w-0 text-right text-xs text-[var(--text-2)]">
                    {c.render ? c.render(row) : row[c.key]}
                  </dd>
                </div>
              ))}
            </dl>
          </Surface>
        ))}
      </div>
    </div>
  );
}
