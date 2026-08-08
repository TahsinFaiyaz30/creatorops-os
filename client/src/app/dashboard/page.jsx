'use client';

import { useEffect, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clapperboard,
  GitBranch,
  Radio,
  RadioTower,
  ArrowUpRight
} from 'lucide-react';
import { motion, cubicBezier, useReducedMotion } from 'motion/react';

import AppShell from '../../components/layout/AppShell';
import LiveEventFeed from '../../components/events/LiveEventFeed';
import CreatorStatsCard from '../../components/statistics/CreatorStatsCard';
import CombinedStatsGraph from '../../components/statistics/CombinedStatsGraph';
import RoleBadge from '../../components/layout/RoleBadge';
import BrandDashboard from '../../components/dashboard/BrandDashboard';
import { api } from '../../lib/api';
import { getUser } from '../../lib/auth';
import { isBrandRep } from '../../lib/roles';
import { useToastState } from '../../components/ui/toast';

import { Button, GLARE_TINTS, GlareStat, GlareStatGrid, Notice, Section } from '../../components/ds';
import { BackgroundBeams } from '@/components/ui/background-beams';
import { TextGenerateEffect } from '@/components/ui/text-generate-effect';

/* Aceternity's showcase easing — the long expo settle. */
const easeOutExpo = cubicBezier(0.16, 1, 0.3, 1);

const STUDIO = 'CreatorOps.OS';

