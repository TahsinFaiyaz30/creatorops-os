'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ContentCard — a board tile wrapped in Aceternity's GlareCard.
 *
 * Why the tile and the working panel are separate:
 * GlareCard fixes its own aspect ratio and clips children through
 * `mix-blend-soft-light` + `clip-path: inset(...)`. Nesting the AI result panel,
 * the variant grid and version history inside it would clip them and fight the
 * blend mode. So the GlareCard stays a fixed-size tile carrying the premium
 * hover physics, and expanding renders the working surface beneath it.
 *
 * All real behaviour is preserved: POST /api/ai/repurpose, PlatformVariantCard,
 * VersionHistory.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Sparkles, ChevronDown, Layers, Lightbulb } from 'lucide-react';

import { GlareCard } from '../ui/glare-card';
import { Surface, Badge, Button, Notice } from '../ds';
import { api } from '../../lib/api';
import AIResultPanel from '../ai/AIResultPanel';
import PlatformVariantCard from './PlatformVariantCard';
import VersionHistory from './VersionHistory';

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

export default function ContentCard({ item, user, initialVariants = [], onRefresh, sample = false }) {
  const [variants, setVariants] = useState(initialVariants);
  const [provider, setProvider] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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

  return (
    <div className="flex flex-col gap-2">
      {/* ── Tile ──────────────────────────────────────────────────────────── */}
      <motion.div
        whileHover={{ y: -3 }}
        transition={{ type: 'spring', stiffness: 400, damping: 26 }}
      >
        <GlareCard
          containerClassName="w-full [aspect-ratio:16/11]"
          className="flex flex-col justify-between bg-[var(--surface)] p-4"
        >
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="min-w-0 text-sm font-bold leading-snug tracking-tight text-[var(--text)]">
                <span className="line-clamp-2">{item.title || 'Untitled'}</span>
              </h3>
              <Badge tone={STATUS_TONE[item.status] || 'neutral'}>{prettyStatus(item.status)}</Badge>
            </div>
            <p className="mt-2 line-clamp-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-[var(--muted)]">
              <Lightbulb className="mt-0.5 h-3 w-3 shrink-0" />
              {item.rawIdea || 'No raw idea captured.'}
            </p>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--muted)]">
              <Layers className="h-3 w-3" />
              {variants.length} variant{variants.length === 1 ? '' : 's'}
            </span>
            {sample ? (
              <Badge tone="warning">Sample</Badge>
            ) : (
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
            )}
          </div>
        </GlareCard>
      </motion.div>

      {/* ── Working panel — outside the GlareCard so nothing clips ─────────── */}
      <AnimatePresence initial={false}>
        {open && !sample && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <Surface pad="md" className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary" size="sm" onClick={repurpose} disabled={busy}>
                  <Sparkles className="h-3.5 w-3.5" />
                  {busy ? 'Generating…' : 'AI Repurpose'}
                </Button>
                <VersionHistory contentItemId={item._id} />
              </div>

              {error ? <Notice tone="danger">{error}</Notice> : null}

              <AIResultPanel provider={provider} count={variants.length} />

              {variants.length > 0 ? (
                <div className="grid gap-3 xl:grid-cols-2">
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
