'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Applicant analytics — the shared read-out of a creator's cross-platform means.
 *
 * The server averages over the circular's required platforms only, so every
 * applicant to the same circular is measured against the same denominator. This
 * renders that payload three ways from one source of truth: mean tiles, a
 * per-platform bar chart with the mean drawn on it, and a window timeline.
 *
 * A metric a platform never returned is null, not zero, and stays visibly
 * unknown here — a brand must be able to tell "no followers" from "the API
 * would not say".
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Users, Eye, Heart, MessageSquare, Share2, Percent, FileStack, Info } from 'lucide-react';

import { formatPlatform } from '../../lib/platforms';

const EASE = [0.16, 1, 0.3, 1];

export const compactNumber = value => {
  if (value === null || value === undefined) return '—';
  const n = Number(value) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(n * 100) / 100);
};

export const CHART_METRICS = [
  { id: 'followers', label: 'Followers', icon: Users },
  { id: 'views', label: 'Views', icon: Eye },
  { id: 'engagement', label: 'Engagement', icon: Heart },
  { id: 'likes', label: 'Likes', icon: Heart },
  { id: 'comments', label: 'Comments', icon: MessageSquare },
  { id: 'shares', label: 'Shares', icon: Share2 }
];

/* ── Mean tiles ───────────────────────────────────────────────────────────── */

export function MeanTiles({ statistics, className = '' }) {
  const mean = statistics?.mean || {};
  const platformCount = statistics?.platformCount || 0;
  const followerPlatformCount = statistics?.followerPlatformCount || 0;

  const tiles = [
    {
      key: 'followers',
      label: 'Followers mean',
      icon: Users,
      value: mean.followers === null || mean.followers === undefined ? '—' : compactNumber(mean.followers),
      hint:
        mean.followers === null || mean.followers === undefined
          ? 'No platform returned a follower count'
          : `Across ${followerPlatformCount} of ${platformCount} platform${platformCount === 1 ? '' : 's'}`
    },
    {
      key: 'views',
      label: 'Views mean',
      icon: Eye,
      value: compactNumber(mean.views),
      hint: `Per platform · last ${statistics?.windowDays ?? 30}d`
    },
    {
      key: 'engagement',
      label: 'Engagement mean',
      icon: Heart,
      value: compactNumber(mean.engagement),
      hint: 'Likes + comments + shares + saves'
    },
    {
      key: 'engagementRate',
      label: 'Engagement rate',
      icon: Percent,
      value: `${mean.engagementRate ?? 0}%`,
      hint: 'Engagement over views in window'
    },
    {
      key: 'posts',
      label: 'Posts mean',
      icon: FileStack,
      value: compactNumber(mean.posts),
      hint: `${statistics?.totals?.postCount ?? 0} in window`
    }
  ];

  return (
    <div className={`grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 ${className}`}>
      {tiles.map((tile, index) => (
        <motion.div
          key={tile.key}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE, delay: index * 0.04 }}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface2)]/70 px-3 py-2.5"
        >
          <span className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            <tile.icon className="h-3 w-3" />
            {tile.label}
          </span>
          <p className="mt-1 text-xl font-bold tabular-nums tracking-tight text-[var(--text)]">{tile.value}</p>
          <p className="mt-0.5 truncate text-[10px] text-[var(--muted)]" title={tile.hint}>
            {tile.hint}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

/* ── Per-platform bars, with the mean drawn across them ───────────────────── */

export function PlatformMeanChart({ statistics, defaultMetric = 'views' }) {
  const [metric, setMetric] = useState(defaultMetric);
  const perPlatform = statistics?.perPlatform || [];

  const rows = useMemo(
    () =>
      perPlatform.map(item => ({
        platform: item.platform,
        label: item.label || formatPlatform(item.platform),
        value: item[metric],
        unavailableReason: metric === 'followers' ? item.followersUnavailableReason : ''
      })),
    [perPlatform, metric]
  );

  const known = rows.filter(row => typeof row.value === 'number');
  const max = Math.max(...known.map(row => row.value), 1);
  const meanValue = statistics?.mean?.[metric];
  const hasMean = typeof meanValue === 'number';
  const anyData = known.some(row => row.value > 0);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-4 backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight text-[var(--text)]">Per-platform vs. mean</h3>
          <p className="mt-0.5 text-[10px] text-[var(--muted)]">
            {statistics?.commonPlatforms?.length || 0} required platform
            {(statistics?.commonPlatforms?.length || 0) === 1 ? '' : 's'} · window{' '}
            {statistics?.windowStart ? new Date(statistics.windowStart).toLocaleDateString() : '—'} →{' '}
            {statistics?.windowEnd ? new Date(statistics.windowEnd).toLocaleDateString() : '—'}
          </p>
        </div>

        <div className="flex flex-wrap gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface2)] p-0.5">
          {CHART_METRICS.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMetric(item.id)}
              aria-pressed={metric === item.id}
              className={`focus-ring relative rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${
                metric === item.id ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              {metric === item.id ? (
                <motion.span
                  layoutId="applicant-chart-metric"
                  className="absolute inset-0 rounded-md bg-[var(--accent-soft)]"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              ) : null}
              <span className="relative">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {hasMean ? (
        <p className="mt-3 flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
          <span className="inline-block h-3 w-0 border-l border-dashed border-[var(--accent)]" aria-hidden />
          Dashed marker on each bar = mean{' '}
          <span className="font-bold tabular-nums text-[var(--accent)]">{compactNumber(meanValue)}</span>
        </p>
      ) : null}

      <div className="mt-2 space-y-2">
        {rows.map((row, index) => (
          <div key={row.platform} className="flex items-center gap-2">
            <span className="w-28 shrink-0 truncate text-[10px] font-semibold text-[var(--text-2)]">{row.label}</span>
            {/* Mean marker lives inside each track, so its position is exact. */}
            <div className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--surface3)]">
              {typeof row.value === 'number' ? (
                <motion.div
                  key={`${row.platform}-${metric}`}
                  className="h-full rounded-full bg-[var(--accent)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${(row.value / max) * 100}%` }}
                  transition={{ duration: 0.55, ease: EASE, delay: index * 0.05 }}
                />
              ) : (
                <div className="h-full w-full bg-[repeating-linear-gradient(45deg,var(--surface3)_0_6px,var(--surface2)_6px_12px)]" />
              )}
              {hasMean && anyData ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 border-l border-dashed border-[var(--text)]/60"
                  style={{ left: `${Math.min((meanValue / max) * 100, 100)}%` }}
                />
              ) : null}
            </div>
            <span className="w-14 shrink-0 text-right text-[10px] font-bold tabular-nums text-[var(--text)]">
              {typeof row.value === 'number' ? compactNumber(row.value) : '—'}
            </span>
          </div>
        ))}
        {rows.length === 0 ? <p className="text-[11px] text-[var(--muted)]">No platforms to compare.</p> : null}
      </div>

      {rows.some(row => typeof row.value !== 'number') ? (
        <div className="mt-3 space-y-1 border-t border-[var(--border)] pt-2.5">
          {rows
            .filter(row => typeof row.value !== 'number')
            .map(row => (
              <p key={row.platform} className="flex items-start gap-1.5 text-[10px] leading-relaxed text-[var(--muted)]">
                <Info className="mt-0.5 h-2.5 w-2.5 shrink-0 text-warning" />
                <span>
                  <span className="font-semibold text-[var(--text-2)]">{row.label}:</span>{' '}
                  {row.unavailableReason || 'the platform did not return this number.'}
                </span>
              </p>
            ))}
        </div>
      ) : null}

      {!anyData ? (
        <p className="mt-3 text-[10px] leading-relaxed text-[var(--muted)]">
          {statistics?.unavailableMessage ||
            'No values returned for this metric yet — bars only ever show what a platform API actually sent back.'}
        </p>
      ) : null}
    </div>
  );
}

