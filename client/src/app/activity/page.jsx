'use client';

/**
 * Activity — GET /api/events
 *
 * The server writes a WorkflowEvent for every meaningful transition (content
 * created, variant generated, approval decided, publish succeeded/failed, media
 * cleaned up) and streams them over socket.io. The client only ever showed these
 * in a cramped sidebar widget capped at a handful of rows, so the audit trail was
 * effectively invisible.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Activity as ActivityIcon, RefreshCw, Filter, CheckCircle2, XCircle,
  Upload, Sparkles, Send, ShieldCheck, Trash2
} from 'lucide-react';

import AppShell from '../../components/layout/AppShell';
import {
  Page, PageHeader, Section, Surface, Badge, Button, Select, Field,
  EmptyState, Skeleton, Notice, StatTile, StatGrid, useStagger
} from '../../components/ds';
import { api } from '../../lib/api';
import { motion } from 'motion/react';

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

const fmtTime = d =>
  d ? new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export default function ActivityPage() {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState('100');
  const [typeFilter, setTypeFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const { container, item } = useStagger(0.02);

  const load = async (n = limit) => {
    setRefreshing(true);
    try {
      const p = await api.get(`/api/events?limit=${n}`);
      setEvents(p?.data?.events || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { load(limit); /* eslint-disable-next-line */ }, [limit]);

  const types = useMemo(() => {
    if (!events) return [];
    return [...new Set(events.map(e => e.eventType).filter(Boolean))].sort();
  }, [events]);

  const filtered = useMemo(() => {
    if (!events) return null;
    return typeFilter === 'all' ? events : events.filter(e => e.eventType === typeFilter);
  }, [events, typeFilter]);

  const stats = useMemo(() => {
    if (!events) return null;
    return {
      total: events.length,
      types: types.length,
      failures: events.filter(e => /fail|error|reject/i.test(e.eventType || '')).length,
      publishes: events.filter(e => /publish/i.test(e.eventType || '')).length
    };
  }, [events, types]);

  return (
    <AppShell>
      <Page>
        <PageHeader
          eyebrow="System"
          title="Activity"
          description="The workspace audit trail. Every workflow transition the server records, newest first — the same stream that powers the live event feed."
          actions={
            <Button variant="secondary" onClick={() => load()} disabled={refreshing}>
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          }
        />

        {error ? <Notice tone="danger">{error}</Notice> : null}

        {stats ? (
          <StatGrid className="lg:grid-cols-4 xl:grid-cols-4">
            <StatTile label="Events" value={stats.total} icon={ActivityIcon} tone="accent" />
            <StatTile label="Event types" value={stats.types} icon={Filter} />
            <StatTile label="Publishes" value={stats.publishes} icon={Send} tone="success" />
            <StatTile label="Failures" value={stats.failures} icon={XCircle} tone="danger" />
          </StatGrid>
        ) : null}

        <Section
          title="Stream"
          description={filtered ? `${filtered.length} shown` : undefined}
          actions={
            <div className="flex items-end gap-2">
              <Field label="Type" htmlFor="ev-type" className="w-40">
                <Select id="ev-type" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                  <option value="all">All types</option>
                  {types.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Limit" htmlFor="ev-limit" className="w-24">
                <Select id="ev-limit" value={limit} onChange={e => setLimit(e.target.value)}>
                  {['30', '100', '250'].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </Select>
              </Field>
            </div>
          }
        >
          {!filtered ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={ActivityIcon}
              title="No events recorded"
              description="Create a campaign, generate variants or publish something and the audit trail will populate here."
            />
          ) : (
            <motion.ol variants={container} initial="hidden" animate="visible" className="space-y-2">
              {filtered.map((ev, i) => {
                const { icon: Icon, tone } = shapeOf(ev.eventType);
                return (
                  <motion.li key={ev._id || i} variants={item}>
                    <Surface pad="sm" interactive className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                          tone === 'danger' ? 'border-danger/30 bg-danger/10 text-danger'
                          : tone === 'success' ? 'border-success/30 bg-success/10 text-success'
                          : tone === 'accent' ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]'
                          : tone === 'warning' ? 'border-warning/30 bg-warning/10 text-warning'
                          : 'border-[var(--border)] bg-[var(--surface2)] text-[var(--muted)]'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11px] font-semibold text-[var(--text)]">
                            {ev.eventType || 'event'}
                          </span>
                          {ev.entityType ? <Badge>{ev.entityType}</Badge> : null}
                        </div>
                        {ev.message ? (
                          <p className="mt-1 text-xs leading-relaxed text-[var(--text-2)]">{ev.message}</p>
                        ) : null}
                      </div>
                      <time className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-[var(--muted)]">
                        {fmtTime(ev.createdAt)}
                      </time>
                    </Surface>
                  </motion.li>
                );
              })}
            </motion.ol>
          )}
        </Section>
      </Page>
    </AppShell>
  );
}
