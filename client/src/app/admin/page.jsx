'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Database, ExternalLink, Server, Shield, Users } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import RoleBadge from '../../components/layout/RoleBadge';
import { api } from '../../lib/api';
import { getUser } from '../../lib/auth';

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const u = getUser();
    if (u?.role !== 'creator_admin') {
      router.replace('/dashboard');
      return;
    }
    setUser(u);

    Promise.allSettled([
      api.get('/api/campaigns'),
      api.get('/api/platform-connections'),
      api.get('/api/publish/jobs'),
      api.get('/api/events?limit=5'),
    ]).then(([camps, conns, jobs, evts]) => {
      setStats({
        campaigns:   camps.value?.data?.campaigns?.length   ?? 'N/A',
        connections: conns.value?.data?.connections?.length ?? 'N/A',
        publishJobs: jobs.value?.data?.publishJobs?.length  ?? 'N/A',
        events:      evts.value?.data?.events?.length       ?? 'N/A',
      });
    });
  }, [router]);

  if (!user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <header className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-mint">System</p>
              <h1 className="mt-1 text-2xl font-bold text-[var(--text)]">Admin Panel</h1>
              <p className="mt-1 text-sm text-[var(--muted)]">Workspace overview and system information.</p>
            </div>
            <RoleBadge role={user.role} />
          </div>
        </header>

        {/* Current user */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={17} className="text-mint" />
            <h2 className="text-base font-semibold text-[var(--text)]">Current Session</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Name',  value: user.name },
              { label: 'Email', value: user.email },
              { label: 'Role',  value: <RoleBadge role={user.role} /> },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-4">
                <div className="text-xs text-[var(--muted)] uppercase tracking-wide mb-1">{label}</div>
                <div className="text-sm font-semibold text-[var(--text)]">{value}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Workspace stats */}
        {stats && (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Database size={17} className="text-mint" />
              <h2 className="text-base font-semibold text-[var(--text)]">Workspace Overview</h2>
            </div>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              {[
                { label: 'Campaigns',    value: stats.campaigns },
                { label: 'Connections',  value: stats.connections },
                { label: 'Publish Jobs', value: stats.publishJobs },
                { label: 'Events',       value: stats.events },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-4">
                  <div className="text-xs text-[var(--muted)] uppercase tracking-wide">{label}</div>
                  <div className="mt-1 text-2xl font-bold text-[var(--text)]">{value}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Docs links */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Server size={17} className="text-mint" />
            <h2 className="text-base font-semibold text-[var(--text)]">Resources</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: 'Architecture Overview', href: '/architecture' },
              { label: 'API Documentation',      href: '/architecture#api' },
            ].map(({ label, href }) => (
              <a
                key={label}
                href={href}
                className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-3 text-sm font-medium text-[var(--text)] transition hover:border-mint/50 hover:text-mint"
              >
                {label}
                <ExternalLink size={14} className="opacity-50" />
              </a>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
