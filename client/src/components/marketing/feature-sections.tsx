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
import { BentoGrid, BentoGridItem } from "@/components/ui/bento-grid";
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

/* ───────────────── 1. Social proof marquee ───────────────── */

const SIGNALS = [
  {
    quote:
      "One raw idea became twelve platform-ready posts before my coffee went cold. The repurposing engine is the whole product for me.",
    name: "Independent creator",
    title: "Placeholder testimonial",
  },
  {
    quote:
      "Review routing replaced a spreadsheet, three group chats, and a shared drive we all pretended to keep tidy.",
    name: "Brand representative",
    title: "Placeholder testimonial",
  },
  {
    quote:
      "Publishing used to be five tabs and a prayer. Now it validates before it ships and tells me exactly what broke.",
    name: "Content operations",
    title: "Placeholder testimonial",
  },
  {
    quote:
      "The live event feed means nobody asks me for a status update anymore. They just look.",
    name: "Creator admin",
    title: "Placeholder testimonial",
  },
];

export function SocialProof() {
  return (
    <section className="relative overflow-hidden bg-[var(--bg)] py-20">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <SectionKicker>Built for the whole pipeline</SectionKicker>
      </div>
      <div className="mt-6">
        <InfiniteMovingCards items={SIGNALS} direction="left" speed="slow" pauseOnHover />
      </div>
    </section>
  );
}

/* ───────────────── 2. Bento feature grid ───────────────── */

/** Animated gradient skeleton used as BentoGridItem headers. */
function Skeleton({ from, to, bars = 3 }: { from: string; to: string; bars?: number }) {
  return (
    <div
      className="relative flex h-full min-h-[6rem] w-full flex-col justify-end gap-2 overflow-hidden rounded-xl border border-[var(--border)] p-4"
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      {Array.from({ length: bars }).map((_, i) => (
        <motion.div
          key={i}
          className="h-2 rounded-full bg-[var(--border-strong)]"
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
    description:
      "One idea in, platform-native drafts out — tuned per network, not copy-pasted.",
    icon: <IconSparkles className="h-4 w-4 text-[var(--accent)]" />,
    header: <Skeleton from="rgba(99,68,245,0.35)" to="rgba(174,72,255,0.10)" bars={4} />,
    className: "md:col-span-2",
  },
  {
    title: "Campaign planning",
    description: "Briefs, deadlines, and deliverables on one timeline.",
    icon: <IconCalendarStats className="h-4 w-4 text-sky-400" />,
    header: <Skeleton from="rgba(14,165,233,0.32)" to="rgba(99,68,245,0.10)" />,
    className: "md:col-span-1",
  },
  {
    title: "Creator review with RBAC",
    description: "Approvals that respect who actually owns the decision.",
    icon: <IconChecklist className="h-4 w-4 text-emerald-400" />,
    header: <Skeleton from="rgba(16,185,129,0.30)" to="rgba(14,165,233,0.10)" />,
    className: "md:col-span-1",
  },
  {
    title: "Live publishing pipeline",
    description:
      "Real OAuth connections, pre-flight validation, and a resumable queue that survives refreshes.",
    icon: <IconRocket className="h-4 w-4 text-amber-400" />,
    header: <Skeleton from="rgba(245,158,11,0.32)" to="rgba(251,113,133,0.10)" bars={4} />,
    className: "md:col-span-2",
  },
];

export function FeaturesBento() {
  return (
    <section id="features" className="relative overflow-hidden bg-[var(--bg)] py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <SectionKicker>Features</SectionKicker>
          <h2 className="mx-auto max-w-3xl text-balance text-3xl font-bold tracking-tight text-[var(--text)] sm:text-5xl">
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

        <BentoGrid className="mx-auto mt-14 md:auto-rows-[16rem] md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className={`relative ${f.className ?? ""}`}>
              {/* Cursor-tracking glow border */}
              <GlowingEffect
                spread={44}
                glow
                disabled={false}
                proximity={72}
                inactiveZone={0.01}
                borderWidth={2}
              />
              <BentoGridItem
                title={f.title}
                description={f.description}
                header={f.header}
                icon={f.icon}
                className="h-full border-[var(--border)] bg-[var(--surface)]"
              />
            </div>
          ))}
        </BentoGrid>

        {/* Wobble cards + meteors */}
        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <WobbleCard
            containerClassName="col-span-1 lg:col-span-2 bg-[var(--surface2)] min-h-[240px]"
            className=""
          >
            <div className="max-w-sm">
              <IconChartBar className="mb-3 h-6 w-6 text-[var(--accent)]" />
              <h3 className="text-left text-xl font-semibold tracking-tight text-[var(--text)] md:text-2xl">
                Analytics that close the loop
              </h3>
              <p className="mt-3 text-left text-sm text-[var(--text-2)]">
                Every publish reports back. See what landed, on which network, and
                what to make more of — without exporting a single CSV.
              </p>
            </div>
          </WobbleCard>

          <WobbleCard containerClassName="col-span-1 min-h-[240px] bg-[var(--surface)]">
            <div className="relative">
              <Meteors number={18} />
              <IconUsersGroup className="mb-3 h-6 w-6 text-sky-400" />
              <h3 className="text-left text-xl font-semibold tracking-tight text-[var(--text)]">
                Brand circulars &amp; applications
              </h3>
              <p className="mt-3 text-left text-sm text-[var(--text-2)]">
                Brands post briefs. Creators apply. The match becomes a campaign.
              </p>
            </div>
          </WobbleCard>
        </div>
      </div>
    </section>
  );
}

