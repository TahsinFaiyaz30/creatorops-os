"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Timeline } from "@/components/ui/timeline";
import { AnimatedTestimonials } from "@/components/ui/animated-testimonials";
import WorldMap from "@/components/ui/world-map";
import { LampContainer } from "@/components/ui/lamp";
import { TextHoverEffect } from "@/components/ui/text-hover-effect";
import { EvervaultCard } from "@/components/ui/evervault-card";
import { Button as MovingBorderButton } from "@/components/ui/moving-border";

/* ───────────────── 4. Workflow timeline ───────────────── */

function Step({ points, tint }: { points: string[]; tint: string }) {
  return (
    <div>
      <ul className="space-y-2">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2 text-sm text-[var(--text-2)]">
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: tint }}
            />
            {p}
          </li>
        ))}
      </ul>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <motion.div
            key={i}
            className="h-20 rounded-lg border border-[var(--border)]"
            style={{
              background: `linear-gradient(135deg, ${tint}33, transparent)`,
            }}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: i * 0.12 }}
          />
        ))}
      </div>
    </div>
  );
}

const TIMELINE = [
  {
    title: "Idea",
    content: (
      <Step
        tint="#6344F5"
        points={[
          "Drop a raw thought, a link, or a long-form transcript.",
          "Scripting workspace shapes it into a usable brief.",
        ]}
      />
    ),
  },
  {
    title: "Repurpose",
    content: (
      <Step
        tint="#AE48FF"
        points={[
          "AI generates platform-native variants, not clones.",
          "Tone, length, and format tuned per network.",
        ]}
      />
    ),
  },
  {
    title: "Review",
    content: (
      <Step
        tint="#0ea5e9"
        points={[
          "Role-based routing sends work to the right approver.",
          "Comments and revisions stay attached to the asset.",
        ]}
      />
    ),
  },
  {
    title: "Publish",
    content: (
      <Step
        tint="#10b981"
        points={[
          "Real OAuth connections to live platforms.",
          "Pre-flight validation catches failures before they ship.",
        ]}
      />
    ),
  },
  {
    title: "Measure",
    content: (
      <Step
        tint="#f59e0b"
        points={[
          "Performance flows back into the same workspace.",
          "The next campaign starts already informed.",
        ]}
      />
    ),
  },
];

export function WorkflowTimeline() {
  return (
    <section id="workflow" className="relative bg-[var(--bg)]">
      <Timeline
        data={TIMELINE}
        heading="One idea, five stages, zero handoff gaps"
        description="The whole pipeline lives in one workspace — each stage hands off to the next without an export, a re-upload, or a status meeting."
      />
    </section>
  );
}

/* ───────────────── 5. Testimonials ───────────────── */

const TESTIMONIALS = [
  {
    quote:
      "One raw idea became twelve platform-ready posts before my coffee went cold. The repurposing engine is the whole product for me.",
    name: "Independent creator",
    designation: "Placeholder — replace with a real quote",
    src: "/avatars/creator.svg",
  },
  {
    quote:
      "Review routing replaced a spreadsheet, three group chats, and a shared drive we all pretended to keep tidy.",
    name: "Brand representative",
    designation: "Placeholder — replace with a real quote",
    src: "/avatars/brand.svg",
  },
  {
    quote:
      "Publishing used to be five tabs and a prayer. Now it validates before it ships and tells me exactly what broke.",
    name: "Content operations",
    designation: "Placeholder — replace with a real quote",
    src: "/avatars/ops.svg",
  },
  {
    quote:
      "The live event feed means nobody asks me for a status update anymore. They just look.",
    name: "Creator admin",
    designation: "Placeholder — replace with a real quote",
    src: "/avatars/admin.svg",
  },
];

export function Voices() {
  return (
    <section id="voices" className="relative overflow-hidden bg-[var(--bg)] py-20">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <span className="mb-2 inline-block rounded-full border border-[var(--border)] bg-[var(--surface2)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Voices
        </span>
      </div>
      <AnimatedTestimonials testimonials={TESTIMONIALS} autoplay />
    </section>
  );
}

/* ───────────────── 6. Global reach ───────────────── */

/*
 * Routes fan out from one origin instead of being unrelated city pairs. The old
 * set included Sydney→Tokyo and SF→Berlin, which implied traffic that has
 * nothing to do with this workspace and made the map read as decoration.
 *
 * Dhaka is the hub (weight 6, so it renders larger); every arc is a real
 * publish destination region. Each leg is a distinct great-circle direction, so
 * arcs separate cleanly rather than stacking on top of one another.
 */
