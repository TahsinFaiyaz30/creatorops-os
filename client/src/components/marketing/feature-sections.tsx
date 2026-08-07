"use client";

import { motion } from "motion/react";
import {
  IconSparkles,
  IconCalendarStats,
  IconChecklist,
  IconRocket,
  IconChartBar,
  IconUsersGroup,
} from "@tabler/icons-react";

import { BentoGridItem } from "@/components/ui/bento-grid";
import { WobbleCard } from "@/components/ui/wobble-card";
import { Meteors } from "@/components/ui/meteors";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { PointerHighlight } from "@/components/ui/pointer-highlight";

/* ───────────────────────── Section heading ───────────────────────── */

function SectionKicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-4 inline-block rounded-full border border-[var(--border)] bg-[var(--surface2)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
      {children}
    </span>
  );
}

/* ───────────────── 1. The pipeline ───────────────── */

/*
 * The pipeline, stated plainly.
 *
 * This was a lone kicker line floating above a marquee of placeholder
 * testimonials — a headline with nothing under it and social proof that proved
 * nothing. It now shows the five stages the product actually runs, which is the
 * claim the headline was making.
 */
const PIPELINE_STAGES = [
  { label: "Plan", copy: "Briefs, deadlines and deliverables on one timeline." },
  { label: "Create", copy: "One idea in, platform-native drafts out." },
  { label: "Review", copy: "Approvals that gate what ships, and unlock what's next." },
  { label: "Publish", copy: "Real OAuth connections, validated before anything goes live." },
  { label: "Measure", copy: "Numbers read back from the platforms themselves." },
];

