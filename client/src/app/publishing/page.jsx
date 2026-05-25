'use client';

import { useEffect, useMemo, useState } from 'react';
import { Send } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { api } from '../../lib/api';
import { getUser } from '../../lib/auth';
import { formatPlatform } from '../../lib/platforms';

const statusOrder = ['queued', 'processing', 'published', 'failed'];

export default function PublishingPage() {
  const [user, setUser] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = async () => {
    const payload = await api.get('/api/schedule');
    setJobs(payload.data.scheduleJobs || []);
  };

  useEffect(() => {
    setUser(getUser());
    load().catch(err => setMessage(err.message));
  }, []);

  const grouped = useMemo(
    () =>
      statusOrder.reduce((groups, status) => {
        groups[status] = jobs.filter(job => job.status === status);
        return groups;
      }, {}),
    [jobs]
  );

  const runNow = async job => {
    setBusyId(job._id);
    setMessage('');
    try {
      await api.post(`/api/schedule/${job._id}/run-now`, {});
      setMessage('Publishing simulator completed.');
      await load();
    } catch (err) {
      setMessage(err.status === 403 ? 'Backend blocked publishing: only Creator/Admin can run the simulator.' : err.message);
    } finally {
      setBusyId('');
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="rounded-lg border border-line bg-panel p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-cyan">Unified publishing center</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Publishing Simulator</h1>
          <p className="mt-2 text-sm text-slate-400">Cross-platform schedule jobs grouped by status. Run Now publishes inside the local simulator only.</p>
        </header>
        {message && <div className="rounded-md border border-line bg-panel p-3 text-sm text-slate-300">{message}</div>}

        <div className="grid gap-4 xl:grid-cols-4">
          {statusOrder.map(status => (
            <section key={status} className="rounded-lg border border-line bg-panel p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-white">{status}</h2>
                <span className="rounded-full bg-cyan/10 px-2 py-1 text-xs text-cyan">{grouped[status]?.length || 0}</span>
              </div>
              <div className="space-y-3">
                {(grouped[status] || []).map(job => (
                  <JobCard key={job._id} job={job} user={user} busy={busyId === job._id} onRunNow={() => runNow(job)} />
                ))}
                {(grouped[status] || []).length === 0 && <p className="text-sm text-slate-500">No {status} jobs.</p>}
              </div>
            </section>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function JobCard({ job, user, busy, onRunNow }) {
  const variant = job.variantId || {};
  const content = job.contentItemId || {};
  const account = job.platformAccountSnapshot || job.platformAccountId || {};

  return (
    <article className="rounded-md border border-line bg-ink p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-cyan/10 px-2 py-1 text-xs font-semibold text-cyan">{formatPlatform(job.platform)}</span>
        <span className="text-xs text-slate-500">{new Date(job.scheduledAt).toLocaleString()}</span>
      </div>
      <h3 className="mt-3 text-sm font-semibold text-white">{content.title || 'Untitled content'}</h3>
      <p className="mt-2 line-clamp-4 text-xs text-slate-400">{variant.caption}</p>
      <div className="mt-3 grid gap-1 text-xs text-slate-300">
        <span>Account: {account.accountName || 'n/a'} {account.accountHandle ? `(${account.accountHandle})` : ''}</span>
        <span>Adapter: {job.adapterName}</span>
        {job.resultMessage && <span>Result: {job.resultMessage}</span>}
      </div>
      {user?.role === 'creator_admin' && job.status === 'queued' && (
        <button type="button" onClick={onRunNow} disabled={busy} className="focus-ring mt-3 inline-flex items-center gap-2 rounded-md bg-mint px-3 py-2 text-xs font-semibold text-ink">
          <Send size={14} />
          {busy ? 'Running...' : 'Run Now'}
        </button>
      )}
    </article>
  );
}
