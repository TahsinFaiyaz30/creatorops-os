"use client";

import { motion, cubicBezier, useReducedMotion, type Variants } from "motion/react";

import { Spotlight } from "@/components/ui/spotlight-new";
import { BackgroundBeams } from "@/components/ui/background-beams";
import { StarsBackground } from "@/components/ui/stars-background";
import { ShootingStars } from "@/components/ui/shooting-stars";
import { LayoutTextFlip } from "@/components/ui/layout-text-flip";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import {
  TextRevealCard,
  TextRevealCardDescription,
  TextRevealCardTitle,
} from "@/components/ui/text-reveal-card";

const easeOutExpo = cubicBezier(0.16, 1, 0.3, 1);

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

        {/*
          Headline — LayoutTextFlip rotating noun.

          `items-center` and a real `gap`: the two halves are flex siblings, so
          the default `stretch` left the plain text sitting on its line box's
          top edge while the padded word box centred its own text, and the
          trailing space in "One system for " was collapsed away because
          whitespace at the end of a flex item never renders.
        */}
        <motion.div
          variants={rise}
          className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2"
        >
          <LayoutTextFlip
            text="One system for"
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
          Zero{' '}
          <span className="bg-gradient-to-r from-[var(--accent)] via-[#a78bfa] to-[#38bdf8] bg-clip-text text-transparent">
            context switching
          </span>
          .
        </motion.h2>

        {/* Subcopy — word-by-word generate effect */}
        <motion.div variants={rise} className="max-w-2xl">
          <TextGenerateEffect
            words="Plan campaigns, repurpose with AI, route creator reviews, publish everywhere, and read the analytics — without stitching together six disconnected tools."
            className="font-normal"
            duration={0.6}
          />
        </motion.div>

        {/* Interactive reveal card. The row of capability labels that used to sit
            under it was the same five words the sections below already say. */}
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
      </motion.div>
    </section>
  );
}