/* ── Window timeline ──────────────────────────────────────────────────────── */

export function WindowTimeline({ statistics, metric = 'views' }) {
  const points = useMemo(
    () =>
      [...(statistics?.timeline || [])]
        .map(point => ({ ...point, t: new Date(point.at || 0).getTime() }))
        .sort((a, b) => a.t - b.t),
    [statistics]
  );

  if (points.length < 2) {
    return (
      <p className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-[10px] leading-relaxed text-[var(--muted)]">
        {points.length === 0
          ? `No synced posts inside the last ${statistics?.windowDays ?? 30} days, so there is no series to plot.`
          : 'Only one synced post in the window — a line needs at least two.'}
      </p>
    );
  }

  const width = 560;
  const height = 120;
  const padX = 6;
  const padY = 10;
  const values = points.map(point => Number(point[metric]) || 0);
  const maxV = Math.max(...values);
  const minV = Math.min(...values);
  const span = maxV - minV || 1;

  const x = index => padX + (index / (points.length - 1)) * (width - padX * 2);
  const y = value => height - padY - ((value - minV) / span) * (height - padY * 2);

  const line = values.map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${height} L${x(0).toFixed(1)},${height} Z`;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface2)]/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          {metric} per post · {points.length} synced posts in window
        </span>
        <span className="text-[10px] font-bold tabular-nums text-[var(--text-2)]">
          peak {compactNumber(maxV)}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-2 h-24 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${metric} across ${points.length} posts in the window`}
      >
        <defs>
          <linearGradient id={`applicant-trend-${metric}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path
          d={area}
          fill={`url(#applicant-trend-${metric})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: EASE }}
        />
        <motion.path
          d={line}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, ease: EASE }}
        />
      </svg>

      <div className="flex items-center justify-between text-[9px] tabular-nums text-[var(--muted)]">
        <span>{new Date(points[0].t).toLocaleDateString()}</span>
        <span>{new Date(points[points.length - 1].t).toLocaleDateString()}</span>
      </div>
    </div>
  );
}
