"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Timeline } from "@/components/ui/timeline";
import WorldMap from "@/components/ui/world-map";
import { TextHoverEffect } from "@/components/ui/text-hover-effect";
import { EvervaultCard } from "@/components/ui/evervault-card";

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
    <section id="reach" className="relative overflow-hidden bg-[var(--bg)] py-16">
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

        <div className="mt-10">
          <WorldMap
            dots={ROUTES}
            lineColor="#AE48FF"
            showLabels
            animatePackets
            cycleSeconds={9}
          />
        </div>

        {/* Encrypted-feel security card */}
        <div className="mt-12 grid grid-cols-1 items-center gap-8 md:grid-cols-2">
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
            {/* The /architecture page no longer exists, so this pointed at a
                404. Send people to the door instead. */}
            <Link
              href="/signup"
              className="mt-6 inline-block text-sm font-semibold text-[var(--accent)] hover:underline"
            >
              Create an account →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────── 7. Footer ───────────────── */

/*
 * The lamp, hung on the footer's top edge.
 *
 * It used to light a standalone CTA section of its own, which meant the page
 * ended on two closing statements in a row. The filament now sits on the
 * footer's own border and the beam falls down through the whole footer, so the
 * columns and the wordmark behind them are all lit by the same source.
 *
 * Kept dim on purpose: at full strength the cone read as a spotlight aimed at
 * the reader rather than as ambient light in the room, and the cyan washed out
 * the text it was supposed to reveal.
 *
 * Every layer is `pointer-events-none`. The wordmark underneath tracks the
 * cursor to reveal its gradient, and an overlay that swallowed the mouse would
 * kill that. The masks are painted in `var(--bg)` rather than the upstream
 * `slate-950`, so the beam dissolves into the footer instead of stamping a dark
 * rectangle onto it.
 */
function FooterLamp() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-0 h-72 overflow-hidden">
      <div className="relative flex h-full w-full items-start justify-center opacity-45">
        <motion.div
          initial={{ opacity: 0.3, width: "12rem" }}
          whileInView={{ opacity: 0.75, width: "30rem" }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.9, ease: "easeInOut" }}
          style={{ backgroundImage: "conic-gradient(var(--conic-position), var(--tw-gradient-stops))" }}
          className="absolute right-1/2 top-0 h-56 w-[30rem] bg-gradient-conic from-cyan-500/70 via-transparent to-transparent [--conic-position:from_70deg_at_center_top]"
        >
          <div className="absolute bottom-0 left-0 h-40 w-full bg-[var(--bg)] [mask-image:linear-gradient(to_top,white,transparent)]" />
          <div className="absolute bottom-0 left-0 h-full w-40 bg-[var(--bg)] [mask-image:linear-gradient(to_right,white,transparent)]" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0.3, width: "12rem" }}
          whileInView={{ opacity: 0.75, width: "30rem" }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.9, ease: "easeInOut" }}
          style={{ backgroundImage: "conic-gradient(var(--conic-position), var(--tw-gradient-stops))" }}
          className="absolute left-1/2 top-0 h-56 w-[30rem] bg-gradient-conic from-transparent via-transparent to-cyan-500/70 [--conic-position:from_290deg_at_center_top]"
        >
          <div className="absolute bottom-0 right-0 h-full w-40 bg-[var(--bg)] [mask-image:linear-gradient(to_left,white,transparent)]" />
          <div className="absolute bottom-0 right-0 h-40 w-full bg-[var(--bg)] [mask-image:linear-gradient(to_top,white,transparent)]" />
        </motion.div>

        {/* The bulb: a soft pool of light, then the filament line itself. */}
        <div className="absolute top-0 h-24 w-[26rem] -translate-y-14 rounded-full bg-cyan-500 opacity-20 blur-3xl" />
        <motion.div
          initial={{ width: "6rem" }}
          whileInView={{ width: "14rem" }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.9, ease: "easeInOut" }}
          className="absolute top-0 h-20 w-56 -translate-y-11 rounded-full bg-cyan-400/60 blur-2xl"
        />
        <motion.div
          initial={{ width: "12rem" }}
          whileInView={{ width: "30rem" }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.9, ease: "easeInOut" }}
          className="absolute top-0 h-px w-[30rem] bg-cyan-400/70"
        />
      </div>
    </div>
  );
}

/*
 * Footer.
 *
 * The old one linked straight into /dashboard, /campaigns, /compose — app routes
 * that bounce a signed-out visitor to the login page — and pointed at an
 * Architecture page that no longer exists. A marketing footer should link to the
 * page it is on and to the two doors into the product.
 */
const FOOTER_SECTIONS = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Workflow", href: "#workflow" },
      { label: "Reach", href: "#reach" },
    ],
  },
  {
    heading: "Get started",
    links: [
      { label: "Create an account", href: "/signup" },
      { label: "Sign in", href: "/login" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative isolate overflow-hidden border-t border-[var(--border)] bg-[var(--bg)]">
      {/* Light source, on the footer's own top edge. */}
      <FooterLamp />

      {/*
        The wordmark is the footer's backdrop, not a block of its own — it sits
        behind the columns and the beam falls across both.

        `pointer-events-auto` here and `pointer-events-none` on the content
        wrapper below: a full-width content div would otherwise cover the whole
        letterform and the cursor could never reach it, so the hover reveal
        would be dead. Links opt back in individually.
      */}
      <div className="pointer-events-none absolute inset-x-0 top-12 z-0 flex select-none justify-center px-6">
        {/* Held at 45%: at full strength the outline competed with the links
            sitting on top of it, and at the original 25% it was invisible. */}
        <div className="pointer-events-auto h-40 w-full max-w-6xl opacity-45 md:h-52">
          <TextHoverEffect text="CREATOROPS" />
        </div>
      </div>

      <div className="pointer-events-none relative z-10 mx-auto max-w-6xl px-6 pt-16 [&_a]:pointer-events-auto">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Link href="/" className="focus-ring inline-flex items-center gap-2.5 rounded-xl">
              <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface2)]">
                <img src="/logo.jpeg" alt="" width={26} height={26} className="rounded-lg" />
              </span>
              <span className="text-sm font-bold tracking-tight text-[var(--text)]">
                CreatorOps<span className="text-[var(--accent)]">.OS</span>
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[var(--muted)]">
              Plan, create, review, publish and measure across every platform — in one workspace,
              with real numbers read back from the platforms themselves.
            </p>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <nav key={section.heading} aria-label={section.heading}>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
                {section.heading}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-[var(--text-2)] transition-colors hover:text-[var(--accent)]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Just enough to clear the wordmark behind the columns — no more. */}
        <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-[var(--border)] py-6 sm:flex-row md:mt-20">
          <p className="text-[11px] text-[var(--muted)]">
            CreatorOps OS · UIU Developers HUB Hackathon 2026
          </p>
          <p className="text-[11px] text-[var(--muted)]">
            Metrics come from official platform APIs. Nothing here is estimated.
          </p>
        </div>
      </div>
    </footer>
  );
}
