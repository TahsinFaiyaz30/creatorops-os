'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * AuthSplitShell — signup only.
 *
 * One floating panel on the existing night-sky background, split into a form
 * column and a product-surface column. Sign-in keeps the original two-column
 * page (see auth-shell.jsx); this shell is deliberately separate so changing
 * one screen can never disturb the other.
 *
 *   left   — brand pill, centred heading, the form, footer links
 *   right  — a live-looking product surface: status card, workflow feed,
 *            schedule strip, publishing card, drifting creator avatars
 *
 * Motion notes:
 *   · Floats are `y`-only transforms on infinite reverse loops with staggered
 *     durations, so nothing ever syncs up into a visible pulse.
 *   · The panel tilts to the cursor and carries a tracked glare.
 *   · Every loop is gated on useReducedMotion.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import Link from 'next/link';
import { useRef, useState } from 'react';
import {
  motion, cubicBezier, useMotionTemplate, useMotionValue, useSpring, useReducedMotion
} from 'motion/react';
import { IconCheck } from '@tabler/icons-react';

import { AuroraBackground } from '@/components/ui/aurora-background';
import { StarsBackground } from '@/components/ui/stars-background';
import { ShootingStars } from '@/components/ui/shooting-stars';
import { Spotlight } from '@/components/ui/spotlight-new';
import { cn } from '@/lib/utils';

const easeOutExpo = cubicBezier(0.16, 1, 0.3, 1);

const DAYS = [
  { d: 'Sun', n: 22 }, { d: 'Mon', n: 23 }, { d: 'Tue', n: 24 }, { d: 'Wed', n: 25 },
  { d: 'Thu', n: 26 }, { d: 'Fri', n: 27 }, { d: 'Sat', n: 28 }
];

const AVATARS = ['/avatars/creator.svg', '/avatars/brand.svg', '/avatars/ops.svg', '/avatars/admin.svg'];

const PILLARS = [
  'AI multi-platform generation',
  'Creator review with real RBAC',
  'Live OAuth connections',
  'Pre-flight publish validation'
];

/* Reads as a real event stream rather than filler — these are the actual stages
   a post moves through in the app. */
const FEED = [
  { label: 'Variant approved · Instagram', at: '2m', tone: 'bg-success' },
  { label: 'Media verified · SHA-256', at: '4m', tone: 'bg-[var(--accent)]' },
  { label: 'Scheduled · YouTube Shorts', at: '11m', tone: 'bg-info' },
  { label: 'Token refreshed · LinkedIn', at: '26m', tone: 'bg-warning' },
  { label: 'Published · 3 platforms', at: '1h', tone: 'bg-success' },
  { label: 'Comment synced · 41 new', at: '2h', tone: 'bg-info' },
  { label: 'Campaign created · Autumn', at: '3h', tone: 'bg-[var(--accent)]' }
];

const stage = {
  hidden: {},
  visible: { transition: { delayChildren: 0.25, staggerChildren: 0.07 } }
};

const feedVariants = {
  hidden: {},
  visible: { transition: { delayChildren: 0.85, staggerChildren: 0.09 } }
};

const feedItem = {
  hidden: { opacity: 0, x: 18 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: easeOutExpo } }
};

const rise = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: easeOutExpo } }
};

/* Continuous drift. Durations are deliberately co-prime-ish so the cards never
   fall into step with each other. */
function Float({ children, amplitude = 8, duration = 5, delay = 0, className }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      animate={reduce ? undefined : { y: [-amplitude, amplitude] }}
      transition={
        reduce
          ? undefined
          : { duration, delay, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }
      }
    >
      {children}
    </motion.div>
  );
}

/* ── Right side: the product surface ──────────────────────────────────────── */

