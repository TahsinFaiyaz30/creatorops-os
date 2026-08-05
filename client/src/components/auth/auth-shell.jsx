'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * AuthShell — sign-in.
 *
 * Two-column page: aurora brand panel on the left, glass form card on the right.
 * Signup uses a different layout entirely (auth-split-shell.jsx) — kept separate
 * so a change to one screen can never disturb the other.
 *
 * Converted from .tsx to .jsx by hand: types stripped, no CLI, no codegen.
 *
 * Fixes carried here:
 *   · "creator teams" no longer wraps mid-phrase — whitespace-nowrap.
 *   · The headline is one solid colour. It previously ran through ColourfulText,
 *     which animated per-character hues and made the most important sentence on
 *     the page the least readable.
 *   · Pillars run off a staggerChildren container instead of six hand-tuned
 *     delays, so the cascade stays correct if the list changes length.
 *   · The form sits in a 3D tilt card with a cursor-tracked glare.
 *   · The hackathon line under the pillars is gone.
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
import { Meteors } from '@/components/ui/meteors';
import { Spotlight } from '@/components/ui/spotlight-new';
import { TextGenerateEffect } from '@/components/ui/text-generate-effect';
import { cn } from '@/lib/utils';

const easeOutExpo = cubicBezier(0.16, 1, 0.3, 1);

const PILLARS = [
  'AI-powered multi-platform content generation',
  'Creator review workflow with real RBAC',
  'Live OAuth platform connections',
  'Publishing pipeline with pre-flight validation',
  'Brand circulars & creator applications',
  'Real-time workflow event feed'
];

/* Parent/child pair — the list owns the rhythm, each item just plays its part. */
const listVariants = {
  hidden: {},
  visible: { transition: { delayChildren: 0.45, staggerChildren: 0.08 } }
};

const itemVariants = {
  hidden: { opacity: 0, x: -14 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: easeOutExpo } }
};

/* ── Left brand panel ─────────────────────────────────────────────────────── */

