'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { RotateCcw, Send, XCircle } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { getUser } from '../../lib/auth';
import { formatPlatform } from '../../lib/platforms';
import { canPublish } from '../../lib/roles';

const statusOrder = ['queued', 'publishing', 'published', 'failed', 'blocked', 'cancelled'];

export default function PublishingPage() {
  const [user, setUser] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = async () => {
    const payload = await api.get('/api/publish/jobs');
    setJobs(payload.data.publishJobs || []);
  };

  useEffect(() => {
    setUser(getUser());
    load().catch(err => setMessage(err.message));
    const socket = getSocket();
    const handler = () => load().catch(() => {});
    socket.on('publishing:job_updated', handler);
    return () => socket.off('publishing:job_updated', handler);
  }, []);

  const grouped = useMemo(
    () =>
      statusOrder.reduce((groups, status) => {
        groups[status] = jobs.filter(job => job.status === status);
        return groups;
      }, {}),
    [jobs]
  );

  const retry = async job => {
    setBusyId(job._id);
    setMessage('');
    try {
      await api.post(`/api/publish/jobs/${job._id}/retry`, {});
      setMessage('Publish job re-queued.');
      await load();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusyId('');
    }
  };

  const cancel = async job => {
    setBusyId(job._id);
    setMessage('');
    try {
      await api.post(`/api/publish/jobs/${job._id}/cancel`, {});
      setMessage('Publish job cancelled.');
      await load();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusyId('');
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-mint">Unified publishing center</p>
          <h1 className="mt-2 text-3xl font-bold text-[var(--text)]">Real Publish Jobs</h1>
          <p className="mt-2 max-w-4xl text-sm text-[var(--muted)]">
            Jobs only become published after an official connector returns a real provider post id or URL. Missing credentials, scopes, review, or unsupported API methods appear as blocked/failed states.
          </p>
          <Link href="/compose" className="focus-ring mt-4 inline-flex items-center gap-2 rounded-xl bg-mint px-3 py-2 text-sm font-semibold text-[#05130d]">
            <Send size={15} />
            Open Compose
          </Link>
        </header>

        {message && <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--text)]">{message}</div>}

        <div className="grid gap-4 2xl:grid-cols-3">
          {statusOrder.map(status => (
            <section key={status} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text)]">{status}</h2>
                <span className="rounded-full bg-mint/10 px-2 py-1 text-xs text-mint">{grouped[status]?.length || 0}</span>
              </div>
              <div className="space-y-3">
                {(grouped[status] || []).map(job => (
                  <JobCard
                    key={job._id}
                    job={job}
                    user={user}
                    busy={busyId === job._id}
                    onRetry={() => retry(job)}
                    onCancel={() => cancel(job)}
                  />
                ))}
                {(grouped[status] || []).length === 0 && <p className="text-sm text-[var(--muted)]">No {status} jobs.</p>}
              </div>
            </section>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function JobCard({ job, user, busy, onRetry, onCancel }) {
  const account = job.accountSnapshot || job.platformConnectionId || {};
  const media = job.mediaAssetIds?.[0];

  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-mint/10 px-2 py-1 text-xs font-semibold text-mint">{formatPlatform(job.platform)}</span>
        <span className="text-xs text-[var(--muted)]">{new Date(job.scheduledAt).toLocaleString()}</span>
      </div>
      {media?.publicUrl && (
        <div className="mt-3 aspect-[9/16] max-h-56 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {media.mediaType === 'video' ? (
            <video src={media.publicUrl} className="h-full w-full object-cover" controls />
          ) : (
            <img src={media.publicUrl} alt={media.originalName || 'media'} className="h-full w-full object-cover" />
          )}
        </div>
      )}
      <p className="mt-3 line-clamp-4 text-xs text-[var(--text)]">{job.caption || job.variantId?.caption || 'No caption'}</p>
      <div className="mt-3 grid gap-1 text-xs text-[var(--muted)]">
        <span>Account: {account.accountName || 'n/a'} {account.accountHandle ? `(${account.accountHandle})` : ''}</span>
        <span>Visibility: {job.visibility || 'public'}</span>
        {job.providerPostUrl ? (
          <a href={job.providerPostUrl} target="_blank" rel="noreferrer" className="text-mint underline">View on platform</a>
        ) : (
          <span>Provider URL: not returned</span>
        )}
        {job.errorMessage && <span className="text-rose">Reason: {job.errorMessage}</span>}
      </div>
      {canPublish(user?.role) && ['failed', 'blocked'].includes(job.status) && (
        <button type="button" onClick={onRetry} disabled={busy} className="focus-ring mt-3 inline-flex items-center gap-2 rounded-xl bg-gold px-3 py-2 text-xs font-semibold text-[#05130d]">
          <RotateCcw size={14} />
          Retry
        </button>
      )}
      {canPublish(user?.role) && ['queued', 'failed', 'blocked'].includes(job.status) && (
        <button type="button" onClick={onCancel} disabled={busy} className="focus-ring ml-2 mt-3 inline-flex items-center gap-2 rounded-xl border border-rose/40 px-3 py-2 text-xs text-rose hover:bg-rose/10">
          <XCircle size={14} />
          Cancel
        </button>
      )}
    </article>
  );
}
