'use client';

/**
 * Brand Circulars — GET /api/brand-circulars
 *
 * Rebuilt on Aceternity: TextGenerateEffect header, BentoGrid + GlareCard roster.
 *
 * Also wires the lifecycle transitions the server exposes that no page called:
 *   POST /brand-circulars/:id/publish   draft  → open
 *   POST /brand-circulars/:id/close     open   → closed
 *   POST /brand-circulars/:id/archive   closed → archived
 * A brand rep previously had no way to move a circular past draft from here.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  Plus, BriefcaseBusiness, Send, Lock, Archive, Users,
  ArrowUpRight, CircleDot
} from 'lucide-react';

import AppShell from '../../components/layout/AppShell';
import { TextGenerateEffect } from '../../components/ui/text-generate-effect';
import { GlareCard } from '../../components/ui/glare-card';
import { BentoGrid } from '../../components/ui/bento-grid';
import {
  Page, Section, Badge, Button,
  EmptyState, Skeleton, Notice, StatTile, StatGrid, useStagger
} from '../../components/ds';
import { api } from '../../lib/api';
import { getUser } from '../../lib/auth';
import { isBrandRep } from '../../lib/roles';

const STATUS_TONE = {
  open: 'success', published: 'success', draft: 'neutral',
  closed: 'warning', archived: 'neutral'
};

/* Which lifecycle transition is legal from the current status. */
const nextAction = status => {
  if (!status || status === 'draft') return { key: 'publish', label: 'Publish', Icon: Send, tone: 'primary' };
  if (['open', 'published'].includes(status)) return { key: 'close', label: 'Close', Icon: Lock, tone: 'secondary' };
  if (status === 'closed') return { key: 'archive', label: 'Archive', Icon: Archive, tone: 'ghost' };
  return null;
};

function CircularCard({ circular, canManage, onAction, busyId }) {
  const id = circular._id || circular.id;
  const action = canManage ? nextAction(circular.status) : null;
  const busy = busyId === id;

  return (
    <GlareCard
      containerClassName="w-full [aspect-ratio:16/10]"
      className="flex flex-col justify-between bg-[var(--surface)] p-5"
    >
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/brand-circulars/${id}`} className="focus-ring group min-w-0 rounded">
            <h3 className="flex min-w-0 items-center gap-1.5 text-base font-bold tracking-tight text-[var(--text)]">
              <span className="truncate">{circular.title || 'Untitled circular'}</span>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[var(--muted)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
            </h3>
          </Link>
          <Badge tone={STATUS_TONE[circular.status] || 'neutral'}>
            <CircleDot className="h-3 w-3" />
            {circular.status || 'draft'}
          </Badge>
        </div>
        <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-[var(--muted)]">
          {circular.description || circular.brief || 'No description provided.'}
        </p>
      </div>

      <div className="flex flex-wrap gap-1">
        {(circular.platforms || circular.requiredPlatforms || []).slice(0, 5).map(p => (
          <span
            key={p}
            className="rounded-md border border-[var(--accent-line)] bg-[var(--accent-soft)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--accent)]"
          >
            {p}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
          <Users className="h-3 w-3" />
          {circular.applicationCount ?? circular.applicationsCount ?? 0} applied
        </span>

        {action ? (
          <Button size="sm" variant={action.tone} disabled={busy} onClick={() => onAction(id, action.key)}>
            <action.Icon className="h-3.5 w-3.5" />
            {busy ? '…' : action.label}
          </Button>
        ) : null}
      </div>
    </GlareCard>
  );
}

export default function BrandCircularsPage() {
  const [user, setUser] = useState(null);
  const [circulars, setCirculars] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);
  const { item } = useStagger(0.06);

  const load = async () => {
    const payload = await api.get('/api/brand-circulars');
    setCirculars(payload?.data?.circulars || []);
  };

  useEffect(() => {
    setUser(getUser());
    load().catch(err => setError(err.message));
  }, []);

  const runAction = async (id, key) => {
    setBusyId(id);
    setError('');
    setNotice('');
    try {
      await api.post(`/api/brand-circulars/${id}/${key}`, {});
      setNotice(
        `Circular ${key === 'publish' ? 'published' : key === 'close' ? 'closed' : 'archived'}.`
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const canManage = isBrandRep(user);

  const stats = useMemo(() => {
    if (!circulars) return null;
    return {
      total: circulars.length,
      open: circulars.filter(c => ['open', 'published'].includes(c.status)).length,
      draft: circulars.filter(c => !c.status || c.status === 'draft').length,
      closed: circulars.filter(c => c.status === 'closed').length,
      applicants: circulars.reduce((s, c) => s + (c.applicationCount ?? c.applicationsCount ?? 0), 0)
    };
  }, [circulars]);

  return (
    <AppShell>
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
                words="Brands post creator opportunities; creators apply with real synced platform stats. Move a circular through draft, open, closed and archived from here."
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

        {error ? <Notice tone="danger">{error}</Notice> : null}
        {notice ? <Notice tone="success">{notice}</Notice> : null}

        {stats ? (
          <StatGrid>
            <StatTile label="Circulars" value={stats.total} icon={BriefcaseBusiness} tone="accent" />
            <StatTile label="Open" value={stats.open} icon={Send} tone="success" />
            <StatTile label="Draft" value={stats.draft} icon={CircleDot} />
            <StatTile label="Closed" value={stats.closed} icon={Lock} tone="warning" />
            <StatTile label="Applicants" value={stats.applicants} icon={Users} />
          </StatGrid>
        ) : null}

        <Section title="All circulars" description={circulars ? `${circulars.length} total` : undefined}>
          {!circulars ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-56" />)}
            </div>
          ) : circulars.length === 0 ? (
            <EmptyState
              icon={BriefcaseBusiness}
              title="No circulars available"
              description={
                canManage
                  ? 'Create one to start collecting creator applications.'
                  : 'Nothing open right now. Check back — new brand opportunities appear here.'
              }
              action={
                canManage ? (
                  <Button as="a" href="/brand-circulars/create" variant="primary" size="sm">
                    <Plus className="h-3.5 w-3.5" /> Create circular
                  </Button>
                ) : null
              }
            />
          ) : (
            <BentoGrid className="mx-0 max-w-none grid-cols-1 gap-4 md:auto-rows-auto md:grid-cols-2 xl:grid-cols-3">
              {circulars.map(c => (
                <motion.div key={c._id || c.id} variants={item} initial="hidden" animate="visible">
                  <CircularCard
                    circular={c}
                    canManage={canManage}
                    onAction={runAction}
                    busyId={busyId}
                  />
                </motion.div>
              ))}
            </BentoGrid>
          )}
        </Section>
      </Page>
    </AppShell>
  );
}
