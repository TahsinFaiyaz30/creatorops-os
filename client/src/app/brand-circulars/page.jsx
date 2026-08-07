'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Brand Circulars — GET /api/brand-circulars, POST /:id/{publish,close,archive},
 * GET /api/brand-circulars/:id/applications (brand rep), GET /api/applications
 *
 * Two things the old card claimed but never had:
 *
 *  1. It read `circular.description || circular.brief`. Neither field exists on
 *     BrandCircular — the field is `productDescription` — so every card printed
 *     "No description provided."
 *  2. It read `applicationCount` / `applicationsCount`. Neither exists in the
 *     list payload either, so "N applied" was hardcoded 0 on every circular and
 *     the Applicants stat could never move. Real counts are fetched per circular
 *     for brand reps; creators get their own application state instead.
 *
 * The rest of the model was simply unused: productName, category, audience,
 * objective, deliverables, contentFormats, deadline, budget, eligibility,
 * demands, judging criteria, cover media and the brand rep behind it.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import {
  Plus, BriefcaseBusiness, Send, Lock, Archive, Users, ArrowUpRight, CircleDot,
  Wallet, CalendarClock, Search, Film, Image as ImageIcon, Clapperboard,
  Layers3, ImageOff, Building2, Target, CheckCheck, Loader2, TrendingUp
} from 'lucide-react';

import AppShell from '../../components/layout/AppShell';
import { TextGenerateEffect } from '../../components/ui/text-generate-effect';
import { BackgroundBeams } from '../../components/ui/background-beams';
import {
  Page, Section, Badge, Button, Input,
  EmptyState, Skeleton, GlareStat, GlareStatGrid, GLARE_TINTS
} from '../../components/ds';
import { api } from '../../lib/api';
import { getUser } from '../../lib/auth';
import { isBrandRep } from '../../lib/roles';
import { formatPlatform } from '../../lib/platforms';
import { useToastState } from '../../components/ui/toast';

const EASE = [0.16, 1, 0.3, 1];

const STATUS_TONE = { published: 'success', draft: 'neutral', closed: 'warning', archived: 'neutral' };

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'published', label: 'Open' },
  { id: 'draft', label: 'Draft' },
  { id: 'closed', label: 'Closed' },
  { id: 'archived', label: 'Archived' }
];

const DELIVERABLES = [
  { key: 'reels', label: 'Reels', icon: Film },
  { key: 'posts', label: 'Posts', icon: ImageIcon },
  { key: 'stories', label: 'Stories', icon: Layers3 },
  { key: 'videos', label: 'Videos', icon: Clapperboard }
];

/* Real enum is draft → published → closed → archived. */
const nextAction = status => {
  if (!status || status === 'draft') return { key: 'publish', label: 'Publish', Icon: Send, tone: 'primary' };
  if (status === 'published') return { key: 'close', label: 'Close', Icon: Lock, tone: 'secondary' };
  if (status === 'closed') return { key: 'archive', label: 'Archive', Icon: Archive, tone: 'ghost' };
  return null;
};

const idOf = item => String(item?._id || item?.id || '');

const money = (amount, currency) => {
  const value = Number(amount) || 0;
  if (!value) return 'Unpaid';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0
    }).format(value);
  } catch {
    return `${currency || 'USD'} ${value.toLocaleString()}`;
  }
};

const daysLeft = deadline => {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
};

const totalDeliverables = deliverables =>
  DELIVERABLES.reduce((sum, d) => sum + (Number(deliverables?.[d.key]) || 0), 0);

/* ── Dynamic chart ────────────────────────────────────────────────────────── */

const CHART_METRICS = [
  { id: 'budget', label: 'Budget', icon: Wallet },
  { id: 'deliverables', label: 'Deliverables', icon: Film },
  { id: 'applicants', label: 'Applicants', icon: Users },
  { id: 'deadline', label: 'Days left', icon: CalendarClock }
];

const chartValue = (circular, metric, applicantCount) => {
  if (metric === 'budget') return Number(circular.budgetAmount) || 0;
  if (metric === 'deliverables') return totalDeliverables(circular.deliverables);
  if (metric === 'applicants') return applicantCount;
  const left = daysLeft(circular.deadline);
  return left === null ? 0 : Math.max(0, left);
};

