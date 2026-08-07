'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ContentCard — cinematic asset card.
 *
 * Wrapped in Aceternity's GlareCard for the tilt + glare sweep on mouse move.
 *
 * Why the tile and the working panel are separate:
 * GlareCard fixes its own aspect ratio and clips children through
 * `mix-blend-soft-light` + `clip-path: inset(...)`. Nesting the AI result panel,
 * the variant grid and version history inside it would clip them and fight the
 * blend mode. So the GlareCard stays a fixed tile carrying the hover physics, and
 * expanding renders the working surface beneath it at full width.
 *
 * All real behaviour is preserved: POST /api/ai/repurpose, PlatformVariantCard,
 * VersionHistory.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Sparkles, ChevronDown, Layers, Film, Clock } from 'lucide-react';

import { GlareCard } from '../ui/glare-card';
import { Surface, Badge, Button } from '../ds';
import { api } from '../../lib/api';
import AIResultPanel from '../ai/AIResultPanel';
import PlatformVariantCard from './PlatformVariantCard';
import VersionHistory from './VersionHistory';
import { useToastState } from '../ui/toast';

const EASE = [0.16, 1, 0.3, 1];

export const STATUS_TONE = {
  idea: 'neutral',
  draft: 'neutral',
  in_review: 'warning',
  changes_requested: 'warning',
  approved: 'success',
  scheduled: 'accent',
  published: 'success',
  rejected: 'danger'
};

export const prettyStatus = s => (s || 'idea').replace(/_/g, ' ');

const shortDate = d =>
  d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null;

export default function ContentCard({
  item,
  user,
  initialVariants = [],
  onRefresh,
  accent = '#6344F5'
}) {
  const [variants, setVariants] = useState(initialVariants);
  const [provider, setProvider] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useToastState('danger');
  const [open, setOpen] = useState(false);

  useEffect(() => { setVariants(initialVariants); }, [initialVariants]);

  const repurpose = async () => {
    setBusy(true);
    setError('');
    try {
      const payload = await api.post('/api/ai/repurpose', { contentItemId: item._id });
      setProvider(payload.data.provider);
      setVariants(payload.data.variants || []);
      onRefresh?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const created = shortDate(item.createdAt);

  return (
    <div className="flex flex-col gap-2">
      {/* ── Asset tile ─────────────────────────────────────────────────── */}
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ type: 'spring', stiffness: 400, damping: 24 }}
      >
        <GlareCard
          containerClassName="w-full [aspect-ratio:4/3]"
          className="flex flex-col justify-between p-4 backdrop-blur-xl"
        >
          {/* Lane-tinted wash so a card reads as belonging to its column */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(120% 80% at 0% 0%, ${accent}24, transparent 60%)`
            }}
          />

          <div className="relative min-w-0">
            <div className="flex items-start justify-between gap-2">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border"
                style={{ borderColor: `${accent}55`, background: `${accent}1a` }}
              >
                <Film className="h-3 w-3" style={{ color: accent }} />
              </span>
              <Badge tone={STATUS_TONE[item.status] || 'neutral'}>{prettyStatus(item.status)}</Badge>
            </div>

            <h3 className="mt-2.5 text-sm font-bold leading-snug tracking-tight text-[var(--text)]">
              <span className="line-clamp-2">{item.title || 'Untitled'}</span>
            </h3>
            <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-[var(--muted)]">
              {item.rawIdea || 'No raw idea captured.'}
            </p>
          </div>

          <div className="relative flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[var(--muted)]">
              <span className="flex items-center gap-1">
                <Layers className="h-3 w-3" />
                {variants.length}
              </span>
              {created ? (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {created}
                </span>
              ) : null}
            </span>

            <button
              type="button"
              onClick={() => setOpen(o => !o)}
              aria-expanded={open}
              className="focus-ring inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent-soft)]"
            >
              {open ? 'Close' : 'Open'}
              <ChevronDown
                className={`h-3 w-3 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        </GlareCard>
      </motion.div>

      {/* ── Working panel — outside the GlareCard so nothing clips ───────── */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="overflow-hidden"
          >
            <Surface pad="sm" className="space-y-3 backdrop-blur-xl">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary" size="sm" onClick={repurpose} disabled={busy}>
                  <Sparkles className="h-3.5 w-3.5" />
                  {busy ? 'Generating…' : 'AI Repurpose'}
                </Button>
                <VersionHistory contentItemId={item._id} />
              </div>


              <AIResultPanel provider={provider} count={variants.length} />

              {variants.length > 0 ? (
                <div className="grid gap-3 2xl:grid-cols-2">
                  {variants.map(variant => (
                    <PlatformVariantCard
                      key={variant._id}
                      variant={variant}
                      user={user}
                      onRefresh={onRefresh}
                    />
                  ))}
                </div>
              ) : null}
            </Surface>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
