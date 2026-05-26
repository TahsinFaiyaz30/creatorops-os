'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, CheckCircle2, GitBranch, Radio, RadioTower } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import LiveEventFeed from '../../components/events/LiveEventFeed';
import CombinedStatsGraph from '../../components/statistics/CombinedStatsGraph';
import RoleBadge from '../../components/layout/RoleBadge';
import { api } from '../../lib/api';
import { getUser } from '../../lib/auth';

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ campaigns: 0, accounts: 0, queued: 0, published: 0, events: 0, platformStats: [] });

  useEffect(() => {
    setUser(getUser());
    Promise.allSettled([
      api.get('/api/campaigns'),
      api.get('/api/events?limit=30'),
      api.get('/api/publish/jobs'),
      api.get('/api/platform-connections')
    ]).then(results => {
      const publishJobs = results[2].value?.data?.publishJobs || [];
      setStats({
        campaigns: results[0].value?.data?.campaigns?.length || 0,
        accounts: results[3].value?.data?.connections?.length || 0,
        queued: publishJobs.filter(job => job.status === 'queued').length,
        published: publishJobs.filter(job => job.status === 'published').length,
        events: results[1].value?.data?.events?.length || 0,
        platformStats: results[3].value?.data?.connections || [],
      });
    });
  }, []);

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-mint">Workflow control center</p>
              <h1 className="mt-2 text-3xl font-bold text-[var(--text)]">Welcome back{user?.name ? `, ${user.name}` : ''}</h1>
            </div>
            <RoleBadge role={user?.role} />
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-5">
          <StatCard icon={GitBranch} label="Campaigns" value={stats.campaigns} />
          <StatCard icon={RadioTower} label="Accounts" value={stats.accounts} />
          <StatCard icon={CalendarClock} label="Queued jobs" value={stats.queued} />
          <StatCard icon={Radio} label="Recent events" value={stats.events} />
        </section>

        <CombinedStatsGraph platformStats={stats.platformStats} />

        <section className="grid gap-4 lg:grid-cols-[1fr_420px]">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="text-lg font-semibold text-[var(--text)]">Demo path</h2>
            <div className="mt-4 grid gap-3 text-sm text-[var(--text)]">
              <p>1. Create a campaign and raw idea.</p>
              <p>2. Generate platform variants and submit one for review.</p>
              <p>3. Switch to Creator/Admin to approve and connect real accounts.</p>
              <p>4. Schedule or publish through official connector checks and watch events appear live.</p>
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
