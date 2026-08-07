'use client';

import { useEffect, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clapperboard,
  GitBranch,
  Radio,
  RadioTower,
  Camera,
  Sparkles,
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

import { BentoGrid, BentoGridItem } from '@/components/ui/bento-grid';
import { GlareStat } from '../../components/ds';
import { AnimatedButton } from '@/components/ui/AnimatedButton';
import { BackgroundBeams } from '@/components/ui/background-beams';
import { TextGenerateEffect } from '@/components/ui/text-generate-effect';
import { Meteors } from '@/components/ui/meteors';

/* Aceternity's showcase easing — the long expo settle. */
const easeOutExpo = cubicBezier(0.16, 1, 0.3, 1);

const STUDIO = 'CreatorOps.OS';

export default function DashboardPage() {
  const reduceMotion = useReducedMotion();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ campaigns: 0, accounts: 0, queued: 0, published: 0, events: 0 });
  const [statistics, setStatistics] = useState(null);
  const [message, setMessage] = useState('');

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
    try {
      await api.post('/api/statistics/snapshot', {});
      setMessage('Statistics snapshot created for applications.');
      await load();
    } catch (err) {
      setMessage(err.message);
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
    { icon: GitBranch,     label: 'Campaigns',      value: stats.campaigns, tint: 'from-[#6344F5]/40' },
    { icon: RadioTower,    label: 'Accounts',       value: stats.accounts,  tint: 'from-sky-500/40' },
    { icon: CalendarClock, label: 'Queued jobs',    value: stats.queued,    tint: 'from-amber-500/40' },
    { icon: CheckCircle2,  label: 'Published jobs', value: stats.published, tint: 'from-emerald-500/40' },
    { icon: Radio,         label: 'Recent events',  value: stats.events,    tint: 'from-rose-500/40' }
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

          {message && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-3 text-sm text-[var(--text-2)]"
            >
              {message}
            </motion.div>
          )}

          {/* ── Top-level metrics — shared GlareStat, same as Campaigns ─── */}
          <motion.section variants={rise}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {METRICS.map(({ icon, label, value, tint }) => (
                <GlareStat key={label} label={label} value={value} icon={icon} tint={tint} />
              ))}
            </div>
          </motion.section>

          {/* ── Bento grid ──────────────────────────────────────────── */}
          <motion.section variants={rise}>
            <BentoGrid className="md:auto-rows-[15rem] md:grid-cols-3">
              {/* Latest Cinematic Short — wide */}
              <BentoGridItem
                className="border-[var(--border)] bg-[var(--surface)] md:col-span-2"
                title="Latest Cinematic Short — Stats"
                description="Combined reach across every synced platform for the most recent release."
                icon={<Camera className="h-4 w-4 text-[var(--accent)]" />}
                header={
                  <div className="flex h-full min-h-[6rem] w-full flex-col justify-end gap-2 rounded-xl border border-[var(--border)] bg-gradient-to-br from-[#6344F5]/25 to-transparent p-4">
                    {[
                      { k: 'Views', v: combined.views || 0 },
                      { k: 'Likes', v: combined.likes || 0 },
                      { k: 'Comments', v: combined.comments || 0 }
                    ].map((row, i) => (
                      <div key={row.k} className="flex items-center gap-3">
                        <span className="w-20 shrink-0 text-[10px] uppercase tracking-wider text-[var(--muted)]">
                          {row.k}
                        </span>
                        <motion.div
                          className="h-2 rounded-full bg-gradient-to-r from-[#6344F5] to-[#AE48FF]"
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(90, 30 + i * 22)}%` }}
                          transition={{ duration: 1.1, delay: 0.2 + i * 0.1, ease: easeOutExpo }}
                        />
                        <span className="ml-auto text-xs font-semibold tabular-nums text-[var(--text)]">
                          {row.v}
                        </span>
                      </div>
                    ))}
                  </div>
                }
              />

              {/* Active Campaigns */}
              <BentoGridItem
                className="border-[var(--border)] bg-[var(--surface)]"
                title="Active Campaigns"
                description={`${stats.campaigns} campaign${stats.campaigns === 1 ? '' : 's'} in flight right now.`}
                icon={<GitBranch className="h-4 w-4 text-sky-400" />}
                header={
                  <div className="relative flex h-full min-h-[6rem] w-full items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-gradient-to-br from-sky-500/20 to-transparent">
                    <Meteors number={12} />
                    <span className="relative text-5xl font-bold tabular-nums text-[var(--text)]">
                      {stats.campaigns}
                    </span>
                  </div>
                }
              />

              {/* Pending Approvals */}
              <BentoGridItem
                className="border-[var(--border)] bg-[var(--surface)]"
                title="Pending Approvals"
                description="Variants waiting on a reviewer before they can ship."
                icon={<CheckCircle2 className="h-4 w-4 text-amber-400" />}
                header={
                  <div className="flex h-full min-h-[6rem] w-full flex-col justify-center gap-2 rounded-xl border border-[var(--border)] bg-gradient-to-br from-amber-500/20 to-transparent p-4">
                    <div className="text-5xl font-bold tabular-nums text-[var(--text)]">{stats.queued}</div>
                    <p className="text-[11px] text-[var(--muted)]">
                      {stats.published} already published
                    </p>
                  </div>
                }
              />

              {/* Engagement */}
              <BentoGridItem
                className="border-[var(--border)] bg-[var(--surface)] md:col-span-2"
                title="Engagement Rate"
                description="Official synced platform engagement — unsupported metrics stay unavailable."
                icon={<Sparkles className="h-4 w-4 text-emerald-400" />}
                header={
                  <div className="flex h-full min-h-[6rem] w-full items-end justify-between rounded-xl border border-[var(--border)] bg-gradient-to-br from-emerald-500/20 to-transparent p-4">
                    <span className="text-5xl font-bold tabular-nums text-[var(--text)]">
                      {combined.engagementRate || 0}%
                    </span>
                    <div className="flex items-end gap-1.5">
                      {[38, 62, 45, 78, 56, 88, 70].map((h, i) => (
                        <motion.span
                          key={i}
                          className="w-2 rounded-sm bg-gradient-to-t from-emerald-500/40 to-emerald-300"
                          initial={{ height: 0 }}
                          animate={{ height: `${h * 0.5}px` }}
                          transition={{ duration: 0.8, delay: 0.3 + i * 0.06, ease: easeOutExpo }}
                        />
                      ))}
                    </div>
                  </div>
                }
              />
            </BentoGrid>
          </motion.section>

          {/* ── Statistics panel (real data, behaviour unchanged) ────── */}
          <motion.section variants={rise} className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface2)] p-6 backdrop-blur-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Real creator statistics
                  </p>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight text-[var(--text)]">Statistics</h2>
                  <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
                    Combined and per-platform metrics come from synced official platform data.
                    Unsupported or unsynced metrics stay unavailable.
                  </p>
                </div>
                <AnimatedButton
                  id="dashboard-stats-snapshot-btn"
                  variant="primary"
                  size="lg"
                  onClick={snapshot}
                  className="group shrink-0"
                >
                  Create application snapshot
                  <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </AnimatedButton>
              </div>
            </div>

            {statistics?.unavailableMessage && (
              <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                {statistics.unavailableMessage}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-4">
              <CreatorStatsCard label="Views" value={combined.views || 0} />
              <CreatorStatsCard label="Likes" value={combined.likes || 0} />
              <CreatorStatsCard label="Comments" value={combined.comments || 0} />
              <CreatorStatsCard label="Engagement rate" value={`${combined.engagementRate || 0}%`} />
            </div>

            <CombinedStatsGraph platformStats={statistics?.platformStats || []} />
          </motion.section>

          {/* ── Demo path + live feed ───────────────────────────────── */}
          <motion.section variants={rise} className="grid gap-4 lg:grid-cols-[1fr_420px]">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface2)] p-6 backdrop-blur-sm">
              <h2 className="text-lg font-semibold tracking-tight text-[var(--text)]">Demo path</h2>
              <ol className="mt-4 space-y-3">
                {[
                  'Create a campaign and raw idea.',
                  'Generate platform variants and submit one for review.',
                  'Connect real accounts, approve the variant, and publish from the creator workflow.',
                  'Schedule or publish through official connector checks and watch events appear live.',
                  'Sync analytics, then review real statistics here on the dashboard.'
                ].map((step, i) => (
                  <li key={step} className="flex gap-3 text-sm text-[var(--text-2)]">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface2)] text-[10px] font-semibold text-[var(--accent)]">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
            <LiveEventFeed compact />
          </motion.section>
        </motion.div>
      </div>
    </AppShell>
  );
}