const ORIGIN = { lat: 23.8103, lng: 90.4125, label: "Dhaka" };

const DESTINATIONS = [
  { lat: 1.3521,   lng: 103.8198, label: "Singapore" },
  { lat: 35.6762,  lng: 139.6503, label: "Tokyo" },
  { lat: 51.5074,  lng: -0.1278,  label: "London" },
  { lat: 40.7128,  lng: -74.006,  label: "New York" },
  { lat: 37.7749,  lng: -122.4194, label: "San Francisco" },
  { lat: -33.8688, lng: 151.2093, label: "Sydney" },
];

const ROUTES = DESTINATIONS.map(end => ({ start: ORIGIN, end }));

export function GlobalReach() {
  return (
    <section id="reach" className="relative overflow-hidden bg-[var(--bg)] py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <span className="mb-4 inline-block rounded-full border border-[var(--border)] bg-[var(--surface2)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Reach
          </span>
          <h2 className="mx-auto max-w-3xl text-balance text-3xl font-bold tracking-tight text-[var(--text)] sm:text-5xl">
            Publish from anywhere, to everywhere
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-[var(--muted)]">
            Platform connections are real OAuth, not mocks — the same pipeline
            whether your audience is one timezone away or twelve.
          </p>
        </div>

        <div className="mt-12">
          <WorldMap
            dots={ROUTES}
            lineColor="#AE48FF"
            showLabels
            animatePackets
            cycleSeconds={9}
          />
        </div>

        {/* Encrypted-feel security card */}
        <div className="mt-16 grid grid-cols-1 items-center gap-8 md:grid-cols-2">
          <div className="mx-auto w-full max-w-sm">
            <EvervaultCard text="secure" className="h-full" />
          </div>
          <div>
            <h3 className="text-2xl font-bold tracking-tight text-[var(--text)]">
              Tokens stay server-side
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
              OAuth credentials are exchanged and stored on the server, scoped per
              account, and never handed to the browser. Sessions normalise roles on
              every read so a stale token can&apos;t widen its own permissions.
            </p>
            <Link
              href="/architecture"
              className="mt-6 inline-block text-sm font-semibold text-[var(--accent)] hover:underline"
            >
              Read the architecture →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────── 7. Lamp CTA ───────────────── */

export function LampCta() {
  return (
    <section className="relative bg-[var(--bg)]">
      <LampContainer className="bg-[var(--bg)]">
        <motion.h2
          initial={{ opacity: 0.5, y: 100 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.8, ease: "easeInOut" }}
          className="bg-gradient-to-br from-white to-neutral-500 bg-clip-text py-4 text-center text-4xl font-bold tracking-tight text-transparent md:text-6xl"
        >
          Ship your next campaign
          <br />
          without the tab graveyard
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.55, duration: 0.7 }}
          className="mt-4 flex flex-col items-center gap-4 sm:flex-row"
        >
          <MovingBorderButton
            as={Link}
            href="/signup"
            borderRadius="1.75rem"
            containerClassName="h-12 w-44"
            className="border-[var(--border)] bg-[var(--surface)] text-sm font-semibold text-[var(--text)]"
          >
            Create account
          </MovingBorderButton>

          <Link
            href="/login"
            className="focus-ring rounded-full border border-[var(--border)] bg-[var(--surface2)] px-7 py-3 text-sm font-semibold text-[var(--text-2)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface3)]"
          >
            Sign in
          </Link>
        </motion.div>
      </LampContainer>
    </section>
  );
}

/* ───────────────── 8. Footer ───────────────── */

const FOOTER_LINKS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Campaigns", href: "/campaigns" },
  { label: "Compose", href: "/compose" },
  { label: "Analytics", href: "/analytics" },
  { label: "Architecture", href: "/architecture" },
];

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-[var(--border)] bg-[var(--bg)] pt-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {FOOTER_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--muted)] transition-colors hover:text-[var(--text-2)]"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)]"
            >
              Sign in
            </Link>
            <span className="text-[var(--text)]/15">·</span>
            <Link
              href="/signup"
              className="text-xs font-semibold text-[var(--accent)] hover:text-[var(--text)]"
            >
              Get started
            </Link>
          </div>
        </div>

        {/* Giant interactive wordmark */}
        <div className="h-40 w-full select-none md:h-56">
          <TextHoverEffect text="CREATOROPS" />
        </div>

        <p className="pb-8 text-center text-[11px] text-[var(--muted)]">
          CreatorOps OS · UIU Developers HUB Hackathon 2026
        </p>
      </div>
    </footer>
  );
}