export function SocialProof() {
  return (
    <section className="relative overflow-hidden bg-[var(--bg)] py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <SectionKicker>Built for the whole pipeline</SectionKicker>
          <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
            Five stages. One workspace.
          </h2>
          <p className="mt-4 text-pretty text-sm leading-relaxed text-[var(--muted)] sm:text-base">
            Every stage hands off to the next without an export, a re-upload, or a status meeting.
          </p>
        </div>

        <ol className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {PIPELINE_STAGES.map((stage, index) => (
            <motion.li
              key={stage.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
              className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-5 backdrop-blur-xl transition-colors hover:border-[var(--accent-line)]"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,var(--accent-soft),transparent_65%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              />
              <span className="relative block text-[11px] font-bold tabular-nums text-[var(--accent)]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="relative mt-2 text-base font-bold tracking-tight text-[var(--text)]">
                {stage.label}
              </h3>
              <p className="relative mt-1.5 text-xs leading-relaxed text-[var(--muted)]">{stage.copy}</p>

              {/* Connector — the hand-off the copy above is describing. */}
              {index < PIPELINE_STAGES.length - 1 ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-0 top-1/2 hidden h-px w-3 -translate-y-1/2 translate-x-full bg-[var(--border-strong)] lg:block"
                />
              ) : null}
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ───────────────── 2. Scroll-driven showcase ───────────────── */

/*
 * The feature grid, held inside the console.
 *
 * It used to be two sections making the same argument: a full-width bento grid
 * of feature cards, and — right underneath — a 3D device frame containing a fake
 * dashboard (invented counts, 24 drafts / 132 published, and five progress bars
 * of nothing). The grid is now the screen's contents, so the frame shows the
 * product instead of a mock of it, and nothing here claims a number.
 *
 * `GlowingEffect` is deliberately not reinstated around the cards. It measures
 * the cursor against a card's own bounding box, and inside a `rotateX`-ed,
 * scaled container those coordinates no longer correspond to where the pointer
 * appears to be — the glow tracked several centimetres away from the mouse.
 */

/** Animated gradient skeleton used as a card header. */
function Skeleton({ from, to, bars = 3 }: { from: string; to: string; bars?: number }) {
  return (
    <div
      className="relative flex h-full min-h-[3.5rem] w-full flex-col justify-end gap-1.5 overflow-hidden rounded-lg border border-[var(--border)] p-3"
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      {Array.from({ length: bars }).map((_, i) => (
        <motion.div
          key={i}
          className="h-1.5 rounded-full bg-[var(--border-strong)]"
          initial={{ width: "35%" }}
          animate={{ width: ["35%", "82%", "35%"] }}
          transition={{
            duration: 3.4 + i * 0.7,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.25,
          }}
        />
      ))}
    </div>
  );
}

const FEATURES = [
  {
    title: "AI multi-platform generation",
    description: "One idea in, platform-native drafts out — tuned per network, not copy-pasted.",
    icon: <IconSparkles className="h-3.5 w-3.5 text-[var(--accent)]" />,
    header: <Skeleton from="rgba(99,68,245,0.35)" to="rgba(174,72,255,0.10)" bars={4} />,
    className: "col-span-2",
  },
  {
    title: "Campaign planning",
    description: "Briefs, deadlines, and deliverables on one timeline.",
    icon: <IconCalendarStats className="h-3.5 w-3.5 text-sky-400" />,
    header: <Skeleton from="rgba(14,165,233,0.32)" to="rgba(99,68,245,0.10)" />,
    className: "col-span-1",
  },
  {
    title: "Creator review with RBAC",
    description: "Approvals that respect who actually owns the decision.",
    icon: <IconChecklist className="h-3.5 w-3.5 text-emerald-400" />,
    header: <Skeleton from="rgba(16,185,129,0.30)" to="rgba(14,165,233,0.10)" />,
    className: "col-span-1",
  },
  {
    title: "Live publishing pipeline",
    description: "Real OAuth connections, pre-flight validation, and a resumable queue.",
    icon: <IconRocket className="h-3.5 w-3.5 text-amber-400" />,
    header: <Skeleton from="rgba(245,158,11,0.32)" to="rgba(251,113,133,0.10)" bars={4} />,
    className: "col-span-2",
  },
];

export function ShowcaseScroll() {
  return (
    <section id="features" className="relative -mt-10 overflow-hidden bg-[var(--bg)]">
      <ContainerScroll
        titleComponent={
          <div className="mb-6">
            <SectionKicker>The workspace</SectionKicker>
            <h2 className="text-balance text-3xl font-bold tracking-tight text-[var(--text)] sm:text-5xl">
              Everything the workflow touches,
              <PointerHighlight
                containerClassName="inline-block"
                rectangleClassName="border-[var(--accent-line)] bg-[var(--accent-soft)]"
                pointerClassName="text-[var(--accent)]"
              >
                <span className="px-1">in one place</span>
              </PointerHighlight>
            </h2>
          </div>
        }
      >
        <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl bg-[var(--surface)]">
          <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[#fb7185]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#10b981]" />
            <span className="ml-3 text-xs text-[var(--muted)]">creatorops · workspace</span>
          </div>

          {/* min-h-0 on the scroller and every row: without it the grid rows
              size to their content and push the last card out of the frame. */}
          <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-3 gap-2 p-3 md:gap-3 md:p-4">
            {FEATURES.map((feature) => (
              <BentoGridItem
                key={feature.title}
                title={feature.title}
                description={feature.description}
                header={feature.header}
                icon={feature.icon}
                className={`${feature.className} min-h-0 border-[var(--border)] bg-[var(--surface)] p-2.5 md:p-3`}
              />
            ))}

            <WobbleCard
              containerClassName="col-span-2 min-h-0 h-full bg-[var(--surface2)]"
              className="p-4 md:p-6"
            >
              <div className="max-w-sm">
                <IconChartBar className="mb-2 h-5 w-5 text-[var(--accent)]" />
                <h3 className="text-left text-base font-semibold tracking-tight text-[var(--text)] md:text-xl">
                  Analytics that close the loop
                </h3>
                <p className="mt-1.5 text-left text-[11px] leading-relaxed text-[var(--text-2)] md:text-sm">
                  Every publish reports back. See what landed, on which network, and what
                  to make more of — without exporting a single CSV.
                </p>
              </div>
            </WobbleCard>

            <WobbleCard
              containerClassName="col-span-1 min-h-0 h-full bg-[var(--surface)]"
              className="p-4 md:p-6"
            >
              <div className="relative">
                <Meteors number={12} />
                <IconUsersGroup className="mb-2 h-5 w-5 text-sky-400" />
                <h3 className="text-left text-base font-semibold tracking-tight text-[var(--text)] md:text-xl">
                  Brand circulars &amp; applications
                </h3>
                <p className="mt-1.5 text-left text-[11px] leading-relaxed text-[var(--text-2)] md:text-sm">
                  Brands post briefs. Creators apply. The match becomes a campaign.
                </p>
              </div>
            </WobbleCard>
          </div>
        </div>
      </ContainerScroll>
    </section>
  );
}
