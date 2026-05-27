'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, CheckCircle2, GitBranch, Radio, RadioTower } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import LiveEventFeed from '../../components/events/LiveEventFeed';
import CreatorStatsCard from '../../components/statistics/CreatorStatsCard';
import CombinedStatsGraph from '../../components/statistics/CombinedStatsGraph';
import RoleBadge from '../../components/layout/RoleBadge';
import { api } from '../../lib/api';
import { getUser } from '../../lib/auth';

export default function DashboardPage() {
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

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-mint">Workflow control center</p>
              <h1 className="mt-2 text-3xl font-bold text-[var(--text)]">Welcome back{user?.name ? `, ${user.name}` : ''}</h1>
              <p className="mt-2 max-w-4xl text-sm text-[var(--muted)]">
                Dashboard now includes the real creator statistics view. Only official synced platform metrics are counted.
              </p>
            </div>
            <RoleBadge user={user} />
          </div>
        </header>

        {message && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--text)]">{message}</div>
        )}

        <section className="grid gap-4 md:grid-cols-5">
          <StatCard icon={GitBranch} label="Campaigns" value={stats.campaigns} />
          <StatCard icon={RadioTower} label="Accounts" value={stats.accounts} />
          <StatCard icon={CalendarClock} label="Queued jobs" value={stats.queued} />
          <StatCard icon={CheckCircle2} label="Published jobs" value={stats.published} />
          <StatCard icon={Radio} label="Recent events" value={stats.events} />
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-mint">Real creator statistics</p>
                <h2 className="mt-2 text-2xl font-bold text-[var(--text)]">Statistics</h2>
                <p className="mt-2 max-w-4xl text-sm text-[var(--muted)]">
                  Combined and per-platform metrics come from synced official platform data. Unsupported or unsynced metrics stay unavailable.
                </p>
              </div>
              <button
                id="dashboard-stats-snapshot-btn"
                onClick={snapshot}
                className="focus-ring rounded-xl bg-mint px-3 py-2 text-sm font-semibold text-[#05130d]"
              >
                Create application snapshot
              </button>
            </div>
          </div>

          {statistics?.unavailableMessage && (
            <div className="rounded-xl border border-gold/30 bg-gold/10 p-3 text-sm text-gold">
              {statistics.unavailableMessage}
            </div>
          )}

          <section className="grid gap-4 md:grid-cols-4">
            <CreatorStatsCard label="Views" value={combined.views || 0} />
            <CreatorStatsCard label="Likes" value={combined.likes || 0} />
            <CreatorStatsCard label="Comments" value={combined.comments || 0} />
            <CreatorStatsCard label="Engagement rate" value={`${combined.engagementRate || 0}%`} />
          </section>

          <CombinedStatsGraph platformStats={statistics?.platformStats || []} />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_420px]">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="text-lg font-semibold text-[var(--text)]">Demo path</h2>
            <div className="mt-4 grid gap-3 text-sm text-[var(--text)]">
              <p>1. Create a campaign and raw idea.</p>
              <p>2. Generate platform variants and submit one for review.</p>
              <p>3. Connect real accounts, approve the variant, and publish from the creator workflow.</p>
              <p>4. Schedule or publish through official connector checks and watch events appear live.</p>
              <p>5. Sync analytics, then review real statistics here on the dashboard.</p>
            </div>
          </div>
          <LiveEventFeed compact />
        </section>
      </div>
    </AppShell>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--muted)]">{label}</span>
        <Icon className="text-mint" size={18} />
      </div>
      <div className="mt-3 text-3xl font-bold text-[var(--text)]">{value}</div>
    </div>
  );
}
