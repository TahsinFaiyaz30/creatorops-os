'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * AuthSplitShell — signup only.
 *
 * One floating panel on the existing night-sky background, split into a form
 * column and a product-surface column. Sign-in keeps the original two-column
 * page (see auth-shell.jsx); this shell is deliberately separate so changing
 * one screen can never disturb the other.
 *
 *   left   — brand pill, centred heading, the form, footer links
 *   right  — the live state of the instance, read from GET /api/public/stats
 *
 * The right column used to be theatre: a fixed calendar week around the 25th, a
 * progress bar looping forever, and seven hardcoded feed rows ("Comment synced ·
 * 41 new"). It now shows counts this deployment actually holds — creators,
 * brands, published posts, what is in the publish queue right now, and the last
 * few real workflow events. If the instance is empty the panel says so rather
 * than inventing traffic.
 *
 * Nothing identifying comes back from that endpoint: the server sends counts and
 * stage names only, never a name, a workspace or a caption.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion, cubicBezier, useReducedMotion } from 'motion/react';
import { IconCheck } from '@tabler/icons-react';

import { AuroraBackground } from '@/components/ui/aurora-background';
import { StarsBackground } from '@/components/ui/stars-background';
import { ShootingStars } from '@/components/ui/shooting-stars';
import { Spotlight } from '@/components/ui/spotlight-new';
import { cn } from '@/lib/utils';
import { api } from '../../lib/api';
import { formatPlatform } from '../../lib/platforms';

const easeOutExpo = cubicBezier(0.16, 1, 0.3, 1);

const PILLARS = [
  'AI multi-platform generation',
  'Creator review with real RBAC',
  'Live OAuth connections',
  'Pre-flight publish validation'
];

const compact = value => {
  const n = Number(value) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
};

const relativeTime = value => {
  const then = new Date(value).getTime();
  if (!then) return '';
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return 'now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
};

const stage = {
  hidden: {},
  visible: { transition: { delayChildren: 0.25, staggerChildren: 0.07 } }
};

const feedVariants = {
  hidden: {},
  visible: { transition: { delayChildren: 0.85, staggerChildren: 0.09 } }
};

const feedItem = {
  hidden: { opacity: 0, x: 18 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: easeOutExpo } }
};

const rise = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: easeOutExpo } }
};

/* ── Right side: the instance, live ───────────────────────────────────────── */

