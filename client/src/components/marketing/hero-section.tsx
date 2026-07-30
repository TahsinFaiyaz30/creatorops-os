"use client";

import Link from "next/link";
import { motion, cubicBezier, useReducedMotion, type Variants } from "motion/react";
import { ArrowRight, PlayCircle } from "lucide-react";

import { Spotlight } from "@/components/ui/spotlight-new";
import { BackgroundBeams } from "@/components/ui/background-beams";
import { StarsBackground } from "@/components/ui/stars-background";
import { ShootingStars } from "@/components/ui/shooting-stars";
import { LayoutTextFlip } from "@/components/ui/layout-text-flip";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import ColourfulText from "@/components/ui/colourful-text";
import {
  TextRevealCard,
  TextRevealCardDescription,
  TextRevealCardTitle,
} from "@/components/ui/text-reveal-card";

const easeOutExpo = cubicBezier(0.16, 1, 0.3, 1);

const CAPABILITIES = [
  "Campaign planning",
  "AI repurposing",
  "Creator review",
  "Publishing",
  "Analytics",
];

export default function HeroSection() {
  const reduceMotion = useReducedMotion();

  const stage: Variants = {
    hidden: {},
    visible: {
      transition: reduceMotion
        ? { staggerChildren: 0 }
        : { staggerChildren: 0.09, delayChildren: 0.2 },
    },
  };

  const rise: Variants = {
    hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 26, filter: "blur(10px)" },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: reduceMotion ? 0.3 : 0.95, ease: easeOutExpo },
    },
  };

  return (
    <section className="relative isolate flex min-h-[100svh] w-full flex-col items-center justify-center overflow-hidden bg-[var(--bg)] pt-28 pb-16 antialiased">
      {/* ── Ambient stack: stars → shooting stars → beams → spotlight ─── */}
      <StarsBackground className="absolute inset-0 -z-20" />
      <ShootingStars
        starColor="#AE48FF"
        trailColor="#6344F5"
        minSpeed={12}
        maxSpeed={26}
        minDelay={900}
        maxDelay={2600}
        className="absolute inset-0 -z-20"
      />
      <BackgroundBeams className="-z-10 opacity-50" />
      <Spotlight
        gradientFirst="radial-gradient(68.54% 68.72% at 55.02% 31.46%, hsla(268, 100%, 70%, 0.10) 0, hsla(268, 100%, 55%, 0.04) 50%, transparent 80%)"
        gradientSecond="radial-gradient(50% 50% at 50% 50%, hsla(268, 100%, 75%, 0.09) 0, hsla(268, 100%, 55%, 0.04) 80%, transparent 100%)"
        gradientThird="radial-gradient(50% 50% at 50% 50%, hsla(268, 100%, 75%, 0.06) 0, hsla(268, 100%, 45%, 0.03) 80%, transparent 100%)"
        translateY={-320}
        duration={9}
      />

      {/* Vignette + floor fade */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.88)_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-56 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)]/70 to-transparent"
      />

      {/* ── Content ──────────────────────────────────────────────────── */}
      <motion.div
        variants={stage}
        initial="hidden"
        animate="visible"
        className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center gap-8 px-6 text-center"
      >
        {/* Animated eyebrow — Aceternity hover-border-gradient */}
        <motion.div variants={rise}>
          <HoverBorderGradient
            as="div"
            containerClassName="rounded-full"
            className="flex items-center gap-2 bg-[var(--surface)] px-4 py-1.5 text-xs font-medium tracking-wide text-[var(--text-2)]"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#AE48FF] opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#AE48FF]" />
            </span>
            Creator workflow infrastructure
          </HoverBorderGradient>
        </motion.div>

        {/* Headline — LayoutTextFlip rotating noun */}
        <motion.div variants={rise} className="flex justify-center">
          <LayoutTextFlip
            text="One system for "
            words={["campaigns", "repurposing", "reviews", "publishing", "analytics"]}
            duration={2600}
          />
        </motion.div>

        {/* Sub-headline with ColourfulText accent */}
        <motion.h2
          variants={rise}
          className="max-w-3xl text-balance text-2xl font-bold leading-tight tracking-tight text-[var(--text)] sm:text-4xl"
        >
          Every campaign. Every creator.
          <br />
          Zero <ColourfulText text="context switching" />.
        </motion.h2>

        {/* Subcopy — word-by-word generate effect */}
        <motion.div variants={rise} className="max-w-2xl">
          <TextGenerateEffect
            words="Plan campaigns, repurpose with AI, route creator reviews, publish everywhere, and read the analytics — without stitching together six disconnected tools."
            className="font-normal"
            duration={0.6}
          />
        </motion.div>

        {/* CTAs */}
        <motion.div
          variants={rise}
          className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4"
        >
          <motion.div
            whileHover={reduceMotion ? undefined : { scale: 1.03 }}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
          >
            <Link
              href="/signup"
              className="focus-ring group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-[var(--accent)] px-7 py-3 text-sm font-semibold text-[var(--accent-fg)] shadow-[0_0_44px_-10px_var(--glow)] transition-shadow hover:shadow-[0_0_64px_-6px_var(--glow)]"
            >
              <motion.span
                aria-hidden
                className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-black/10 to-transparent"
                animate={reduceMotion ? undefined : { translateX: ["-100%", "200%"] }}
                transition={
                  reduceMotion
                    ? undefined
                    : { duration: 2.2, repeat: Infinity, repeatDelay: 3.5, ease: "easeInOut" }
                }
              />
              <span className="relative">Start free</span>
              <ArrowRight
                className="relative h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                aria-hidden
              />
            </Link>
          </motion.div>

          {/* Link wraps the gradient (as="div") instead of the gradient rendering
              a <button> around a <Link> — an anchor inside a button is invalid
              HTML and breaks keyboard semantics. */}
          <Link href="/login" className="focus-ring rounded-full">
            <HoverBorderGradient
              as="div"
              containerClassName="rounded-full"
              className="flex items-center gap-2 bg-[var(--surface)] px-7 py-3 text-sm font-semibold text-[var(--text-2)]"
            >
              <PlayCircle className="h-4 w-4" aria-hidden />
              See it live
            </HoverBorderGradient>
          </Link>
        </motion.div>

        {/* Interactive reveal card */}
        <motion.div variants={rise} className="w-full max-w-2xl">
          <TextRevealCard
            text="Six tools. Zero context."
            revealText="One OS. Full signal."
            className="mx-auto w-full border-[var(--border)] bg-[var(--surface)]/85 backdrop-blur-sm"
          >
            <TextRevealCardTitle>Hover to cut through the noise.</TextRevealCardTitle>
            <TextRevealCardDescription>
              Every surface your team touches, unified into a single operating layer.
            </TextRevealCardDescription>
          </TextRevealCard>
        </motion.div>

        {/* Capability rail */}
        <motion.ul variants={rise} className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          {CAPABILITIES.map((label) => (
            <li
              key={label}
              className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--muted)] transition-colors hover:text-[var(--muted)]"
            >
              {label}
            </li>
          ))}
        </motion.ul>
      </motion.div>
    </section>
  );
}
