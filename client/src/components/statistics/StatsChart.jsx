'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * StatsChart — one metric across platforms, as bars or a cumulative ogive.
 *
 * Two encoding defects fixed here:
 *
 *  1. Recolor-on-filter. Bars were coloured `COLORS[i % COLORS.length]` — by row
 *     index, not by entity. Deselecting one platform repainted every survivor,
 *     so a reader who learned "YouTube is cyan" was then misled.
 *  2. Hue spent on nothing. This is ONE measure across nominal categories, so
 *     eight rotating hues double-encoded bar length as colour and burned the
 *     only free channel on information the bar already shows. Identity is
 *     carried by the axis label.
 *
 *  Both resolve to the same fix: one series, one colour. The colour is
 *  `--viz-series-1`, a violet stepped for each surface — the UI accent itself
 *  (#a78bfa, L 0.709) sits above the dark chart band and failed validation.
 *
 * The empty state used to be a bare 280px box with one line of text in the
 * middle. It now renders a ghost plot so the panel keeps its shape and reads as
 * "nothing synced yet" rather than "broken".
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useRef, useEffect, useId } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

const pad = { top: 24, right: 20, bottom: 56, left: 56 };
const EASE = [0.16, 1, 0.3, 1];

const nice = n => {
  if (n === 0) return 1;
  const exp = Math.floor(Math.log10(n));
  const f = n / Math.pow(10, exp);
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * Math.pow(10, exp);
};

const ticks = (max, count = 5) => {
  const step = nice(max) / count;
  const decimals = step >= 1 ? 0 : Math.min(4, Math.ceil(Math.abs(Math.log10(step))) + 1);
  return Array.from({ length: count + 1 }, (_, i) => Number((step * i).toFixed(decimals))).filter(
    (tick, index, values) => index === 0 || tick !== values[index - 1]
  );
};

const fmt = n =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n);

/* ── Bar chart ────────────────────────────────────────────────────────────── */