function StatTile({ label, value, hint, loading }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/60 px-3 py-2.5 backdrop-blur-md">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{label}</p>
      {loading ? (
        <span className="mt-1.5 block h-6 w-12 animate-pulse rounded bg-[var(--surface3)]" />
      ) : (
        <p className="mt-0.5 text-xl font-bold tabular-nums tracking-tight text-[var(--text)]">{value}</p>
      )}
      {hint ? <p className="truncate text-[10px] text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

function ShowcasePanel() {
  const reduce = useReducedMotion();
  const [stats, setStats] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = () =>
      api
        .get('/api/public/stats')
        .then(payload => {
          if (cancelled) return;
          setStats(payload?.data?.stats || null);
          setFailed(false);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });

    load();
    /* Refreshed while the page is open — the queue count is the one number here
       that moves minute to minute, and the endpoint is cached for 30s anyway. */
    const timer = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const loading = !stats && !failed;
  const empty = Boolean(stats?.available) && stats.publishedPosts === 0 && (stats.recent || []).length === 0;
  const topPlatforms = (stats?.platforms || []).slice(0, 4);
  const busiest = topPlatforms[0]?.posts || 0;

  return (
    <motion.div
      variants={rise}
      className="relative hidden h-full overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--surface2)] lg:block"
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(120%_90%_at_20%_0%,rgb(var(--accent-rgb)/0.30),transparent_60%),radial-gradient(90%_80%_at_100%_100%,rgba(174,72,255,0.22),transparent_65%)]"
      />
      <div aria-hidden className="absolute inset-0 bg-blueprint opacity-[0.35]" />

      <div className="relative flex h-full flex-col gap-3 p-5">
        {/* What the instance is doing right now. */}
        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easeOutExpo, delay: 0.3 }}
          className="flex items-center justify-between gap-4 rounded-2xl bg-[var(--accent)] px-4 py-3 text-[var(--accent-fg)] shadow-[0_18px_40px_-18px_var(--glow)]"
        >
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[13px] font-semibold">
              {stats?.publishingNow ? 'Publishing right now' : 'Publish queue is clear'}
              <span className="relative flex h-1.5 w-1.5">
                {!reduce && stats?.publishingNow ? (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent-fg)] opacity-60" />
                ) : null}
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--accent-fg)]" />
              </span>
            </p>
            <p className="mt-0.5 truncate text-[11px] opacity-75">
              {loading
                ? 'Reading live workspace state…'
                : failed
                  ? 'Live numbers are unavailable right now'
                  : `${compact(stats?.publishedToday || 0)} published in the last 24 hours`}
            </p>
          </div>
          <span className="shrink-0 text-2xl font-bold tabular-nums">
            {loading ? '—' : compact(stats?.publishingNow || 0)}
          </span>
        </motion.div>

        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Creators" value={compact(stats?.creators)} loading={loading} />
          <StatTile label="Brands" value={compact(stats?.brands)} loading={loading} />
          <StatTile
            label="Posts published"
            value={compact(stats?.publishedPosts)}
            hint="Through real platform APIs"
            loading={loading}
          />
          <StatTile
            label="Connected accounts"
            value={compact(stats?.connectedAccounts)}
            hint="Live OAuth connections"
            loading={loading}
          />
        </div>

        {/* Where those posts went. Bars are proportional to the real counts. */}
        {topPlatforms.length > 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/55 p-3 backdrop-blur-md">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Published by platform
            </p>
            <ul className="mt-2 space-y-1.5">
              {topPlatforms.map(entry => (
                <li key={entry.platform} className="flex items-center gap-2.5">
                  <span className="w-20 shrink-0 truncate text-[11px] text-[var(--text-2)]">
                    {formatPlatform(entry.platform)}
                  </span>
                  <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--surface3)]">
                    <motion.span
                      className="block h-full rounded-full bg-[var(--accent)]"
                      initial={{ width: 0 }}
                      animate={{ width: `${busiest ? Math.max(6, (entry.posts / busiest) * 100) : 0}%` }}
                      transition={{ duration: 0.7, ease: easeOutExpo }}
                    />
                  </span>
                  <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-[var(--muted)]">
                    {compact(entry.posts)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Real workflow events, stage names only. */}
        <motion.ul
          variants={feedVariants}
          initial="hidden"
          animate="visible"
          className="flex min-h-0 flex-1 flex-col justify-start gap-1.5 overflow-hidden"
        >
          {loading
            ? Array.from({ length: 5 }).map((_, index) => (
                <li
                  key={index}
                  className="h-8 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)]/40"
                />
              ))
            : (stats?.recent || []).map((entry, index) => (
                <motion.li
                  key={`${entry.label}-${entry.at}-${index}`}
                  variants={feedItem}
                  className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)]/55 px-3 py-2 backdrop-blur-md"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[var(--text-2)]">
                    {entry.label}
                  </span>
                  <span className="shrink-0 text-[10px] tabular-nums text-[var(--muted)]">
                    {relativeTime(entry.at)}
                  </span>
                </motion.li>
              ))}

          {empty ? (
            <li className="rounded-xl border border-dashed border-[var(--border)] px-3 py-4 text-center text-[11px] leading-relaxed text-[var(--muted)]">
              Nothing has shipped here yet. Create the first account and this
              panel fills in with your own numbers.
            </li>
          ) : null}

          {failed ? (
            <li className="rounded-xl border border-dashed border-[var(--border)] px-3 py-4 text-center text-[11px] text-[var(--muted)]">
              Could not reach the API for live numbers.
            </li>
          ) : null}
        </motion.ul>

        <p className="text-center text-[10px] text-[var(--muted)]">
          {stats?.generatedAt && !failed
            ? (t => `Live from this deployment · updated ${t === 'now' ? 'just now' : `${t} ago`}`)(
                relativeTime(stats.generatedAt)
              )
            : 'Live from this deployment'}
        </p>
      </div>
    </motion.div>
  );
}

