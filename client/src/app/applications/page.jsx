'use client';

import { useEffect, useState } from 'react';
import AppShell from '../../components/layout/AppShell';
import { api } from '../../lib/api';

export default function ApplicationsPage() {
  const [applications, setApplications] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get('/api/applications')
      .then(payload => setApplications(payload.data.applications || []))
      .catch(err => setMessage(err.message));
  }, []);

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="rounded-lg border border-line bg-panel p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-cyan">Creator applications</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Applications</h1>
        </header>
        {message && <div className="rounded-md border border-line bg-panel p-3 text-sm text-slate-300">{message}</div>}
        <section className="grid gap-3">
          {applications.map(application => (
            <article key={application._id} className="rounded-lg border border-line bg-panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-white">{application.circularId?.title || 'Circular'}</h2>
                  <p className="mt-1 text-sm text-slate-400">{application.creatorId?.name || 'Creator'} · {application.creatorId?.email}</p>
                </div>
                <span className="rounded-full bg-cyan/10 px-2 py-1 text-xs text-cyan">{application.status}</span>
              </div>
              <p className="mt-3 text-sm text-slate-300">{application.message || application.reviewComment || 'No message.'}</p>
            </article>
          ))}
          {applications.length === 0 && <p className="rounded-lg border border-line bg-panel p-5 text-sm text-slate-500">No applications yet.</p>}
        </section>
      </div>
    </AppShell>
  );
}