const formatChartValue = (value, metric, currency) => {
  if (metric === 'budget') return money(value, currency);
  if (metric === 'deadline') return value === 0 ? 'due' : `${value}d`;
  return String(value);
};

function CircularChart({ circulars, applicants, metric, onMetric }) {
  const rows = circulars
    .map(circular => ({
      id: idOf(circular),
      label: circular.title || circular.productName || 'Untitled',
      currency: circular.currency,
      status: circular.status || 'draft',
      value: chartValue(circular, metric, applicants[idOf(circular)] ?? 0)
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const max = Math.max(...rows.map(row => row.value), 1);
  const anyData = rows.some(row => row.value > 0);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const active = CHART_METRICS.find(m => m.id === metric);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
      className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-4 shadow-[var(--shadow)] backdrop-blur-xl"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(130%_120%_at_100%_0%,var(--accent-soft),transparent_58%)]"
      />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-[var(--text)]">
            <TrendingUp className="h-3.5 w-3.5 text-[var(--accent)]" />
            Circular mix
          </h3>
          <p className="mt-0.5 text-[10px] text-[var(--muted)]">
            Top {rows.length} by {active.label.toLowerCase()} · total{' '}
            <span className="font-semibold text-[var(--text-2)]">
              {metric === 'budget' ? money(total, rows[0]?.currency) : total}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface2)] p-0.5">
          {CHART_METRICS.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => onMetric(m.id)}
              aria-pressed={metric === m.id}
              className={`focus-ring relative inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${
                metric === m.id ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              {metric === m.id ? (
                <motion.span
                  layoutId="circular-chart-metric"
                  className="absolute inset-0 rounded-md bg-[var(--accent-soft)]"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              ) : null}
              <m.icon className="relative h-2.5 w-2.5" />
              <span className="relative">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-3 space-y-1.5">
        {rows.map((row, index) => (
          <div key={row.id} className="flex items-center gap-2">
            <span className="w-28 shrink-0 truncate text-[10px] font-semibold text-[var(--text-2)] sm:w-40">
              {row.label}
            </span>
            <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--surface3)]">
              <motion.div
                key={`${row.id}-${metric}`}
                className={`h-full rounded-full ${
                  row.status === 'published' ? 'bg-[var(--accent)]' : 'bg-[var(--accent)]/45'
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${(row.value / max) * 100}%` }}
                transition={{ duration: 0.55, ease: EASE, delay: index * 0.04 }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-[10px] font-bold tabular-nums text-[var(--text)]">
              {formatChartValue(row.value, metric, row.currency)}
            </span>
          </div>
        ))}
      </div>

      {!anyData ? (
        <p className="relative mt-3 text-[10px] leading-relaxed text-[var(--muted)]">
          No {active.label.toLowerCase()} recorded on these circulars yet — bars only show what is actually stored.
        </p>
      ) : null}
    </motion.div>
  );
}

/* ── Cover ────────────────────────────────────────────────────────────────── */

function Cover({ assets, category }) {
  const media = (assets || []).find(asset => asset?.publicUrl) || null;
  const [broken, setBroken] = useState(false);

  useEffect(() => { setBroken(false); }, [media?.publicUrl]);

  if (!media || broken) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-[var(--surface2)]">
        {broken ? <ImageOff className="h-4 w-4 text-[var(--muted)]" /> : <BriefcaseBusiness className="h-4 w-4 text-[var(--muted)]" />}
        <span className="px-1 text-center text-[9px] leading-tight text-[var(--muted)]">
          {broken ? 'Unavailable' : category || 'No cover'}
        </span>
      </div>
    );
  }

  return media.mediaType === 'video' ? (
    <video src={media.publicUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" onError={() => setBroken(true)} />
  ) : (
    <img
      src={media.publicUrl}
      alt={media.originalName || 'Circular cover'}
      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      onError={() => setBroken(true)}
    />
  );
}

/* ── Circular card ────────────────────────────────────────────────────────── */

function CircularCard({ circular, index, canManage, onAction, busyId, applicantCount, applied }) {
  const id = idOf(circular);
  const action = canManage ? nextAction(circular.status) : null;
  const busy = busyId === id;
  const left = daysLeft(circular.deadline);
  const deliverables = DELIVERABLES.filter(d => Number(circular.deliverables?.[d.key]) > 0);
  const brand = circular.brandRepId || {};

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.45, ease: EASE, delay: Math.min(index, 8) * 0.03 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/75 shadow-[var(--shadow)] backdrop-blur-xl"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_70%_at_0%_0%,var(--accent-soft),transparent_55%)]"
      />

      <div className="relative flex gap-3 p-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-[var(--border)]">
          <Cover assets={circular.mediaAssetIds} category={circular.productCategory} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/brand-circulars/${id}`} className="focus-ring group/link min-w-0 rounded">
              <h3 className="flex min-w-0 items-center gap-1.5 text-sm font-bold leading-snug tracking-tight text-[var(--text)]">
                <span className="truncate">{circular.title || 'Untitled circular'}</span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[var(--muted)] transition-transform group-hover/link:-translate-y-0.5 group-hover/link:translate-x-0.5 group-hover/link:text-[var(--accent)]" />
              </h3>
            </Link>
            <Badge tone={STATUS_TONE[circular.status] || 'neutral'}>
              <CircleDot className="h-2.5 w-2.5" />
              {circular.status || 'draft'}
            </Badge>
          </div>

          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[var(--muted)]">
            {circular.productName ? (
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-2.5 w-2.5" />
                {circular.productName}
              </span>
            ) : null}
            {circular.productCategory ? <span>· {circular.productCategory}</span> : null}
            {brand.name ? <span>· by {brand.name}</span> : null}
          </p>

          {/* productDescription — the field the old card never read */}
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[var(--text-2)]">
            {circular.productDescription || (
              <span className="text-[var(--muted)]">No product description provided.</span>
            )}
          </p>

          {circular.campaignObjective ? (
            <p className="mt-1 flex items-start gap-1 text-[10px] leading-relaxed text-[var(--muted)]">
              <Target className="mt-0.5 h-2.5 w-2.5 shrink-0 text-[var(--accent)]" />
              <span className="line-clamp-1">{circular.campaignObjective}</span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="relative grid grid-cols-2 gap-2 px-4 sm:grid-cols-3">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-2 py-1.5">
          <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-[var(--muted)]">
            <Wallet className="h-2.5 w-2.5" /> Budget
          </p>
          <p className="mt-0.5 text-xs font-bold text-[var(--text)]">
            {money(circular.budgetAmount, circular.currency)}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-2 py-1.5">
          <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-[var(--muted)]">
            <CalendarClock className="h-2.5 w-2.5" /> Deadline
          </p>
          <p className={`mt-0.5 text-xs font-bold ${
            left === null ? 'text-[var(--text)]' : left < 0 ? 'text-danger' : left <= 3 ? 'text-warning' : 'text-[var(--text)]'
          }`}>
            {left === null ? 'Open-ended' : left < 0 ? 'Passed' : left === 0 ? 'Today' : `${left}d left`}
          </p>
        </div>
        <div className="col-span-2 rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-2 py-1.5 sm:col-span-1">
          <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-[var(--muted)]">
            <Users className="h-2.5 w-2.5" /> Applicants
          </p>
          <p className="mt-0.5 text-xs font-bold text-[var(--text)]">
            {applicantCount === null ? '—' : applicantCount}
          </p>
        </div>
      </div>

      {deliverables.length || circular.contentFormats?.length ? (
        <div className="relative mt-2.5 flex flex-wrap gap-1 px-4">
          {deliverables.map(d => (
            <span
              key={d.key}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface2)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--text-2)]"
            >
              <d.icon className="h-2.5 w-2.5 text-[var(--accent)]" />
              {circular.deliverables[d.key]}{' '}
              {Number(circular.deliverables[d.key]) === 1 ? d.label.replace(/s$/, '') : d.label}
            </span>
          ))}
          {(circular.contentFormats || []).slice(0, 3).map(format => (
            <span
              key={format}
              className="rounded-md border border-[var(--border)] bg-[var(--surface2)] px-1.5 py-0.5 text-[9px] text-[var(--muted)]"
            >
              {format}
            </span>
          ))}
        </div>
      ) : null}

      <div className="relative mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--surface2)]/40 px-4 py-2.5">
        <div className="flex flex-wrap gap-1">
          {(circular.platforms || []).slice(0, 5).map(platform => (
            <span
              key={platform}
              className="rounded-md border border-[var(--accent-line)] bg-[var(--accent-soft)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--accent)]"
            >
              {formatPlatform(platform)}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          {applied ? (
            <Badge tone="success">
              <CheckCheck className="h-2.5 w-2.5" />
              applied
            </Badge>
          ) : null}
          {action ? (
            <Button size="sm" variant={action.tone} disabled={busy} onClick={() => onAction(id, action.key)}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <action.Icon className="h-3.5 w-3.5" />}
              {action.label}
            </Button>
          ) : (
            <Button as="a" size="sm" variant="ghost" href={`/brand-circulars/${id}`}>
              Details
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </motion.article>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function BrandCircularsPage() {
  const [user, setUser] = useState(null);
  const [circulars, setCirculars] = useState(null);
  const [applicants, setApplicants] = useState({});
  const [appliedIds, setAppliedIds] = useState(new Set());
  const [error, setError] = useToastState('danger');
  const [notice, setNotice] = useToastState('success');
  const [busyId, setBusyId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [chartMetric, setChartMetric] = useState('budget');

  /*
   * The list payload carries no application count, so it is read per circular
   * for the owning brand rep. Creators cannot list another brand's applicants —
   * they get their own application state from /api/applications instead.
   */
  const loadApplications = async (list, brandRep) => {
    if (brandRep) {
      const results = await Promise.allSettled(
        list.map(circular => api.get(`/api/brand-circulars/${idOf(circular)}/applications`))
      );
      const counts = {};
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          counts[idOf(list[index])] = (result.value?.data?.applications || []).length;
        }
      });
      setApplicants(counts);
      return;
    }
    const payload = await api.get('/api/applications').catch(() => null);
    const mine = payload?.data?.applications || [];
    setAppliedIds(new Set(mine.map(application => String(application.circularId?._id || application.circularId))));
  };

  const load = async currentUser => {
    const payload = await api.get('/api/brand-circulars');
    const list = payload?.data?.circulars || [];
    setCirculars(list);
    await loadApplications(list, isBrandRep(currentUser));
  };

  useEffect(() => {
    const currentUser = getUser();
    setUser(currentUser);
    load(currentUser).catch(err => setError(err.message));
  }, []);

  const runAction = async (id, key) => {
    setBusyId(id);
    setError('');
    setNotice('');
    try {
      await api.post(`/api/brand-circulars/${id}/${key}`, {});
      setNotice(`Circular ${key === 'publish' ? 'published' : key === 'close' ? 'closed' : 'archived'}.`);
      await load(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const canManage = isBrandRep(user);

  const stats = useMemo(() => {
    if (!circulars) return null;
    const applicantTotal = canManage
      ? Object.values(applicants).reduce((sum, count) => sum + count, 0)
      : appliedIds.size;
    return {
      total: circulars.length,
      open: circulars.filter(c => c.status === 'published').length,
      draft: circulars.filter(c => !c.status || c.status === 'draft').length,
      budget: circulars.reduce((sum, c) => sum + (Number(c.budgetAmount) || 0), 0),
      currency: circulars.find(c => c.currency)?.currency || 'USD',
      applicantTotal
    };
  }, [circulars, applicants, appliedIds, canManage]);

  const counts = useMemo(() => {
    const list = circulars || [];
    return {
      all: list.length,
      published: list.filter(c => c.status === 'published').length,
      draft: list.filter(c => !c.status || c.status === 'draft').length,
      closed: list.filter(c => c.status === 'closed').length,
      archived: list.filter(c => c.status === 'archived').length
    };
  }, [circulars]);

  const visible = useMemo(() => {
    if (!circulars) return null;
    const q = query.trim().toLowerCase();
    return circulars.filter(circular => {
      const status = circular.status || 'draft';
      if (filter !== 'all' && status !== filter) return false;
      if (!q) return true;
      return [
        circular.title, circular.productName, circular.productDescription,
        circular.productCategory, circular.campaignObjective, circular.targetAudience,
        ...(circular.platforms || [])
      ]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(q));
    });
  }, [circulars, filter, query]);

  return (
    <AppShell>
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <BackgroundBeams className="opacity-25 dark:opacity-50" />
        <div className="absolute inset-0 bg-blueprint [mask-image:radial-gradient(ellipse_at_top,black_10%,transparent_70%)]" />
      </div>

      <Page>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
              Marketplace
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
              Brand Circulars
            </h1>
            <div className="max-w-3xl">
              <TextGenerateEffect
                words="Brands post the brief — product, budget, deliverables, deadline — and creators apply with real synced platform stats. Move a circular through draft, open, closed and archived from here."
                className="font-normal"
                duration={0.5}
              />
            </div>
          </div>
          {canManage ? (
            <Button as="a" href="/brand-circulars/create" variant="primary" className="shrink-0">
              <Plus className="h-4 w-4" /> Create circular
            </Button>
          ) : null}
        </div>


        {stats ? (
          <GlareStatGrid>
            <GlareStat label="Circulars" value={stats.total} icon={BriefcaseBusiness} tint={GLARE_TINTS[0]} />
            <GlareStat label="Open" value={stats.open} icon={Send} tint={GLARE_TINTS[1]} hint="Accepting applications" />
            <GlareStat label="Draft" value={stats.draft} icon={CircleDot} tint={GLARE_TINTS[2]} />
            <GlareStat label="Total budget" value={money(stats.budget, stats.currency)} icon={Wallet} tint={GLARE_TINTS[3]} />
            <GlareStat
              label={canManage ? 'Applicants' : 'You applied'}
              value={stats.applicantTotal}
              icon={Users}
              tint={GLARE_TINTS[4]}
              hint={canManage ? 'Across your circulars' : undefined}
            />
          </GlareStatGrid>
        ) : null}

        {circulars?.length ? (
          <CircularChart
            circulars={circulars}
            applicants={applicants}
            metric={chartMetric}
            onMetric={setChartMetric}
          />
        ) : null}

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-center">
          <div className="flex gap-1 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-1 backdrop-blur-xl">
            {FILTERS.map(f => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  aria-pressed={active}
                  className={`focus-ring relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors ${
                    active ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {active ? (
                    <motion.span
                      layoutId="circulars-filter-pill"
                      className="absolute inset-0 rounded-lg bg-[var(--accent-soft)] ring-1 ring-inset ring-[var(--accent-line)]"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  ) : null}
                  <span className="relative">{f.label}</span>
                  <span
                    className={`relative rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                      active ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'bg-[var(--surface2)] text-[var(--muted)]'
                    }`}
                  >
                    {counts[f.id]}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Product, objective, platform…"
              aria-label="Search circulars"
              className="pl-8"
            />
          </div>
        </div>

        <Section
          title="All circulars"
          description={visible ? `${visible.length} shown${circulars && visible.length !== circulars.length ? ` of ${circulars.length}` : ''}` : undefined}
        >
          {!visible ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64" />)}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={BriefcaseBusiness}
              title={circulars?.length ? 'Nothing matches' : 'No circulars available'}
              description={
                circulars?.length
                  ? 'Try another status filter or clear the search.'
                  : canManage
                    ? 'Create one to start collecting creator applications.'
                    : 'Nothing open right now. Check back — new brand opportunities appear here.'
              }
              action={
                circulars?.length ? (
                  <Button variant="secondary" size="sm" onClick={() => { setFilter('all'); setQuery(''); }}>
                    Clear filters
                  </Button>
                ) : canManage ? (
                  <Button as="a" href="/brand-circulars/create" variant="primary" size="sm">
                    <Plus className="h-3.5 w-3.5" /> Create circular
                  </Button>
                ) : null
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <AnimatePresence mode="popLayout">
                {visible.map((circular, index) => (
                  <CircularCard
                    key={idOf(circular)}
                    circular={circular}
                    index={index}
                    canManage={canManage}
                    onAction={runAction}
                    busyId={busyId}
                    applicantCount={canManage ? (applicants[idOf(circular)] ?? null) : null}
                    applied={appliedIds.has(idOf(circular))}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </Section>
      </Page>
    </AppShell>
  );
}