function BarChart({ data, width, height, metric, chartId, onHover, hovered }) {
  const reduce = useReducedMotion();
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const max = Math.max(...data.map(d => d[metric] || 0), 1);
  const yTicks = ticks(max);
  const maxTick = yTicks[yTicks.length - 1];
  const gap = w / data.length;
  /* -2 keeps a 2px surface gap between adjacent bars. */
  const barW = Math.max(8, gap * 0.55 - 2);

  return (
    <svg width={width} height={height} role="img" aria-label={`${metric} by platform, bar chart`}>
      <defs>
        <linearGradient id={`${chartId}-bar`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--viz-series-1)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--viz-series-1)" stopOpacity="0.45" />
        </linearGradient>
      </defs>

      <g transform={`translate(${pad.left},${pad.top})`}>
        {yTicks.map((tick, index) => {
          const y = h - (tick / maxTick) * h;
          return (
            <g key={`tick-${index}-${tick}`}>
              <line x1={0} y1={y} x2={w} y2={y} stroke="var(--viz-grid)" strokeWidth={1} />
              <text x={-10} y={y + 4} textAnchor="end" fontSize={10} fill="var(--muted)">
                {fmt(tick)}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const value = d[metric] || 0;
          const bh = (value / maxTick) * h;
          const x = i * gap + (gap - barW) / 2;
          const active = hovered === i;
          return (
            <g key={d.label}>
              {/* Hit target spans the whole slot, not just the bar. */}
              <rect
                x={i * gap}
                y={0}
                width={gap}
                height={h}
                fill="transparent"
                onMouseEnter={() => onHover(i)}
                onMouseLeave={() => onHover(null)}
              />
              <motion.rect
                x={x}
                width={barW}
                rx={4}
                fill={`url(#${chartId}-bar)`}
                initial={reduce ? false : { y: h, height: 0 }}
                animate={{ y: h - bh, height: bh }}
                transition={{ duration: 0.7, ease: EASE, delay: i * 0.05 }}
                style={{ 
                  opacity: hovered === null || active ? 1 : 0.45,
                  filter: active ? 'drop-shadow(0 0 12px var(--glow))' : 'none'
                }}
                pointerEvents="none"
              />
              <text
                x={i * gap + gap / 2}
                y={h + 20}
                textAnchor="middle"
                fontSize={10}
                fill={active ? 'var(--text)' : 'var(--muted)'}
              >
                {d.label}
              </text>
              {/* Direct label on the data-end — the relief rule, and it removes
                  the need to read a value off the axis. */}
              <text
                x={i * gap + gap / 2}
                y={h - bh - 7}
                textAnchor="middle"
                fontSize={10}
                fontWeight={700}
                fill="var(--text)"
              >
                {fmt(value)}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/* ── Ogive (cumulative) ───────────────────────────────────────────────────── */

function OgiveChart({ data, width, height, metric, chartId, onHover, hovered }) {
  const reduce = useReducedMotion();
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;

  let running = 0;
  const points = data.map((d, i) => {
    running += d[metric] || 0;
    return { label: d.label, cumulative: running, i };
  });

  const max = Math.max(running, 1);
  const yTicks = ticks(max);
  const maxTick = yTicks[yTicks.length - 1];
  const step = points.length > 1 ? w / (points.length - 1) : w;

  const xy = p => ({ x: p.i * step, y: h - (p.cumulative / maxTick) * h });
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xy(p).x},${xy(p).y}`).join(' ');
  const area = `${line} L${xy(points[points.length - 1]).x},${h} L${xy(points[0]).x},${h} Z`;

  return (
    <svg width={width} height={height} role="img" aria-label={`cumulative ${metric}, ogive chart`}>
      <defs>
        <linearGradient id={`${chartId}-area`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--viz-series-1)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--viz-series-1)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <g transform={`translate(${pad.left},${pad.top})`}>
        {yTicks.map((tick, index) => {
          const y = h - (tick / maxTick) * h;
          return (
            <g key={`tick-${index}-${tick}`}>
              <line x1={0} y1={y} x2={w} y2={y} stroke="var(--viz-grid)" strokeWidth={1} />
              <text x={-10} y={y + 4} textAnchor="end" fontSize={10} fill="var(--muted)">
                {fmt(tick)}
              </text>
            </g>
          );
        })}

        <motion.path
          d={area}
          fill={`url(#${chartId}-area)`}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.2 }}
        />
        <motion.path
          d={line}
          fill="none"
          stroke="var(--viz-series-1)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: EASE }}
        />

        {points.map(p => {
          const { x, y } = xy(p);
          const active = hovered === p.i;
          return (
            <g key={p.label}>
              <rect
                x={x - step / 2}
                y={0}
                width={step}
                height={h}
                fill="transparent"
                onMouseEnter={() => onHover(p.i)}
                onMouseLeave={() => onHover(null)}
              />
              {active ? <line x1={x} y1={0} x2={x} y2={h} stroke="var(--viz-grid)" strokeWidth={1} /> : null}
              {/* 2px surface ring keeps markers legible where the line crosses. */}
              <circle
                cx={x}
                cy={y}
                r={active ? 6 : 4}
                fill="var(--viz-series-1)"
                stroke="var(--surface)"
                strokeWidth={2}
                pointerEvents="none"
              />
              <text x={x} y={h + 20} textAnchor="middle" fontSize={10} fill={active ? 'var(--text)' : 'var(--muted)'}>
                {p.label}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/* ── Empty state: a ghost plot, not a blank box ───────────────────────────── */

const GHOST = [0.45, 0.7, 0.32, 0.86, 0.55, 0.62, 0.4];

function GhostPlot({ height }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative overflow-hidden rounded-xl" style={{ height }}>
      <div aria-hidden className="absolute inset-0 flex items-end justify-around gap-2 px-6 pb-10 pt-6">
        {GHOST.map((fraction, i) => (
          <motion.div
            key={i}
            className="w-full max-w-[42px] rounded-t-[4px] bg-[var(--surface3)]"
            initial={reduce ? false : { height: 0 }}
            animate={{ height: `${fraction * 100}%` }}
            transition={{ duration: 0.8, ease: EASE, delay: i * 0.06 }}
          />
        ))}
      </div>

      {!reduce ? (
        <motion.div
          aria-hidden
          className="absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-[var(--surface)]/70 to-transparent"
          animate={{ x: ['-30%', '430%'] }}
          transition={{ duration: 3.4, repeat: Infinity, repeatDelay: 1.2, ease: 'easeInOut' }}
        />
      ) : null}

      <div className="absolute inset-0 flex items-center justify-center">
        <p className="rounded-full border border-[var(--border)] bg-[var(--surface)]/85 px-4 py-1.5 text-xs text-[var(--muted)] backdrop-blur-md">
          No synced platform data yet
        </p>
      </div>
    </div>
  );
}

/* ── Public ───────────────────────────────────────────────────────────────── */

const VIEWS = [
  { key: 'bar', label: 'Bar' },
  { key: 'ogive', label: 'Ogive' }
];

export default function StatsChart({ data = [], metric = 'views', title, subtitle }) {
  const [view, setView] = useState('bar');
  const [hovered, setHovered] = useState(null);
  const [width, setWidth] = useState(640);
  const containerRef = useRef(null);
  const chartId = useId().replace(/:/g, '');

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => setWidth(entries[0].contentRect.width || 640));
    ro.observe(containerRef.current);
    setWidth(containerRef.current.offsetWidth || 640);
    return () => ro.disconnect();
  }, []);

  const height = 280;
  const hasData = data.length > 0;
  const active = hovered !== null ? data[hovered] : null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {title ? <h2 className="text-base font-semibold tracking-tight text-[var(--text)]">{title}</h2> : null}
          {subtitle ? <p className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p> : null}
        </div>

        <div className="flex gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-0.5">
          {VIEWS.map(option => {
            const selected = view === option.key;
            return (
              <button
                key={option.key}
                id={`chart-toggle-${option.key}`}
                type="button"
                onClick={() => setView(option.key)}
                aria-pressed={selected}
                className={`focus-ring relative rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                  selected ? 'text-[var(--accent-fg)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                {selected ? (
                  <motion.span
                    layoutId={`${chartId}-view-pill`}
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

      <div ref={containerRef} className="relative mt-4 w-full overflow-x-auto">
        {!hasData ? (
          <GhostPlot height={height} />
        ) : view === 'bar' ? (
          <BarChart
            data={data}
            width={Math.max(width, data.length * 72)}
            height={height}
            metric={metric}
            chartId={chartId}
            hovered={hovered}
            onHover={setHovered}
          />
        ) : (
          <OgiveChart
            data={data}
            width={Math.max(width, data.length * 72)}
            height={height}
            metric={metric}
            chartId={chartId}
            hovered={hovered}
            onHover={setHovered}
          />
        )}

        <AnimatePresence>
          {active ? (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.95 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="pointer-events-none absolute right-3 top-3 rounded-xl border border-[var(--border-strong)] bg-[var(--surface)]/95 px-4 py-3 shadow-2xl backdrop-blur-xl"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text)]">{active.label}</p>
              
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2">
                {Object.keys(active)
                  .filter(k => !['label', 'value', 'i', 'cumulative'].includes(k))
                  .map(m => (
                  <div key={m} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${m === metric ? 'bg-[var(--viz-series-1)]' : 'bg-[var(--surface3)]'}`} />
                      <span className={`text-[10px] capitalize ${m === metric ? 'font-medium text-[var(--text)]' : 'text-[var(--muted)]'}`}>{m}</span>
                    </div>
                    <span className={`text-xs tabular-nums font-semibold ${m === metric ? 'text-[var(--text)]' : 'text-[var(--text-2)]'}`}>
                      {fmt(active[m] || 0)}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