function ShowcasePanel() {
  const reduce = useReducedMotion();

  return (
    <motion.div
      variants={rise}
      className="relative hidden h-full overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--surface2)] lg:block"
    >
      {/* Depth wash — stands in for the reference's photo without shipping stock art. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(120%_90%_at_20%_0%,rgb(var(--accent-rgb)/0.30),transparent_60%),radial-gradient(90%_80%_at_100%_100%,rgba(174,72,255,0.22),transparent_65%)]"
      />
      <div aria-hidden className="absolute inset-0 bg-blueprint opacity-[0.35]" />
      {!reduce ? (
        <motion.div
          aria-hidden
          className="absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent"
          animate={{ x: ['-20%', '460%'] }}
          transition={{ duration: 7, repeat: Infinity, repeatDelay: 2.5, ease: 'easeInOut' }}
        />
      ) : null}

      <div className="relative flex h-full flex-col gap-3 p-5">
        {/* Top status card */}
        <Float amplitude={7} duration={5.2}>
          <motion.div
            initial={{ opacity: 0, y: -18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: easeOutExpo, delay: 0.35 }}
            className="w-fit rounded-2xl bg-[var(--accent)] px-4 py-3 text-[var(--accent-fg)] shadow-[0_18px_40px_-18px_var(--glow)]"
          >
            <p className="flex items-center gap-2 text-[13px] font-semibold">
              Creator review requested
              <span className="relative flex h-1.5 w-1.5">
                {!reduce ? (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent-fg)] opacity-60" />
                ) : null}
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--accent-fg)]" />
              </span>
            </p>
            <p className="mt-0.5 text-[11px] opacity-70">3 variants · 2 platforms</p>
          </motion.div>
        </Float>

        {/* Avatar stack, drifting on its own clock */}
        <Float amplitude={10} duration={6.4} delay={0.4} className="absolute right-6 top-6">
          <div className="flex flex-col gap-2">
            {AVATARS.slice(0, 3).map((src, i) => (
              <motion.span
                key={src}
                initial={{ opacity: 0, scale: 0.6, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                transition={{ duration: 0.55, ease: easeOutExpo, delay: 0.75 + i * 0.12 }}
                className="block h-11 w-11 overflow-hidden rounded-full border-2 border-[var(--surface)] bg-[var(--surface3)] shadow-lg"
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
              </motion.span>
            ))}
          </div>
        </Float>

        {/* Live workflow feed — `flex-1` so extra panel height turns into more
            visible rows instead of a dead band above the schedule strip. */}
        <motion.ul
          variants={feedVariants}
          initial="hidden"
          animate="visible"
          className="flex min-h-0 flex-1 flex-col justify-center gap-1.5"
        >
          {FEED.map(entry => (
            <motion.li
              key={entry.label}
              variants={feedItem}
              className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)]/55 px-3 py-2 backdrop-blur-md"
            >
              <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', entry.tone)} />
              <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[var(--text-2)]">
                {entry.label}
              </span>
              <span className="shrink-0 text-[10px] tabular-nums text-[var(--muted)]">
                {entry.at}
              </span>
            </motion.li>
          ))}
        </motion.ul>

        {/* Schedule strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: easeOutExpo, delay: 0.55 }}
          className="mx-auto flex gap-1.5"
        >
          {DAYS.map((day, i) => {
            const active = i === 3;
            return (
              <motion.div
                key={day.d}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: easeOutExpo, delay: 0.65 + i * 0.05 }}
                className={cn(
                  'flex w-11 flex-col items-center rounded-2xl px-1 py-2 text-center backdrop-blur-md transition-colors',
                  active
                    ? 'bg-[var(--surface)] text-[var(--text)] shadow-lg'
                    : 'bg-[var(--surface)]/35 text-[var(--text-2)]'
                )}
              >
                <span className="text-[9px] uppercase tracking-wider opacity-70">{day.d}</span>
                <span className="text-sm font-bold tabular-nums">{day.n}</span>
                {active ? (
                  <motion.span
                    layoutId="auth-day-dot"
                    className="mt-1 h-1 w-1 rounded-full bg-[var(--accent)]"
                  />
                ) : null}
              </motion.div>
            );
          })}
        </motion.div>

        {/* Bottom card with a live progress bar */}
        <Float amplitude={9} duration={5.8} delay={0.8}>
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: easeOutExpo, delay: 0.7 }}
            className="w-fit rounded-2xl border border-[var(--border)] bg-[var(--surface)]/85 px-4 py-3 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between gap-6">
              <p className="text-[13px] font-semibold text-[var(--text)]">Publishing now</p>
              <span className="text-[10px] text-[var(--muted)]">3 targets</span>
            </div>

            <div className="mt-2 h-1.5 w-52 overflow-hidden rounded-full bg-[var(--surface3)]">
              <motion.div
                className="h-full rounded-full bg-[var(--accent)]"
                initial={{ width: '8%' }}
                animate={reduce ? { width: '64%' } : { width: ['8%', '64%', '92%', '8%'] }}
                transition={
                  reduce ? { duration: 0.4 } : { duration: 9, repeat: Infinity, ease: 'easeInOut' }
                }
              />
            </div>

            <div className="mt-2.5 flex -space-x-2">
              {AVATARS.map(src => (
                <span
                  key={src}
                  className="h-6 w-6 overflow-hidden rounded-full border-2 border-[var(--surface)] bg-[var(--surface3)]"
                >
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </span>
              ))}
            </div>
          </motion.div>
        </Float>
      </div>
    </motion.div>
  );
}

/* ── The floating panel: 3D tilt + cursor-tracked glare ───────────────────── */

