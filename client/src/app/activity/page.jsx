'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Activity — GET /api/events, live over socket `workflow:event`.
 *
 * Three things changed beyond the look:
 *
 *  1. The Limit dropdown offered 250, but listWorkflowEvents clamps to
 *     `Math.min(limit, 100)` — picking 250 silently returned 100. A control that
 *     does nothing is worse than no control, so it is gone and the page asks for
 *     the real ceiling.
 *  2. `actorId` comes back populated with name/email/role and was discarded, so
 *     the audit trail never said *who* did anything. It does now.
 *  3. The page was a static list of "the same stream that powers the live feed"
 *     — except it wasn't live. It subscribes to the socket now, so new events
 *     land at the top as they happen.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Activity as ActivityIcon, RefreshCw, CheckCircle2, XCircle,
  Upload, Sparkles, Send, ShieldCheck, Trash2, User as UserIcon, Radio
} from 'lucide-react';

import AppShell from '../../components/layout/AppShell';
import { TextGenerateEffect } from '../../components/ui/text-generate-effect';
import { BackgroundBeams } from '../../components/ui/background-beams';
import {
  Page, Section, Badge, Button, EmptyState, Skeleton, GlareStat, GlareStatGrid, GLARE_TINTS
} from '../../components/ds';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { getUser, getUserId } from '../../lib/auth';
import { useToastState } from '../../components/ui/toast';

const EASE = [0.16, 1, 0.3, 1];
/* The server clamps to 100; asking for more just wastes the round trip. */
const LIMIT = 100;
/* Fixed track height so bar heights can be plain pixels — see ActivityPulse. */
const TRACK_H = 96;

/* Map event type fragments to an icon + tone so the stream is scannable. */
const shapeOf = type => {
  const t = (type || '').toLowerCase();
  if (t.includes('fail') || t.includes('error') || t.includes('reject')) return { icon: XCircle, tone: 'danger' };
  if (t.includes('publish')) return { icon: Send, tone: 'success' };
  if (t.includes('approv')) return { icon: ShieldCheck, tone: 'accent' };
  if (t.includes('variant') || t.includes('ai') || t.includes('repurpose')) return { icon: Sparkles, tone: 'accent' };
  if (t.includes('media') || t.includes('upload')) return { icon: Upload, tone: 'neutral' };
  if (t.includes('delete') || t.includes('cleanup')) return { icon: Trash2, tone: 'warning' };
  return { icon: CheckCircle2, tone: 'neutral' };
};

const TONE_CLASS = {
  danger: 'border-danger/30 bg-danger/10 text-danger',
  success: 'border-success/30 bg-success/10 text-success',
  accent: 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  neutral: 'border-[var(--border)] bg-[var(--surface2)] text-[var(--muted)]'
};

const clockOf = d =>
  d ? new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—';

const dayKeyOf = d => {
  const date = new Date(d || 0);
  return Number.isNaN(date.getTime()) ? 'unknown' : date.toDateString();
};