/* ── The floating panel ───────────────────────────────────────────────────── */

/*
 * Static, deliberately — the signup card no longer tilts to the cursor. A form
 * whose fields drift while you aim at them is harder to fill in than one that
 * holds still, and the whole page rocked whenever the pointer crossed it.
 */
function Panel({ children }) {
  return (
    <div className="relative z-10 w-full max-w-6xl">
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.85, ease: easeOutExpo }}
        className="relative overflow-hidden rounded-[36px] border border-[var(--border)] bg-[var(--surface)]/80 p-2 shadow-[0_50px_130px_-40px_rgba(0,0,0,0.9)] backdrop-blur-2xl sm:p-3"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-16 top-0 z-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/70 to-transparent"
        />
        <div className="relative z-10 grid gap-3 lg:grid-cols-[1fr_1.05fr]">{children}</div>
      </motion.div>
    </div>
  );
}

/* ── Public shell ─────────────────────────────────────────────────────────── */

export function AuthSplitShell({ title, subtitle, children, footer }) {
  return (
    /* AuroraBackground renders a plain <div> with no `as` escape hatch, so the
       <main> landmark lives here — otherwise the document has none at all and
       there is nothing for a screen reader to skip to.
       `h-auto` overrides its hardcoded h-[100vh], which would otherwise clip the
       panel on short viewports instead of letting the page scroll. */
    <main>
      <AuroraBackground className="relative h-auto min-h-screen w-full items-center justify-center overflow-hidden bg-[var(--bg)] px-4 py-4 dark:bg-[var(--bg)]">
        <StarsBackground className="absolute inset-0 z-0" starDensity={0.00012} />
        <ShootingStars
          starColor="#AE48FF"
          trailColor="#6344F5"
          minDelay={1400}
          maxDelay={3600}
          className="absolute inset-0 z-0"
        />
        <Spotlight
          gradientFirst="radial-gradient(68.54% 68.72% at 55.02% 31.46%, hsla(268, 100%, 70%, 0.10) 0, hsla(268, 100%, 55%, 0.04) 50%, transparent 80%)"
          translateY={-300}
          duration={10}
        />

        <Panel>
          {/* Left: form column */}
          <motion.div
            variants={stage}
            initial="hidden"
            animate="visible"
            className="flex flex-col justify-between px-5 py-4 sm:px-7 sm:py-4"
          >
            <motion.div variants={rise}>
              <Link
                href="/"
                className="focus-ring inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface2)] px-3.5 py-1.5 transition-colors hover:border-[var(--accent-line)]"
              >
                <img src="/logo.jpeg" alt="" width={18} height={18} className="rounded-md" />
                <span className="text-xs font-semibold tracking-tight text-[var(--text)]">
                  CreatorOps&nbsp;OS
                </span>
              </Link>
            </motion.div>

            <div className="py-4">
              <motion.h1
                variants={rise}
                className="text-center text-2xl font-bold tracking-tight text-[var(--text)]"
              >
                {title}
              </motion.h1>
              <motion.p variants={rise} className="mt-1 text-center text-[13px] text-[var(--muted)]">
                {subtitle}
              </motion.p>

              <motion.div variants={rise} className="mt-4">
                {children}
              </motion.div>

              {footer ? <motion.div variants={rise}>{footer}</motion.div> : null}
            </div>

            <motion.ul variants={rise} className="flex flex-wrap gap-x-4 gap-y-1.5">
              {PILLARS.map(pillar => (
                <li key={pillar} className="flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
                  <IconCheck className="h-2.5 w-2.5 text-[var(--accent)]" />
                  {pillar}
                </li>
              ))}
            </motion.ul>
          </motion.div>

          {/* Right: product surface */}
          <motion.div variants={stage} initial="hidden" animate="visible" className="min-h-[420px] lg:min-h-0">
            <ShowcasePanel />
          </motion.div>
        </Panel>
      </AuroraBackground>
    </main>
  );
}
