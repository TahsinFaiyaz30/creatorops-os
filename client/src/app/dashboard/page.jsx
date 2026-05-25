'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, GitBranch, Radio } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import LiveEventFeed from '../../components/events/LiveEventFeed';
import RoleBadge from '../../components/layout/RoleBadge';
import { api } from '../../lib/api';
import { getUser } from '../../lib/auth';

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ campaigns: 0, events: 0, scheduled: 0 });

  useEffect(() => {
    setUser(getUser());
    Promise.allSettled([
      api.get('/api/campaigns'),
      api.get('/api/events?limit=30'),
      api.get('/api/schedule')
    ]).then(results => {
      setStats({
        campaigns: results[0].value?.data?.campaigns?.length || 0,
        events: results[1].value?.data?.events?.length || 0,
        scheduled: results[2].value?.data?.scheduleJobs?.length || 0
      });
    });
  }, []);

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="rounded-lg border border-line bg-panel p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-cyan">Workflow control center</p>
              <h1 className="mt-2 text-3xl font-bold text-white">Welcome back{user?.name ? `, ${user.name}` : ''}</h1>
            </div>
            <RoleBadge role={user?.role} />
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <StatCard icon={GitBranch} label="Campaigns" value={stats.campaigns} />
          <StatCard icon={Radio} label="Recent events" value={stats.events} />
          <StatCard icon={CalendarClock} label="Schedule jobs" value={stats.scheduled} />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_420px]">
          <div className="rounded-lg border border-line bg-panel p-5">
            <h2 className="text-lg font-semibold text-white">Demo path</h2>
            <div className="mt-4 grid gap-3 text-sm text-slate-300">
              <p>1. Create a campaign and raw idea.</p>
              <p>2. Generate platform variants and submit one for review.</p>
              <p>3. Switch to Creator/Admin to approve and schedule.</p>
              <p>4. Run the publishing simulator and watch events appear live.</p>
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
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{label}</span>
        <Icon className="text-cyan" size={18} />
      </div>
      <div className="mt-3 text-3xl font-bold text-white">{value}</div>
    </div>
  );
}
