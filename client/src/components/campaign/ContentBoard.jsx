'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ContentBoard — cinematic production board.
 *
 * Lanes are driven by the server's real CONTENT_STATUSES enum. The eight
 * statuses collapse into five lanes that read like a pipeline; review-adjacent
 * states (changes_requested, rejected) share the Review lane instead of hiding
 * in their own dead columns.
 *
 * Layout notes:
 *  · Lane headers are sticky glass pills, so they stay legible while a long lane
 *    scrolls underneath.
 *  · Mobile gets horizontal scroll-snap — five lanes cannot share 375px.
 *  · Empty lanes render a low-contrast dashed slot rather than collapsing, so the
 *    board keeps its shape and the eye can still scan across statuses.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Lightbulb, PenTool, Eye, CheckCircle2, Rocket, Sparkles } from 'lucide-react';

import { GlowingStarsBackgroundCard, GlowingStarsTitle, GlowingStarsDescription } from '../ui/glowing-stars';
import { useStagger } from '../ds';
import ContentCard from './ContentCard';

const EASE = [0.16, 1, 0.3, 1];

const LANES = [
  { key: 'ideation',   label: 'Ideation',      icon: Lightbulb,    accent: '#6344F5', statuses: ['idea'] },
  { key: 'production', label: 'In Production', icon: PenTool,      accent: '#0ea5e9', statuses: ['draft'] },
  { key: 'review',     label: 'Review',        icon: Eye,          accent: '#f59e0b', statuses: ['in_review', 'changes_requested', 'rejected'] },
  { key: 'approved',   label: 'Approved',      icon: CheckCircle2, accent: '#10b981', statuses: ['approved'] },
  { key: 'released',   label: 'Released',      icon: Rocket,       accent: '#AE48FF', statuses: ['scheduled', 'published'] }
];

/* Sticky glass pill with a glowing count. */
function LaneHeader({ lane, count }) {
  const Icon = lane.icon;
  const active = count > 0;
  return (
    <header className="sticky top-0 z-20 -mx-1 mb-3 px-1 pb-2 pt-1 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)]/70 py-1.5 pl-2 pr-1.5 shadow-[var(--shadow)]">
        <span className="flex min-w-0 items-center gap-2">
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
            style={{
              background: `${lane.accent}1f`,
              boxShadow: active ? `0 0 12px -2px ${lane.accent}66` : 'none'
            }}
          >
            <Icon className="h-2.5 w-2.5" style={{ color: lane.accent }} />
          </span>
          <span className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text)]">
            {lane.label}
          </span>
        </span>
        <span
          className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums"
          style={
            active
              ? { background: `${lane.accent}26`, color: lane.accent, boxShadow: `0 0 14px -4px ${lane.accent}` }
              : { background: 'var(--surface3)', color: 'var(--muted)' }
          }
        >
          {count}
        </span>
      </div>
    </header>
  );
}

/* Glowing empty state — replaces the amber warning banner. */
function BoardEmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE }}
      className="mx-auto w-full max-w-sm"
    >
      <GlowingStarsBackgroundCard>
        <GlowingStarsTitle>Nothing in production</GlowingStarsTitle>
        <div className="flex items-end justify-between gap-3">
          <GlowingStarsDescription>
            Capture an idea in a campaign and it enters the board here, moving lane
            by lane until it ships.
          </GlowingStarsDescription>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--accent-line)] bg-[var(--accent-soft)]">
            <Sparkles className="h-4 w-4 text-[var(--accent)]" />
          </span>
        </div>
      </GlowingStarsBackgroundCard>
    </motion.div>
  );
}

export default function ContentBoard({ items, variantsByContent = {}, user, onRefresh }) {
  const isEmpty = !items?.length;
  const { container, item: itemVariant } = useStagger(0.05);

  const lanes = useMemo(
    () =>
      LANES.map(lane => ({
        ...lane,
        cards: (items || []).filter(i => lane.statuses.includes(i.status || 'idea'))
      })),
    [items]
  );

  if (isEmpty) return <BoardEmptyState />;

  return (
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
          className="min-w-[290px] snap-start lg:min-w-0"
        >
          <LaneHeader lane={lane} count={lane.cards.length} />

          {lane.cards.length === 0 ? (
            <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface2)]/30 text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
              Empty
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {lane.cards.map(card => (
                <ContentCard
                  key={card._id}
                  item={card}
                  user={user}
                  accent={lane.accent}
                  initialVariants={variantsByContent[card._id] || []}
                  onRefresh={onRefresh}
                />
              ))}
            </div>
          )}
        </motion.section>
      ))}
    </motion.div>
  );
}