const dayLabelOf = key => {
  if (key === 'unknown') return 'Undated';
  const date = new Date(key);
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (key === today) return 'Today';
  if (key === yesterday) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

const initialsOf = name =>
  (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

/* ── Seven-day pulse ──────────────────────────────────────────────────────── */

function ActivityPulse({ events }) {
  const reduce = useReducedMotion();

  const days = useMemo(() => {
    const buckets = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - i));
      return { date, key: date.toDateString(), count: 0 };
    });
    const index = new Map(buckets.map(b => [b.key, b]));
    events.forEach(ev => {
      const bucket = index.get(dayKeyOf(ev.createdAt));
      if (bucket) bucket.count += 1;
    });
    return buckets;
  }, [events]);

  const max = Math.max(...days.map(d => d.count), 1);
  const total = days.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-4 backdrop-blur-xl">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(130%_120%_at_100%_0%,var(--accent-soft),transparent_58%)]"
      />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-[var(--text)]">Seven-day pulse</h3>
          <p className="mt-0.5 text-[10px] text-[var(--muted)]">
            {total} of the last {LIMIT} events fell inside this window
          </p>
        </div>
      </div>

      {/*
        Heights are pixels, not percentages. A `height: N%` resolves against the
        parent's height, and the bar's parent was an auto-height flex column —
        so every bar computed to 0 and the panel rendered as an empty box.

        Each day also gets a full-height track behind the fill, so a quiet day
        still reads as a measured zero rather than a gap in the chart.

        One measure, one colour: bar height already encodes the count, so a
        per-bar hue would spend the colour channel on nothing.
      */}
      <div className="relative mt-3 flex items-end gap-2">
        {days.map((day, i) => {
          const filled = day.count ? Math.max((day.count / max) * TRACK_H, 6) : 0;
          const isToday = day.key === new Date().toDateString();
          return (
            <div key={day.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <span className="text-[9px] font-bold tabular-nums text-[var(--text-2)]">
                {day.count || ''}
              </span>

              <div
                className="relative flex w-full items-end overflow-hidden rounded-[4px] bg-[var(--surface3)]/60"
                style={{ height: TRACK_H }}
              >
                <motion.div
                  className="w-full rounded-[4px]"
                  style={{ background: 'var(--viz-series-1)' }}
                  initial={reduce ? false : { height: 0 }}
                  animate={{ height: filled }}
                  transition={{ duration: 0.6, ease: EASE, delay: i * 0.05 }}
                />
              </div>

              <span
                className={`text-[9px] uppercase tracking-wider ${
                  isToday ? 'font-bold text-[var(--accent)]' : 'text-[var(--muted)]'
                }`}
              >
                {day.date.toLocaleDateString(undefined, { weekday: 'narrow' })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function ActivityPage() {
  const [events, setEvents] = useState(null);
  const [error, setError] = useToastState('danger');
  const [typeFilter, setTypeFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const [me, setMe] = useState(null);
  const seenRef = useRef(new Set());

  useEffect(() => { setMe(getUser()); }, []);

  /*
   * The socket broadcasts the raw document, so `actorId` arrives as an ObjectId
   * while the fetched list has it populated. Without this a live event silently
   * loses its actor line and then grows one on the next refresh.
   */
  const actorOf = event => {
    const actor = event?.actorId;
    if (actor && typeof actor === 'object') {
      return { name: actor.name || actor.email, role: actor.role };
    }
    if (actor && me && String(actor) === getUserId(me)) {
      return { name: me.name || me.email, role: me.role };
    }
    return null;
  };

  const load = async () => {
    setRefreshing(true);
    try {
      const p = await api.get(`/api/events?limit=${LIMIT}`);
      const list = p?.data?.events || [];
      seenRef.current = new Set(list.map(e => String(e._id)));
      setEvents(list);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  /* The page claimed to show "the same stream that powers the live feed" while
     being a one-shot fetch. Now it actually is that stream. */
  useEffect(() => {
    const socket = getSocket();
    const onEvent = payload => {
      if (!payload?._id || seenRef.current.has(String(payload._id))) return;
      seenRef.current.add(String(payload._id));
      setEvents(current => [payload, ...(current || [])].slice(0, LIMIT));
      setLiveCount(n => n + 1);
    };
    socket.on('workflow:event', onEvent);
    return () => socket.off('workflow:event', onEvent);
  }, []);

  const typeCounts = useMemo(() => {
    if (!events) return [];
    const counts = new Map();
    events.forEach(e => {
      const key = e.eventType || 'event';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [events]);

  const filtered = useMemo(() => {
    if (!events) return null;
    return typeFilter === 'all' ? events : events.filter(e => e.eventType === typeFilter);
  }, [events, typeFilter]);

  /* Grouped by day so the rail reads as a timeline rather than a flat log. */
  const grouped = useMemo(() => {
    if (!filtered) return null;
    const map = new Map();
    filtered.forEach(ev => {
      const key = dayKeyOf(ev.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ev);
    });
    return [...map.entries()];
  }, [filtered]);

  const stats = useMemo(() => {
    if (!events) return null;
    const today = new Date().toDateString();
    const actors = new Set(
      events.map(e => actorOf(e)?.name).filter(Boolean)
    );
    return {
      total: events.length,
      today: events.filter(e => dayKeyOf(e.createdAt) === today).length,
      publishes: events.filter(e => /publish/i.test(e.eventType || '')).length,
      failures: events.filter(e => /fail|error|reject/i.test(e.eventType || '')).length,
      actors: actors.size
    };
  }, [events]);

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
              System
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
              Activity
            </h1>
            <div className="max-w-3xl">
              <TextGenerateEffect
                words="Every workflow transition the server records, newest first — written to the audit trail before it is broadcast, so nothing here is a guess about what happened."
                className="font-normal"
                duration={0.5}
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-line)] bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-semibold text-[var(--accent)]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              </span>
              Live
              {liveCount > 0 ? <span className="tabular-nums">· {liveCount} new</span> : null}
            </span>
            <Button variant="secondary" size="sm" onClick={load} disabled={refreshing}>
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>


        {stats ? (
          <GlareStatGrid>
            <GlareStat label="Events"    value={stats.total}     icon={ActivityIcon} tint={GLARE_TINTS[0]} hint={`Last ${LIMIT}`} />
            <GlareStat label="Today"     value={stats.today}     icon={Radio}        tint={GLARE_TINTS[1]} />
            <GlareStat label="Publishes" value={stats.publishes} icon={Send}         tint={GLARE_TINTS[2]} />
            <GlareStat label="Failures"  value={stats.failures}  icon={XCircle}      tint={GLARE_TINTS[3]} />
            <GlareStat label="Actors"    value={stats.actors}    icon={UserIcon}     tint={GLARE_TINTS[4]} hint="Distinct people" />
          </GlareStatGrid>
        ) : null}

        {events?.length ? <ActivityPulse events={events} /> : null}

        {/* Type filter as pills with counts — replaces a native select that hid
            both the options and how many of each there were. */}
        {typeCounts.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            <FilterPill active={typeFilter === 'all'} onClick={() => setTypeFilter('all')} count={events.length}>
              All
            </FilterPill>
            {typeCounts.map(([type, count]) => (
              <FilterPill
                key={type}
                active={typeFilter === type}
                onClick={() => setTypeFilter(type)}
                count={count}
              >
                {type}
              </FilterPill>
            ))}
          </div>
        ) : null}

        <Section title="Stream" description={filtered ? `${filtered.length} shown` : undefined}>
          {!grouped ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : grouped.length === 0 ? (
            <EmptyState
              icon={ActivityIcon}
              title={events?.length ? 'Nothing of this type' : 'No events recorded'}
              description={
                events?.length
                  ? 'Pick another type, or clear the filter.'
                  : 'Create a campaign, generate variants or publish something and the audit trail will populate here.'
              }
              action={
                events?.length ? (
                  <Button variant="secondary" size="sm" onClick={() => setTypeFilter('all')}>
                    Show all types
                  </Button>
                ) : null
              }
            />
          ) : (
            <div className="space-y-5">
              {grouped.map(([dayKey, dayEvents]) => (
                <div key={dayKey}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                      {dayLabelOf(dayKey)}
                    </span>
                    <span className="h-px flex-1 bg-[var(--border)]" />
                    <span className="text-[10px] tabular-nums text-[var(--muted)]">{dayEvents.length}</span>
                  </div>

                  {/* The rail is a single line behind the markers, so the day
                      reads as one continuous thread instead of loose cards. */}
                  <ol className="relative space-y-1.5 pl-7">
                    <span
                      aria-hidden
                      className="pointer-events-none absolute bottom-2 left-[13px] top-2 w-px bg-[var(--border)]"
                    />
                    <AnimatePresence initial={false}>
                      {dayEvents.map((ev, i) => {
                        const { icon: Icon, tone } = shapeOf(ev.eventType);
                        const actor = actorOf(ev);
                        return (
                          <motion.li
                            key={ev._id || `${dayKey}-${i}`}
                            layout
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.35, ease: EASE, delay: Math.min(i, 12) * 0.02 }}
                            className="group relative"
                          >
                            <span
                              className={`absolute -left-7 top-2 flex h-6 w-6 items-center justify-center rounded-lg border ${TONE_CLASS[tone]}`}
                            >
                              <Icon className="h-3 w-3" />
                            </span>

                            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 px-3 py-2 backdrop-blur-md transition-colors group-hover:border-[var(--border-strong)]">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="font-mono text-[11px] font-semibold text-[var(--text)]">
                                  {ev.eventType || 'event'}
                                </span>
                                {ev.entityType ? <Badge tone="neutral">{ev.entityType}</Badge> : null}
                                <time className="ml-auto shrink-0 text-[10px] tabular-nums text-[var(--muted)]">
                                  {clockOf(ev.createdAt)}
                                </time>
                              </div>

                              {ev.message ? (
                                <p className="mt-1 text-xs leading-relaxed text-[var(--text-2)]">{ev.message}</p>
                              ) : null}

                              {/* actorId is populated by the API and used to be dropped. */}
                              {actor?.name ? (
                                <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
                                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--surface3)] text-[8px] font-bold text-[var(--text-2)]">
                                    {initialsOf(actor.name)}
                                  </span>
                                  {actor.name}
                                  {actor.role ? (
                                    <span className="opacity-70">· {actor.role.replace(/_/g, ' ')}</span>
                                  ) : null}
                                </p>
                              ) : null}
                            </div>
                          </motion.li>
                        );
                      })}
                    </AnimatePresence>
                  </ol>
                </div>
              ))}
            </div>
          )}
        </Section>
      </Page>
    </AppShell>
  );
}

function FilterPill({ active, onClick, count, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`focus-ring relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold transition-colors ${
        active ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
      }`}
    >
      {active ? (
        <motion.span
          layoutId="activity-type-pill"
          className="absolute inset-0 rounded-full bg-[var(--accent-soft)] ring-1 ring-inset ring-[var(--accent-line)]"
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        />
      ) : null}
      <span className="relative">{children}</span>
      <span
        className={`relative rounded-full px-1.5 tabular-nums ${
          active ? 'bg-[var(--accent)]/20' : 'bg-[var(--surface2)]'
        }`}
      >
        {count}
      </span>
    </button>
  );
}
