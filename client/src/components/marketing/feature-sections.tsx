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

import { InfiniteMovingCards } from "@/components/ui/infinite-moving-cards";
import { GlowingEffect } from "@/components/ui/glowing-effect";
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
 * The pipeline, on the rolling marquee it always used.
 *
 * The marquee was replaced with a static five-column grid, which lost the
 * motion and left a wide band of dead space under the heading. The rolling
 * cards are back — but carrying the five stages the product actually runs,
 * not the four "Placeholder testimonial" quotes they used to hold. The
 * component wants { quote, name, title }, so the stage copy is the quote, the
 * stage is the name, and the position in the run is the title.
 */
const PIPELINE_STAGES = [
  { label: "Plan", copy: "Briefs, deadlines and deliverables on one timeline." },
  { label: "Create", copy: "One idea in, platform-native drafts out — tuned per network." },
  { label: "Review", copy: "Approvals that gate what ships, and unlock what's next." },
  { label: "Publish", copy: "Real OAuth connections, validated before anything goes live." },
  { label: "Measure", copy: "Numbers read back from the platforms themselves." },
];

const PIPELINE_CARDS = PIPELINE_STAGES.map((stage, index) => ({
  quote: stage.copy,
  name: stage.label,
  title: `Stage ${index + 1} of ${PIPELINE_STAGES.length}`,
}));

export function SocialProof() {
  return (
    <section className="relative overflow-hidden bg-[var(--bg)] py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <SectionKicker>Built for the whole pipeline</SectionKicker>
          <h2 className="text-balance text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
            Five stages. One workspace.
          </h2>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-[var(--muted)] sm:text-base">
            Every stage hands off to the next without an export, a re-upload, or a status meeting.
          </p>
        </div>
      </div>

      <div className="mt-10">
        <InfiniteMovingCards items={PIPELINE_CARDS} direction="left" speed="slow" />
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
 * Cards are built here rather than through `BentoGridItem`, because that
 * component sizes itself to its content: dropped into fixed grid rows it pushed
 * its own description past the card edge and the screen clipped it mid-word.
 * Every text block below is `shrink-0` with a line clamp, and only the gradient
 * header flexes, so a card can shrink to fit its row instead of overflowing it.
 */

/** Animated gradient skeleton used as a card header. */
function Skeleton({ from, to, bars = 3 }: { from: string; to: string; bars?: number }) {
  return (
    <div
      className="relative flex min-h-0 w-full flex-1 flex-col justify-end gap-1 overflow-hidden rounded-lg border border-[var(--border)] p-2.5"
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      {Array.from({ length: bars }).map((_, i) => (
        <motion.div
          key={i}
          className="h-1 shrink-0 rounded-full bg-[var(--border-strong)]"
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
    description: "Briefs, deadlines and deliverables on one timeline.",
    icon: <IconCalendarStats className="h-3.5 w-3.5 text-sky-400" />,
    header: <Skeleton from="rgba(14,165,233,0.32)" to="rgba(99,68,245,0.10)" />,
    className: "col-span-1",
  },
  {
    title: "Creator review with RBAC",
    description: "Approvals that respect who owns the decision.",
    icon: <IconChecklist className="h-3.5 w-3.5 text-emerald-400" />,
    header: <Skeleton from="rgba(16,185,129,0.30)" to="rgba(14,165,233,0.10)" />,
    className: "col-span-1",
  },
  {
    title: "Live publishing pipeline",
    description: "Real OAuth connections, pre-flight validation, a resumable queue.",
    icon: <IconRocket className="h-3.5 w-3.5 text-amber-400" />,
    header: <Skeleton from="rgba(245,158,11,0.32)" to="rgba(251,113,133,0.10)" bars={4} />,
    className: "col-span-2",
  },
];

/*
 * One card. The wrapper carries the same `rounded-xl` as the card itself:
 * GlowingEffect draws its border with `rounded-[inherit]`, so a square wrapper
 * gave the trace square corners around a rounded card.
 */
function ConsoleCard({
  title,
  description,
  header,
  icon,
  className,
}: {
  title: string;
  description: string;
  header: React.ReactNode;
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`group/card relative min-h-0 rounded-xl ${className ?? ""}`}>
      <GlowingEffect spread={38} glow proximity={64} inactiveZone={0.01} borderWidth={2} />
      <div className="relative flex h-full min-h-0 flex-col gap-2 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5">
        {header}
        <div className="shrink-0 transition-transform duration-200 group-hover/card:translate-x-1">
          {icon}
          <h3 className="mt-1 truncate text-[13px] font-bold tracking-tight text-[var(--text)]">
            {title}
          </h3>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[var(--muted)]">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

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
          <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#fb7185]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#10b981]" />
            <span className="ml-3 text-xs text-[var(--muted)]">creatorops · workspace</span>
          </div>

          {/* min-h-0 on the grid and on every cell: without it the rows size to
              their content and push the last card out through the frame. */}
          <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-3 gap-2 p-2.5 md:gap-2.5 md:p-3">
            {FEATURES.map((feature) => (
              <ConsoleCard key={feature.title} {...feature} />
            ))}

            <WobbleCard containerClassName="col-span-2 min-h-0 h-full bg-[var(--surface2)]" className="p-4">
              <div className="max-w-md">
                <IconChartBar className="mb-1.5 h-4 w-4 text-[var(--accent)]" />
                <h3 className="text-left text-sm font-semibold tracking-tight text-[var(--text)] md:text-lg">
                  Analytics that close the loop
                </h3>
                <p className="mt-1 line-clamp-3 text-left text-[11px] leading-snug text-[var(--text-2)] md:text-xs">
                  Every publish reports back. See what landed, on which network, and what
                  to make more of — without exporting a single CSV.
                </p>
              </div>
            </WobbleCard>

            <WobbleCard containerClassName="col-span-1 min-h-0 h-full bg-[var(--surface)]" className="p-4">
              <div className="relative">
                <Meteors number={10} />
                <IconUsersGroup className="mb-1.5 h-4 w-4 text-sky-400" />
                <h3 className="text-left text-sm font-semibold tracking-tight text-[var(--text)] md:text-lg">
                  Brand circulars &amp; applications
                </h3>
                <p className="mt-1 line-clamp-3 text-left text-[11px] leading-snug text-[var(--text-2)] md:text-xs">
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