export default function DashboardPage() {
  const reduceMotion = useReducedMotion();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ campaigns: 0, accounts: 0, queued: 0, published: 0, events: 0 });
  const [statistics, setStatistics] = useState(null);
  const [message, setMessage] = useToastState('info');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const results = await Promise.allSettled([
      api.get('/api/campaigns'),
      api.get('/api/events?limit=30'),
      api.get('/api/publish/jobs'),
      api.get('/api/platform-connections'),
      api.get('/api/statistics/creator')
    ]);

    const publishJobs = results[2].value?.data?.publishJobs || [];

    setStats({
      campaigns: results[0].value?.data?.campaigns?.length || 0,
      accounts: results[3].value?.data?.connections?.length || 0,
      queued: publishJobs.filter(job => job.status === 'queued').length,
      published: publishJobs.filter(job => job.status === 'published').length,
      events: results[1].value?.data?.events?.length || 0
    });

    setStatistics(results[4].value?.data?.statistics || null);
  };

  useEffect(() => {
    setUser(getUser());
    load().catch(err => setMessage(err.message));
  }, []);

  const snapshot = async () => {
    setBusy(true);
    try {
      await api.post('/api/statistics/snapshot', {});
      setMessage('Statistics snapshot created for applications.');
      await load();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  };

  const combined = statistics?.combinedStats || {};

  /* ── Motion orchestration ─────────────────────────────────────────── */
  const stage = {
    hidden: {},
    visible: {
      transition: reduceMotion
        ? { staggerChildren: 0 }
        : { staggerChildren: 0.07, delayChildren: 0.1 }
    }
  };

  const rise = {
    hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 22, filter: 'blur(8px)' },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: { duration: reduceMotion ? 0.3 : 0.85, ease: easeOutExpo }
    }
  };

  const METRICS = [
    { icon: GitBranch,     label: 'Projects',       value: stats.campaigns, tint: GLARE_TINTS[0], hint: 'In flight right now' },
    { icon: RadioTower,    label: 'Accounts',       value: stats.accounts,  tint: GLARE_TINTS[1], hint: 'Connected platforms' },
    { icon: CalendarClock, label: 'Queued jobs',    value: stats.queued,    tint: GLARE_TINTS[2], hint: 'Waiting to publish' },
    { icon: CheckCircle2,  label: 'Published jobs', value: stats.published, tint: GLARE_TINTS[3], hint: 'Shipped from here' },
    { icon: Radio,         label: 'Recent events',  value: stats.events,    tint: GLARE_TINTS[4], hint: 'Last 30 in the feed' }
  ];

  /*
   * A brand rep runs no campaigns, publishes nothing and has no team, so the
   * creator dashboard rendered them a wall of zeroes. They get the queue they
   * actually work from instead.
   */
  if (isBrandRep(user)) {
    return (
      <AppShell>
        <BrandDashboard user={user} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* `dark` is explicit: ThemeProvider only adds it in a mount effect, so the
          Aceternity components' dark: variants would flash light on first paint. */}
      <div className="relative isolate min-h-screen overflow-hidden bg-[var(--surface)]">
        {/* Beams sit furthest back and are masked toward the top so they read as
            ambient light behind the bento grid rather than competing with it. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-20 overflow-hidden [mask-image:radial-gradient(ellipse_at_top,black_10%,transparent_75%)]"
        >
          <BackgroundBeams className="opacity-30 dark:opacity-60" />
        </div>

        {/* Ambient grid, radially masked so it fades out at the edges */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-grid-white/[0.02] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[-14rem] -z-10 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(99,68,245,0.18),transparent_70%)] blur-3xl"
        />

        <motion.div variants={stage} initial="hidden" animate="visible" className="space-y-8 py-2">
          {/* ── Header ──────────────────────────────────────────────── */}
          <motion.header variants={rise}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface2)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  <Clapperboard className="h-3 w-3 text-[var(--accent)]" />
                  {STUDIO} · Command Center
                </span>

                <h1 className="mt-4 text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
                  Welcome back{user?.name ? `, ${user.name}` : ''}
                </h1>

                <div className="mt-1 max-w-3xl">
                  <TextGenerateEffect
                    words="Every campaign, every cut, every publish — one cinematic control surface. Only official synced platform metrics are counted."
                    className="font-normal"
                    duration={0.55}
                  />
                </div>
              </div>
              <RoleBadge user={user} />
            </div>
          </motion.header>

          {/*
            One system, top to bottom.

            This was three different card languages stacked on one page: five
            glare tiles, then a bento grid, then a bordered statistics panel —
            and they disagreed as well as clashed. The bento repeated numbers
            the statistics panel showed directly underneath (views, likes,
            comments, engagement rate), duplicated the Campaigns tile as
            "Active Campaigns", and labelled the queued-*jobs* count "Pending
            Approvals", which is a different thing entirely. Its bars were
            invented too — widths of `30 + i * 22`% and a hardcoded
            `[38,62,45,78,56,88,70]` sparkline, drawn regardless of the data.

            What is left is one metric row and two sections built from the same
            `ds` primitives every other page uses, each number appearing once.
          */}

          <motion.section variants={rise}>
            <GlareStatGrid>
              {METRICS.map(({ icon, label, value, tint, hint }) => (
                <GlareStat key={label} label={label} value={value} icon={icon} tint={tint} hint={hint} />
              ))}
            </GlareStatGrid>
          </motion.section>

          <motion.section variants={rise}>
            <Section
              title="Performance"
              description="Combined and per-platform metrics, synced from official platform APIs. Unsupported or unsynced metrics stay unavailable."
              actions={
                <Button variant="secondary" size="sm" onClick={snapshot} loading={busy}>
                  Create application snapshot
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              }
            >
              {statistics?.unavailableMessage ? (
                <Notice tone="warning">{statistics.unavailableMessage}</Notice>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <CreatorStatsCard label="Views" value={combined.views || 0} />
                <CreatorStatsCard label="Likes" value={combined.likes || 0} />
                <CreatorStatsCard label="Comments" value={combined.comments || 0} />
                <CreatorStatsCard label="Engagement rate" value={`${combined.engagementRate || 0}%`} />
              </div>

              <CombinedStatsGraph platformStats={statistics?.platformStats || []} />
            </Section>
          </motion.section>

          <motion.section variants={rise}>
            <Section
              title="Operations"
              description="Everything the workspace has done recently, as it happens."
              actions={
                <Button as="a" href="/activity" variant="ghost" size="sm">
                  Full activity
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              }
            >
              <LiveEventFeed compact />
            </Section>
          </motion.section>
        </motion.div>
      </div>
    </AppShell>
  );
}