/* ───────────────── 3. Scroll-driven showcase ───────────────── */

export function ShowcaseScroll() {
  return (
    <section className="relative -mt-10 overflow-hidden bg-[var(--bg)]">
      <ContainerScroll
        titleComponent={
          <div className="mb-6">
            <SectionKicker>The workspace</SectionKicker>
            <h2 className="text-balance text-3xl font-bold tracking-tight text-[var(--text)] sm:text-5xl">
              Scroll to open the console
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--muted)]">
              Campaigns, drafts, approvals, and live publish state — one surface.
            </p>
          </div>
        }
      >
        {/* Stylised in-product mock, drawn in pure CSS so it stays crisp */}
        <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl bg-[var(--surface)]">
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[#fb7185]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#10b981]" />
            <span className="ml-3 text-xs text-[var(--muted)]">
              creatorops · dashboard
            </span>
          </div>
          <div className="grid flex-1 grid-cols-12 gap-3 p-4">
            <div className="col-span-3 space-y-2">
              {["Campaigns", "Compose", "Review", "Publishing", "Analytics"].map(
                (s, i) => (
                  <div
                    key={s}
                    className={`rounded-lg px-3 py-2 text-xs ${
                      i === 1
                        ? "bg-[var(--surface3)] text-[var(--text)]"
                        : "text-[var(--muted)] hover:text-[var(--text-2)]"
                    }`}
                  >
                    {s}
                  </div>
                ),
              )}
            </div>
            <div className="col-span-9 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { l: "Drafts", v: "24", c: "from-[#6344F5]/40" },
                  { l: "In review", v: "7", c: "from-sky-500/40" },
                  { l: "Published", v: "132", c: "from-emerald-500/40" },
                ].map((k) => (
                  <div
                    key={k.l}
                    className={`rounded-xl border border-[var(--border)] bg-gradient-to-br ${k.c} to-transparent p-3`}
                  >
                    <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                      {k.l}
                    </div>
                    <div className="mt-1 text-2xl font-bold text-[var(--text)]">{k.v}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-2 rounded-xl border border-[var(--border)] p-3">
                {[82, 64, 91, 47, 73].map((w, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-6 w-6 shrink-0 rounded-md bg-[var(--surface3)]" />
                    <motion.div
                      className="h-2.5 rounded-full bg-gradient-to-r from-[#6344F5] to-[#AE48FF]"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${w}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.1, delay: i * 0.08, ease: "easeOut" }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </ContainerScroll>
    </section>
  );
}
