'use client';

import { useState, useMemo, useEffect } from 'react';
import { formatPlatform } from '../../lib/platforms';
import StatsChart from './StatsChart';

const METRIC_OPTIONS = [
  { key: 'views', label: 'Views' },
  { key: 'likes', label: 'Likes' },
  { key: 'comments', label: 'Comments' },
  { key: 'shares', label: 'Shares' },
  { key: 'saves', label: 'Saves' },
  { key: 'engagement', label: 'Engagement (combined)' },
];

const PLATFORM_COLORS = {
  facebook: '#3b82f6',
  instagram: '#f472b6',
  tiktok: '#22d3ee',
  youtube: '#f87171',
  youtube_shorts: '#fb923c',
  threads: '#a78bfa',
  linkedin: '#60a5fa',
  x: '#94a3b8',
  pinterest: '#f43f5e',
  wordpress: '#34d399',
  shopify: '#4ade80',
};

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
        (p.metrics?.saves || 0),
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
      {/* Controls row */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[var(--text)]">Platform Analytics</h2>

          {/* Metric selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="stat-metric-select" className="text-xs text-[var(--muted)]">Metric</label>
            <select
              id="stat-metric-select"
              value={metric}
              onChange={e => setMetric(e.target.value)}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-1.5 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-mint"
            >
              {METRIC_OPTIONS.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Platform filter chips */}
        {connectedPlatforms.length > 0 ? (
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-3">
              <span className="text-xs text-[var(--muted)]">Platforms</span>
              <button
                id="stats-select-all-platforms"
                onClick={selectAll}
                className="text-xs text-mint hover:underline"
              >
                All
              </button>
              <button
                id="stats-clear-platforms"
                onClick={clearAll}
                className="text-xs text-[var(--muted)] hover:text-[var(--text)]"
              >
                None
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {connectedPlatforms.map(p => {
                const active = selectedPlatforms.has(p.platform);
                const color = PLATFORM_COLORS[p.platform] || '#22d3ee';
                return (
                  <button
                    key={p.platform}
                    id={`stats-platform-${p.platform}`}
                    onClick={() => togglePlatform(p.platform)}
                    style={{
                      borderColor: active ? color : 'transparent',
                      background: active ? `${color}20` : 'transparent',
                      color: active ? color : '#64748b',
                      outline: `1px solid ${active ? color : '#334155'}`,
                    }}
                    className="rounded-full px-3 py-1 text-xs font-medium transition-all hover:opacity-80"
                  >
                    {formatPlatform(p.platform)}
                    <span className="ml-1.5 opacity-60">
                      {p.metrics?.postCount || 0} posts
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--muted)]">
            No connected platform accounts have synced data yet. Connect accounts and publish real posts to see analytics here.
          </p>
        )}
      </div>

      {/* Chart */}
      <StatsChart
        data={chartData}
        metric={metric}
        title={`${metricLabel} — Combined across selected platforms`}
        subtitle={
          filteredPlatforms.length > 0
            ? `Showing ${filteredPlatforms.length} platform${filteredPlatforms.length !== 1 ? 's' : ''}: ${filteredPlatforms.map(p => formatPlatform(p.platform)).join(', ')}`
            : 'Select at least one platform to display the chart.'
        }
      />
    </section>
  );
}