function Panel({ children }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const [hovering, setHovering] = useState(false);

  const glareX = useMotionValue(50);
  const glareY = useMotionValue(50);
  const rotateX = useSpring(useMotionValue(0), { stiffness: 200, damping: 24 });
  const rotateY = useSpring(useMotionValue(0), { stiffness: 200, damping: 24 });

  const glare = useMotionTemplate`radial-gradient(600px circle at ${glareX}% ${glareY}%, rgb(var(--accent-rgb) / 0.12), transparent 60%)`;

  const onMove = event => {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    glareX.set(px * 100);
    glareY.set(py * 100);
    /* Shallow on purpose — a form has to stay readable while it tilts. */
    rotateY.set((px - 0.5) * 4);
    rotateX.set((0.5 - py) * 4);
  };

  return (
    <div style={{ perspective: 1600 }} className="relative z-10 w-full max-w-6xl">
      <motion.div
        ref={ref}
        onMouseMove={onMove}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => { setHovering(false); rotateX.set(0); rotateY.set(0); }}
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.85, ease: easeOutExpo }}
        style={reduce ? undefined : { rotateX, rotateY, transformStyle: 'preserve-3d' }}
        className="relative overflow-hidden rounded-[36px] border border-[var(--border)] bg-[var(--surface)]/80 p-2 shadow-[0_50px_130px_-40px_rgba(0,0,0,0.9)] backdrop-blur-2xl sm:p-3"
      >
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{ background: glare }}
          animate={{ opacity: hovering && !reduce ? 1 : 0 }}
          transition={{ duration: 0.35 }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-16 top-0 z-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/70 to-transparent"
        />
        <div className="relative z-10 grid gap-3 lg:grid-cols-[1fr_1.05fr]">{children}</div>
      </motion.div>
    </div>
  );
}

/* ── Public shell ─────────────────────────────────────────────────────────── */

export function AuthSplitShell({ title, subtitle, children, footer }) {
  return (
    /* AuroraBackground renders a plain <div> with no `as` escape hatch, so the
       <main> landmark lives here — otherwise the document has none at all and
       there is nothing for a screen reader to skip to.
       `h-auto` overrides its hardcoded h-[100vh], which would otherwise clip the
       panel on short viewports instead of letting the page scroll. */
    <main>
      <AuroraBackground className="relative h-auto min-h-screen w-full items-center justify-center overflow-hidden bg-[var(--bg)] px-4 py-4 dark:bg-[var(--bg)]">
        <StarsBackground className="absolute inset-0 z-0" starDensity={0.00012} />
        <ShootingStars
          starColor="#AE48FF"
          trailColor="#6344F5"
          minDelay={1400}
          maxDelay={3600}
          className="absolute inset-0 z-0"
        />
        <Spotlight
          gradientFirst="radial-gradient(68.54% 68.72% at 55.02% 31.46%, hsla(268, 100%, 70%, 0.10) 0, hsla(268, 100%, 55%, 0.04) 50%, transparent 80%)"
          translateY={-300}
          duration={10}
        />

        <Panel>
          {/* Left: form column */}
          <motion.div
            variants={stage}
            initial="hidden"
            animate="visible"
            className="flex flex-col justify-between px-5 py-4 sm:px-7 sm:py-4"
          >
            <motion.div variants={rise}>
              <Link
                href="/"
                className="focus-ring inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface2)] px-3.5 py-1.5 transition-colors hover:border-[var(--accent-line)]"
              >
                <img src="/logo.jpeg" alt="" width={18} height={18} className="rounded-md" />
                <span className="text-xs font-semibold tracking-tight text-[var(--text)]">
                  CreatorOps&nbsp;OS
                </span>
              </Link>
            </motion.div>

            <div className="py-4">
              <motion.h1
                variants={rise}
                className="text-center text-2xl font-bold tracking-tight text-[var(--text)]"
              >
                {title}
              </motion.h1>
              <motion.p variants={rise} className="mt-1 text-center text-[13px] text-[var(--muted)]">
                {subtitle}
              </motion.p>

              <motion.div variants={rise} className="mt-4">
                {children}
              </motion.div>

              {footer ? <motion.div variants={rise}>{footer}</motion.div> : null}
            </div>

            <motion.ul variants={rise} className="flex flex-wrap gap-x-4 gap-y-1.5">
              {PILLARS.map(pillar => (
                <li key={pillar} className="flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
                  <IconCheck className="h-2.5 w-2.5 text-[var(--accent)]" />
                  {pillar}
                </li>
              ))}
            </motion.ul>
          </motion.div>

          {/* Right: product surface */}
          <motion.div variants={stage} initial="hidden" animate="visible" className="min-h-[420px] lg:min-h-0">
            <ShowcasePanel />
          </motion.div>
        </Panel>
      </AuroraBackground>
    </main>
  );
}
