'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ContentBoard — Bento Grid production board.
 *
 * Replaces the flat vertical stack with lanes driven by the server's real
 * CONTENT_STATUSES enum (idea, draft, in_review, approved, scheduled, published,
 * rejected, changes_requested). The eight statuses collapse into five lanes that
 * read like a production pipeline; review-adjacent states share a lane so
 * `changes_requested` and `rejected` surface next to `in_review` rather than
 * hiding in their own dead columns.
 *
 * When a campaign has no content yet, the board renders representative tiles
 * flagged "Sample" so the layout is legible on an empty workspace. They are
 * visibly labelled and non-interactive — never mixed in with real items.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Lightbulb, PenTool, Eye, CheckCircle2, Rocket } from 'lucide-react';

import { BentoGrid } from '../ui/bento-grid';
import { Badge, useStagger } from '../ds';
import ContentCard from './ContentCard';

const LANES = [
  { key: 'ideation',   label: 'Ideation',      icon: Lightbulb,    statuses: ['idea'] },
  { key: 'production', label: 'In Production', icon: PenTool,      statuses: ['draft'] },
  { key: 'review',     label: 'Review',        icon: Eye,          statuses: ['in_review', 'changes_requested', 'rejected'] },
  { key: 'approved',   label: 'Approved',      icon: CheckCircle2, statuses: ['approved'] },
  { key: 'released',   label: 'Released',      icon: Rocket,       statuses: ['scheduled', 'published'] }
];

/* Representative tiles for an empty board — clearly marked as samples. */
const SAMPLES = {
  ideation: [
    { _id: 's1', title: 'Anamorphic B-roll — rooftop golden hour', rawIdea: 'Handheld 2.39:1 pass over the east rooftop at last light. Pull focus off the skyline into the lens flare.', status: 'idea' }
  ],
  production: [
    { _id: 's2', title: 'Client sizzle — Q3 brand film', rawIdea: 'Assembly cut down to 90s. Needs colour pass and a licensed track before it goes out.', status: 'draft' }
  ],
  review: [
    { _id: 's3', title: 'Behind the lens — grip department', rawIdea: 'Vertical cut for Shorts and Reels. Awaiting sign-off on the crew interview audio mix.', status: 'in_review' }
  ],
  approved: [
    { _id: 's4', title: 'Title sequence breakdown', rawIdea: 'Approved for release across YouTube and LinkedIn. Captions locked.', status: 'approved' }
  ],
  released: [
    { _id: 's5', title: 'Short film teaser — 30s', rawIdea: 'Published to all connected accounts. Analytics syncing nightly.', status: 'published' }
  ]
};

function LaneHeader({ lane, count }) {
  const Icon = lane.icon;
  return (
    <header className="mb-3 flex items-center justify-between gap-2 border-b border-[var(--border)] pb-2">
      <span className="flex min-w-0 items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface2)] text-[var(--accent)]">
          <Icon className="h-3 w-3" />
        </span>
        <span className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text)]">
          {lane.label}
        </span>
      </span>
      <Badge tone={count ? 'accent' : 'neutral'}>{count}</Badge>
    </header>
  );
}

export default function ContentBoard({ items, variantsByContent = {}, user, onRefresh }) {
  const isEmpty = !items?.length;
  const { container, item: itemVariant } = useStagger(0.05);

  const lanes = useMemo(
    () =>
      LANES.map(lane => ({
        ...lane,
        cards: isEmpty
          ? (SAMPLES[lane.key] || []).map(s => ({ ...s, __sample: true }))
          : items.filter(i => lane.statuses.includes(i.status || 'idea'))
      })),
    [items, isEmpty]
  );

  return (
    <div className="space-y-3">
      {isEmpty ? (
        <p className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          <Lightbulb className="h-3.5 w-3.5 shrink-0" />
          No content yet — the tiles below are samples showing how the board fills in.
        </p>
      ) : null}

      {/* Bento lanes. Horizontal scroll-snap on mobile beats squeezing 5 lanes
          into 375px; a real grid from lg upwards. */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="visible"
        className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 lg:mx-0 lg:grid lg:snap-none lg:grid-cols-3 lg:overflow-visible lg:px-0 xl:grid-cols-5"
      >
        {lanes.map(lane => (
          <motion.section
            key={lane.key}
            variants={itemVariant}
            className="min-w-[280px] snap-start lg:min-w-0"
          >
            <LaneHeader lane={lane} count={lane.cards.length} />

            {lane.cards.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface2)]/40 p-4 text-center text-[11px] text-[var(--muted)]">
                Empty
              </div>
            ) : (
              <BentoGrid className="mx-0 max-w-none grid-cols-1 gap-3 md:auto-rows-auto md:grid-cols-1">
                {lane.cards.map(card => (
                  <ContentCard
                    key={card._id}
                    item={card}
                    user={user}
                    initialVariants={variantsByContent[card._id] || []}
                    onRefresh={onRefresh}
                    sample={Boolean(card.__sample)}
                  />
                ))}
              </BentoGrid>
            )}
          </motion.section>
        ))}
      </motion.div>
    </div>
  );
}
