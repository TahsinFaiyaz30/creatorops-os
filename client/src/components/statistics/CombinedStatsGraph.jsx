'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CombinedStatsGraph — metric + platform filters above one chart.
 *
 * Filters are one row above the plot, as a segmented control rather than a
 * native <select>, so switching metric is one click instead of two and the
 * current choice is readable without opening anything.
 *
 * Active chips carry the accent, not per-platform brand colours. The chart is a
 * single series now (see StatsChart), so brand-coloured chips would read as a
 * legend mapping chip colour → bar colour, and no such mapping exists.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { RadioTower, Check, X } from 'lucide-react';

import { formatPlatform } from '../../lib/platforms';
import { AnimatedButton } from '../ui/AnimatedButton';
import StatsChart from './StatsChart';

const METRIC_OPTIONS = [
  { key: 'views', label: 'Views' },
  { key: 'likes', label: 'Likes' },
  { key: 'comments', label: 'Comments' },
  { key: 'shares', label: 'Shares' },
  { key: 'saves', label: 'Saves' },
  { key: 'engagement', label: 'Engagement' }
];

const GHOST_CHIPS = ['Instagram', 'YouTube', 'TikTok', 'LinkedIn'];

export default function CombinedStatsGraph({ platformStats = [] }) {
  // Only include platforms that are actually connected (have a source != 'unavailable')
  const connectedPlatforms = useMemo(
    () => platformStats.filter(p => p.source !== 'unavailable'),
    [platformStats]
  );

  const [selectedPlatforms, setSelectedPlatforms] = useState(() => new Set());
  const [metric, setMetric] = useState('views');

  // Auto-select all connected platforms once data loads (or when new ones appear)
  useEffect(() => {
    if (connectedPlatforms.length === 0) return;
    setSelectedPlatforms(prev => {
      const next = new Set(prev);
      let changed = false;
      connectedPlatforms.forEach(p => {
        if (!next.has(p.platform)) { next.add(p.platform); changed = true; }
      });
      return changed ? next : prev;
    });
  }, [connectedPlatforms]);

  const filteredPlatforms = connectedPlatforms.filter(p => selectedPlatforms.has(p.platform));

  // Build chart data: one bar/point per selected platform
  const chartData = useMemo(() => {
    return filteredPlatforms.map(p => ({
      label: formatPlatform(p.platform),
      views: p.metrics?.views || 0,
      likes: p.metrics?.likes || 0,
      comments: p.metrics?.comments || 0,
      shares: p.metrics?.shares || 0,
      saves: p.metrics?.saves || 0,
      engagement:
        (p.metrics?.likes || 0) +
        (p.metrics?.comments || 0) +
        (p.metrics?.shares || 0) +
        (p.metrics?.saves || 0),
      value:
        (p.metrics?.views || 0) +
        (p.metrics?.likes || 0) +
        (p.metrics?.comments || 0) +
        (p.metrics?.shares || 0) +
        (p.metrics?.saves || 0)
    }));
  }, [filteredPlatforms, metric]);

  const togglePlatform = platform => {
    setSelectedPlatforms(prev => {
      const next = new Set(prev);
      next.has(platform) ? next.delete(platform) : next.add(platform);
      return next;
    });
  };

  const selectAll = () => setSelectedPlatforms(new Set(connectedPlatforms.map(p => p.platform)));
  const clearAll = () => setSelectedPlatforms(new Set());

  const metricLabel = METRIC_OPTIONS.find(m => m.key === metric)?.label || metric;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight text-[var(--text)]">Platform Analytics</h2>

          {/* Metric segmented control — was a native <select>. */}
          <div
            role="group"
            aria-label="Metric"
            className="flex gap-0.5 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-0.5"
          >
            {METRIC_OPTIONS.map(option => {
              const selected = metric === option.key;
              return (
                <button
                  key={option.key}
                  id={`stat-metric-${option.key}`}
                  type="button"
                  onClick={() => setMetric(option.key)}
                  aria-pressed={selected}
                  className={`focus-ring relative shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                    selected ? 'text-[var(--accent-fg)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {selected ? (
                    <motion.span
                      layoutId="stats-metric-pill"
                      className="absolute inset-0 rounded-lg bg-[var(--accent)]"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  ) : null}
                  <span className="relative">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {connectedPlatforms.length > 0 ? (
          <div className="mt-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-[var(--muted)]">Platforms</span>
              <AnimatedButton id="stats-select-all-platforms" size="xs" variant="ghost" onClick={selectAll}>
                <Check className="h-3 w-3" />
                All
              </AnimatedButton>
              <AnimatedButton id="stats-clear-platforms" size="xs" variant="ghost" onClick={clearAll}>
                <X className="h-3 w-3" />
                None
              </AnimatedButton>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {connectedPlatforms.map((p, i) => {
                const active = selectedPlatforms.has(p.platform);
                return (
                  <motion.button
                    key={p.platform}
                    id={`stats-platform-${p.platform}`}
                    type="button"
                    onClick={() => togglePlatform(p.platform)}
                    aria-pressed={active}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: i * 0.04 }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.95 }}
                    className={`focus-ring inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      active
                        ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]'
                        : 'border-[var(--border)] bg-[var(--surface2)] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)]'
                    }`}
                  >
                    {active ? <Check className="h-3 w-3" /> : null}
                    {formatPlatform(p.platform)}
                    <span className="opacity-60">{p.metrics?.postCount || 0}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Ghost chips keep the row's shape so the panel doesn't collapse into
             a lone sentence, and the CTA points at the actual next step. */
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-1.5">
              {GHOST_CHIPS.map((label, i) => (
                <motion.span
                  key={label}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.35, 0.7, 0.35] }}
                  transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.25, ease: 'easeInOut' }}
                  className="rounded-full border border-dashed border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted)]"
                >
                  {label}
                </motion.span>
              ))}
            </div>
            <AnimatedButton as="a" href="/accounts" size="sm" variant="primary" className="rounded-full">
              <RadioTower className="h-3.5 w-3.5" />
              Connect accounts
            </AnimatedButton>
            <p className="text-xs text-[var(--muted)]">
              Analytics appear once a connected account has published and synced.
            </p>
          </div>
        )}
      </div>

      <StatsChart
        data={chartData}
        metric={metric}
        title={`${metricLabel} — combined across selected platforms`}
        subtitle={
          filteredPlatforms.length > 0
            ? `${filteredPlatforms.length} platform${filteredPlatforms.length !== 1 ? 's' : ''}: ${filteredPlatforms.map(p => formatPlatform(p.platform)).join(', ')}`
            : 'Select at least one platform to display the chart.'
        }
      />
    </section>
  );
}
