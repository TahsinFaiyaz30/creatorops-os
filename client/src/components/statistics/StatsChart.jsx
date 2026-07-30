'use client';

import { useState, useRef, useEffect, useId } from 'react';

// ── helpers ──────────────────────────────────────────────────────────────────
const pad = { top: 24, right: 20, bottom: 56, left: 56 };

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

const fmt = n => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n));

// ── Bar chart ─────────────────────────────────────────────────────────────────
function BarChart({ data, width, height, metric, chartId }) {
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const max = Math.max(...data.map(d => d[metric] || 0), 1);
  const yTicks = ticks(max);
  const maxTick = yTicks[yTicks.length - 1];
  const barW = Math.max(8, (w / data.length) * 0.55);
  const gap = w / data.length;

  const COLORS = [
    '#22d3ee', '#a78bfa', '#34d399', '#f59e0b',
    '#f472b6', '#60a5fa', '#fb923c', '#818cf8',
  ];

  return (
    <svg width={width} height={height} aria-label="Bar chart">
      <defs>
        {data.map((d, i) => (
          <linearGradient key={`grad-${i}`} id={`${chartId}-bar-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS[i % COLORS.length]} stopOpacity="0.9" />
            <stop offset="100%" stopColor={COLORS[i % COLORS.length]} stopOpacity="0.35" />
          </linearGradient>
        ))}
      </defs>
      <g transform={`translate(${pad.left},${pad.top})`}>
        {/* grid lines */}
        {yTicks.map((tick, index) => {
          const y = h - (tick / maxTick) * h;
          return (
            <g key={`tick-${index}-${tick}`}>
              <line x1={0} y1={y} x2={w} y2={y} stroke="#334155" strokeWidth={0.5} strokeDasharray="4,4" />
              <text x={-8} y={y + 4} textAnchor="end" fontSize={10} fill="#64748b">{fmt(tick)}</text>
            </g>
          );
        })}

        {/* bars */}
        {data.map((d, i) => {
          const val = d[metric] || 0;
          const bh = Math.max(2, (val / maxTick) * h);
          const x = gap * i + (gap - barW) / 2;
          const y = h - bh;
          return (
            <g key={`bar-${i}`}>
              <rect
                x={x} y={y} width={barW} height={bh}
                rx={3} fill={`url(#${chartId}-bar-grad-${i})`}
              />
              {val > 0 && (
                <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={9} fill="#94a3b8">{fmt(val)}</text>
              )}
              <text
                x={gap * i + gap / 2}
                y={h + 18}
                textAnchor="middle"
                fontSize={10}
                fill="#94a3b8"
                transform={`rotate(-30, ${gap * i + gap / 2}, ${h + 18})`}
              >
                {d.label}
              </text>
            </g>
          );
        })}

        {/* axes */}
        <line x1={0} y1={0} x2={0} y2={h} stroke="#334155" strokeWidth={1} />
        <line x1={0} y1={h} x2={w} y2={h} stroke="#334155" strokeWidth={1} />
      </g>
    </svg>
  );
}

// ── Ogive (cumulative line) chart ─────────────────────────────────────────────
function OgiveChart({ data, width, height, metric, chartId }) {
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;

  const cumulative = [];
  let running = 0;
  for (const d of data) {
    running += d[metric] || 0;
    cumulative.push({ ...d, cum: running });
  }
  const maxVal = running || 1;
  const yTicks = ticks(maxVal);
  const maxTick = yTicks[yTicks.length - 1] || 1;

  const xOf = i => (i / Math.max(cumulative.length - 1, 1)) * w;
  const yOf = val => h - (val / maxTick) * h;

  const points = cumulative.map((d, i) => `${xOf(i)},${yOf(d.cum)}`).join(' ');

  // area fill path
  const areaPath = [
    `M ${xOf(0)},${h}`,
    ...cumulative.map((d, i) => `L ${xOf(i)},${yOf(d.cum)}`),
    `L ${xOf(cumulative.length - 1)},${h}`,
    'Z'
  ].join(' ');

  return (
    <svg width={width} height={height} aria-label="Ogive chart">
      <defs>
        <linearGradient id={`${chartId}-ogive-area`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.02" />
        </linearGradient>
        <filter id={`${chartId}-glow`}>
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g transform={`translate(${pad.left},${pad.top})`}>
        {/* grid */}
        {yTicks.map((tick, index) => {
          const y = yOf(tick);
          return (
            <g key={`tick-${index}-${tick}`}>
              <line x1={0} y1={y} x2={w} y2={y} stroke="#334155" strokeWidth={0.5} strokeDasharray="4,4" />
              <text x={-8} y={y + 4} textAnchor="end" fontSize={10} fill="#64748b">{fmt(tick)}</text>
            </g>
          );
        })}

        {/* area */}
        {cumulative.length > 1 && <path d={areaPath} fill={`url(#${chartId}-ogive-area)`} />}

        {/* line */}
        {cumulative.length > 1 && (
          <polyline
            points={points}
            fill="none"
            stroke="#22d3ee"
            strokeWidth={2.5}
            strokeLinejoin="round"
            filter={`url(#${chartId}-glow)`}
          />
        )}

        {/* dots */}
        {cumulative.map((d, i) => (
          <g key={`dot-${i}`}>
            <circle cx={xOf(i)} cy={yOf(d.cum)} r={4} fill="#0f172a" stroke="#22d3ee" strokeWidth={2} />
            {d.cum > 0 && (
              <text x={xOf(i)} y={yOf(d.cum) - 8} textAnchor="middle" fontSize={9} fill="#94a3b8">{fmt(d.cum)}</text>
            )}
            <text
              x={xOf(i)}
              y={h + 18}
              textAnchor="middle"
              fontSize={10}
              fill="#94a3b8"
              transform={`rotate(-30, ${xOf(i)}, ${h + 18})`}
            >
              {d.label}
            </text>
          </g>
        ))}

        {/* axes */}
        <line x1={0} y1={0} x2={0} y2={h} stroke="#334155" strokeWidth={1} />
        <line x1={0} y1={h} x2={w} y2={h} stroke="#334155" strokeWidth={1} />
      </g>
    </svg>
  );
}

// ── Public StatsChart ─────────────────────────────────────────────────────────
export default function StatsChart({ data = [], metric = 'value', title = '', subtitle = '' }) {
  const [view, setView] = useState('bar');
  const containerRef = useRef(null);
  const [width, setWidth] = useState(640);
  const chartId = useId().replace(/:/g, '');

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      setWidth(entries[0].contentRect.width || 640);
    });
    ro.observe(containerRef.current);
    setWidth(containerRef.current.offsetWidth || 640);
    return () => ro.disconnect();
  }, []);

  const height = 280;
  const hasData = data.length > 0;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {title && <h2 className="text-lg font-semibold text-[var(--text)]">{title}</h2>}
          {subtitle && <p className="mt-0.5 text-sm text-[var(--muted)]">{subtitle}</p>}
        </div>
        <div className="flex gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface2)] p-1">
          <button
            id="chart-toggle-bar"
            onClick={() => setView('bar')}
            className={`rounded-xl px-3 py-1 text-xs font-semibold transition-colors ${view === 'bar' ? 'bg-mint text-[var(--accent-fg)]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
          >
            Bar
          </button>
          <button
            id="chart-toggle-ogive"
            onClick={() => setView('ogive')}
            className={`rounded-xl px-3 py-1 text-xs font-semibold transition-colors ${view === 'ogive' ? 'bg-mint text-[var(--accent-fg)]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
          >
            Ogive
          </button>
        </div>
      </div>

      <div ref={containerRef} className="mt-4 w-full overflow-x-auto">
        {!hasData ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-[var(--muted)]">
            No connected platform data to display yet.
          </div>
        ) : view === 'bar' ? (
          <BarChart data={data} width={Math.max(width, data.length * 60)} height={height} metric={metric} chartId={chartId} />
        ) : (
          <OgiveChart data={data} width={Math.max(width, data.length * 60)} height={height} metric={metric} chartId={chartId} />
        )}
      </div>
    </div>
  );
}