function BrandPanel() {
  return (
    // `dark:bg-[var(--bg)]` is required, not just `bg-[var(--bg)]`: AuroraBackground
    // ships `dark:bg-zinc-900`, and twMerge keeps a dark:-prefixed utility
    // alongside an unprefixed one — so zinc-900 won in dark mode and the panel
    // sat ~19 levels lighter than the form side, showing as a seam down the middle.
    <AuroraBackground className="relative hidden h-full w-full flex-col justify-between overflow-hidden bg-[var(--bg)] p-12 dark:bg-[var(--bg)] lg:flex">
      <StarsBackground className="absolute inset-0 z-0" starDensity={0.00012} />
      <ShootingStars
        starColor="#AE48FF"
        trailColor="#6344F5"
        minDelay={1400}
        maxDelay={3600}
        className="absolute inset-0 z-0"
      />

      {/* The aurora layer is masked toward the top-right and then hard-clipped by
          the panel's overflow-hidden, so its glow terminated in a straight edge
          right down the middle of the page. This fades the panel into the form
          side so the two halves meet with no seam. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-[5] w-64 bg-gradient-to-r from-transparent via-[var(--bg)]/50 to-[var(--bg)]"
      />

      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: easeOutExpo }}
        className="relative z-10 flex items-center gap-3"
      >
        <img src="/logo.jpeg" alt="CreatorOps OS" width={34} height={34} className="rounded-lg" />
        <span className="text-sm font-semibold tracking-tight text-[var(--text)]">
          CreatorOps&nbsp;OS
        </span>
      </motion.div>

      <div className="relative z-10">
        <motion.h2
          initial={{ opacity: 0, y: 24, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.9, ease: easeOutExpo, delay: 0.1 }}
          className="max-w-md text-3xl font-bold leading-snug tracking-tight text-[var(--text)]"
        >
          The operating system for{' '}
          <span className="whitespace-nowrap">creator teams</span>
        </motion.h2>

        <div className="mt-2 max-w-sm">
          <TextGenerateEffect
            words="One raw idea becomes platform-ready content, routed for review, published live, and measured — in a single workflow."
            className="font-normal"
            duration={0.5}
          />
        </div>

        <motion.ul
          variants={listVariants}
          initial="hidden"
          animate="visible"
          className="mt-8 space-y-3"
        >
          {PILLARS.map(pillar => (
            <motion.li
              key={pillar}
              variants={itemVariants}
              className="flex items-center gap-3 text-sm text-[var(--text-2)]"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#AE48FF]/20 text-[var(--accent)]">
                <IconCheck className="h-3 w-3" />
              </span>
              {pillar}
            </motion.li>
          ))}
        </motion.ul>
      </div>

      <div className="relative z-10">
        <Meteors number={14} />
      </div>
    </AuroraBackground>
  );
}

/* ── 3D glass card with cursor-tracked glare ──────────────────────────────── */

function GlassCard({ className, children }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const [hovering, setHovering] = useState(false);

  /* Pointer position drives both the tilt and the glare from one read. */
  const glareX = useMotionValue(50);
  const glareY = useMotionValue(50);
  const rotateX = useSpring(useMotionValue(0), { stiffness: 220, damping: 22 });
  const rotateY = useSpring(useMotionValue(0), { stiffness: 220, damping: 22 });

  const glare = useMotionTemplate`radial-gradient(420px circle at ${glareX}% ${glareY}%, rgb(var(--accent-rgb) / 0.16), transparent 60%)`;

  const onMove = event => {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    glareX.set(px * 100);
    glareY.set(py * 100);
    /* Deliberately shallow — a form has to stay readable while it tilts. */
    rotateY.set((px - 0.5) * 6);
    rotateX.set((0.5 - py) * 6);
  };

  const onLeave = () => {
    setHovering(false);
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <div style={{ perspective: 1200 }}>
      <motion.div
        ref={ref}
        onMouseMove={onMove}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={onLeave}
        style={reduce ? undefined : { rotateX, rotateY, transformStyle: 'preserve-3d' }}
        className={cn(
          'relative overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--surface)]/80 p-7',
          'shadow-[0_24px_80px_-24px_rgba(99,68,245,0.35)] backdrop-blur-xl',
          className
        )}
      >
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{ background: glare }}
          animate={{ opacity: hovering && !reduce ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        />
        {/* Animated border glow on hover */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 rounded-[28px] border border-[var(--accent)]/50"
          initial={false}
          animate={{ opacity: hovering && !reduce ? 1 : 0, boxShadow: hovering && !reduce ? '0 0 20px 2px rgba(174,72,255,0.15) inset, 0 0 20px 2px rgba(174,72,255,0.15)' : 'none' }}
          transition={{ duration: 0.4 }}
        />
        {/* Lit top seam — reads as a light source above the card. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-6 top-0 z-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/60 to-transparent"
        />
        <div className="relative z-10">{children}</div>
      </motion.div>
    </div>
  );
}

/* ── Public shell ─────────────────────────────────────────────────────────── */

export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <motion.main
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: easeOutExpo }}
      className="grid min-h-screen grid-cols-1 gap-0 border-none bg-[var(--bg)] lg:grid-cols-[46%_1fr]"
    >
      <BrandPanel />

      <div className="relative flex flex-col items-center justify-center overflow-hidden px-6 py-12 sm:px-10">
        <StarsBackground className="absolute inset-0 z-0" starDensity={0.00012} />
        <Spotlight
          gradientFirst="radial-gradient(68.54% 68.72% at 55.02% 31.46%, hsla(268, 100%, 70%, 0.08) 0, hsla(268, 100%, 55%, 0.03) 50%, transparent 80%)"
          translateY={-260}
          duration={10}
        />

        {/* Mobile logo */}
        <Link href="/" className="relative z-10 mb-8 flex items-center gap-2 lg:hidden">
          <img src="/logo.jpeg" alt="" width={28} height={28} className="rounded-md" />
          <span className="text-sm font-semibold text-[var(--text)]">CreatorOps&nbsp;OS</span>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 22, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, ease: easeOutExpo, delay: 0.15 }}
          className="relative z-10 w-full max-w-md"
        >
          <GlassCard>
            <h1 className="bg-gradient-to-br from-[var(--text)] to-[var(--accent)] bg-clip-text text-2xl font-bold tracking-tight text-transparent">{title}</h1>
            <p className="mt-1 text-[15px] text-[var(--muted)]">{subtitle}</p>
            {children}
          </GlassCard>
          {footer}
        </motion.div>
      </div>
    </motion.main>
  );
}

/* ── Field: pill at rest, softens to a rounded slab on focus ──────────────── */

/* Radius is animated, so it has to be a number motion can interpolate — a
   Tailwind class swap would jump between the two shapes instead of morphing. */
const RADIUS_REST = 999;
const RADIUS_FOCUS = 14;

export function Field({ id, label, hint, className, ...props }) {
  const [focused, setFocused] = useState(false);
  const radius = focused ? RADIUS_FOCUS : RADIUS_REST;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="px-1 text-xs font-medium text-[var(--text-2)]">
        {label}
      </label>

      {/* The ring is its own layer so the glow can animate without the input
          resizing — a border-width change would shift every field below it. */}
      <div className="relative">
        {/*
          The glow is a static style and only opacity + radius animate. Motion
          cannot interpolate a box-shadow whose colour is a CSS variable —
          handing it `rgb(var(--accent-rgb) / 0.55)` made it treat the whole
          animate object as non-animatable, so the ring never lit at all.
        */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -inset-px"
          style={{
            boxShadow:
              '0 0 0 1px rgb(var(--accent-rgb) / 0.55), 0 0 18px -2px rgb(var(--accent-rgb) / 0.45)'
          }}
          initial={false}
          animate={{ opacity: focused ? 1 : 0, borderRadius: radius }}
          transition={{ duration: 0.28, ease: easeOutExpo }}
        />
        <motion.input
          id={id}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          initial={false}
          animate={{ borderRadius: radius }}
          transition={{ duration: 0.28, ease: easeOutExpo }}
          className={cn(
            'relative w-full border border-[var(--border)] bg-[var(--surface2)] px-4 py-2.5 text-sm',
            'text-[var(--text)] placeholder-[var(--muted)] outline-none transition-colors',
            'focus:border-[var(--accent-line)]',
            className
          )}
          {...props}
        />
      </div>

      {hint ? <p className="px-1 text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}
