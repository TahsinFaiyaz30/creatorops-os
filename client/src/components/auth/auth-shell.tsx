"use client";

import Link from "next/link";
import { motion, cubicBezier } from "motion/react";
import { IconCheck } from "@tabler/icons-react";

import { AuroraBackground } from "@/components/ui/aurora-background";
import { StarsBackground } from "@/components/ui/stars-background";
import { ShootingStars } from "@/components/ui/shooting-stars";
import { Meteors } from "@/components/ui/meteors";
import { Spotlight } from "@/components/ui/spotlight-new";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import ColourfulText from "@/components/ui/colourful-text";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const easeOutExpo = cubicBezier(0.16, 1, 0.3, 1);

const PILLARS = [
  "AI-powered multi-platform content generation",
  "Creator review workflow with real RBAC",
  "Live OAuth platform connections",
  "Publishing pipeline with pre-flight validation",
  "Brand circulars & creator applications",
  "Real-time workflow event feed",
];

/* ── Left brand panel: aurora + stars + meteors ───────────────────── */

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
        className="pointer-events-none absolute inset-y-0 right-0 z-[5] w-40 bg-gradient-to-r from-transparent to-[var(--bg)]"
      />

      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: easeOutExpo }}
        className="relative z-10 flex items-center gap-3"
      >
        <img
          src="/logo.jpeg"
          alt="CreatorOps OS"
          width={34}
          height={34}
          className="rounded-lg"
        />
        <span className="text-sm font-semibold tracking-tight text-[var(--text)]">
          CreatorOps&nbsp;OS
        </span>
      </motion.div>

      <div className="relative z-10">
        <motion.h2
          initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.9, ease: easeOutExpo, delay: 0.1 }}
          className="max-w-sm text-3xl font-bold leading-snug tracking-tight text-[var(--text)]"
        >
          The operating system for <ColourfulText text="creator teams" />
        </motion.h2>

        <div className="mt-2 max-w-sm">
          <TextGenerateEffect
            words="One raw idea becomes platform-ready content, routed for review, published live, and measured — in a single workflow."
            className="font-normal"
            duration={0.5}
          />
        </div>

        <ul className="mt-8 space-y-3">
          {PILLARS.map((p, i) => (
            <motion.li
              key={p}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.5 + i * 0.09, ease: easeOutExpo }}
              className="flex items-center gap-3 text-sm text-[var(--text-2)]"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#AE48FF]/20 text-[var(--accent)]">
                <IconCheck className="h-3 w-3" />
              </span>
              {p}
            </motion.li>
          ))}
        </ul>
      </div>

      <div className="relative z-10">
        <Meteors number={14} />
        <p className="text-xs text-[var(--muted)]">
          UIU Developers HUB Hackathon 2026
        </p>
      </div>
    </AuroraBackground>
  );
}

/* ── Public shell ─────────────────────────────────────────────────── */

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen grid-cols-1 bg-[var(--bg)] lg:grid-cols-[46%_1fr]">
      <BrandPanel />

      {/* Right: form side */}
      <div className="relative flex flex-col items-center justify-center overflow-hidden px-6 py-12 sm:px-10">
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
          initial={{ opacity: 0, y: 22, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.8, ease: easeOutExpo }}
          className="relative z-10 w-full max-w-md"
        >
          <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 p-7 shadow-[0_24px_80px_-24px_rgba(99,68,245,0.35)] backdrop-blur-sm">
            <h1 className="text-xl font-bold tracking-tight text-[var(--text)]">{title}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
            {children}
          </div>
          {footer}
        </motion.div>
      </div>
    </main>
  );
}

/* ── Field helper using Aceternity Label + Input ──────────────────── */

export function Field({
  id,
  label,
  hint,
  className,
  ...props
}: {
  id: string;
  label: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-[var(--muted)]">
        {label}
      </Label>
      <Input id={id} className={cn(className)} {...props} />
      {hint ? <p className="text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}
