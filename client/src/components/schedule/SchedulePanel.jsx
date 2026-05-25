'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Send } from 'lucide-react';
import { api } from '../../lib/api';
import { formatPlatform } from '../../lib/platforms';

export default function SchedulePanel({ variant, user, onDone }) {
  const defaultTime = useMemo(() => {
    const date = new Date(Date.now() + 2 * 60 * 60 * 1000);
    return date.toISOString().slice(0, 16);
  }, []);
  const [scheduledAt, setScheduledAt] = useState(defaultTime);
  const [connections, setConnections] = useState([]);
  const [platformConnectionId, setPlatformConnectionId] = useState('');
  const [job, setJob] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!variant?.platform || !['approved', 'scheduled', 'published'].includes(variant.status)) return;

    api
      .get(`/api/platform-connections?platform=${variant.platform}`)
      .then(payload => {
        const matching = (payload.data.connections || []).filter(connection => connection.status === 'connected');
        setConnections(matching);
        setPlatformConnectionId(current => current || matching[0]?._id || '');
      })
      .catch(err => setMessage(err.message));
  }, [variant?.platform, variant?.status]);

  if (!variant || !['approved', 'scheduled', 'published'].includes(variant.status)) {
    return null;
  }

  const schedule = async () => {
    setBusy(true);
    setMessage('');
    try {
      const iso = new Date(scheduledAt).toISOString();
      const payload = await api.post('/api/publish/schedule', {
        variantId: variant._id,
        platformConnectionId,
        caption: variant.caption,
        scheduledAt: iso
      });
      setJob(payload.data.publishJob);
      setMessage('Real publish job scheduled.');
      onDone?.();
    } catch (err) {
      if (err.status === 403) {
        setMessage('Backend blocked scheduling: only Creator/Admin can schedule.');
      } else if (err.status === 400 && err.message.includes('approved')) {
        setMessage('Only approved variants can be scheduled.');
      } else {
        setMessage(err.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const publishNow = async () => {
    setBusy(true);
    setMessage('');
    try {
      const payload = await api.post('/api/publish/now', {
        variantId: variant._id,
        platformConnectionId,
        caption: variant.caption
      });
      setJob(payload.data.publishJob);
      setMessage(payload.data.publishJob.errorMessage || `Job status: ${payload.data.publishJob.status}`);
      onDone?.();
    } catch (err) {
      setMessage(err.status === 403 ? 'Backend blocked publishing: only Creator/Admin can publish.' : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-md border border-line bg-ink/70 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <CalendarClock size={16} />
        Real Publishing
      </div>
      <p className="mt-1 text-xs text-slate-400">Target a connected {formatPlatform(variant.platform)} account. The backend blocks missing credentials, scopes, or unsupported connector methods.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={platformConnectionId}
          onChange={event => setPlatformConnectionId(event.target.value)}
          className="focus-ring rounded-md border border-line bg-panel px-3 py-2 text-sm text-white"
        >
          {connections.length === 0 ? (
            <option value="">No connected account</option>
          ) : (
            connections.map(connection => (
              <option key={connection._id} value={connection._id}>
                {connection.accountName} ({connection.accountHandle})
              </option>
            ))
          )}
        </select>
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={event => setScheduledAt(event.target.value)}
          className="focus-ring rounded-md border border-line bg-panel px-3 py-2 text-sm text-white"
        />
        <button
          type="button"
          onClick={schedule}
          disabled={busy || user?.role !== 'creator_admin' || variant.status !== 'approved' || !platformConnectionId}
          className="focus-ring inline-flex items-center gap-2 rounded-md bg-gold px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50"
        >
          <CalendarClock size={15} />
          Schedule
        </button>
        <button
          type="button"
          onClick={publishNow}
          disabled={busy || user?.role !== 'creator_admin' || variant.status !== 'approved' || !platformConnectionId}
          className="focus-ring inline-flex items-center gap-2 rounded-md bg-mint px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50"
        >
          <Send size={15} />
          Publish now
        </button>
      </div>
      {connections.length === 0 && <p className="mt-2 text-xs text-gold">Connect a real {formatPlatform(variant.platform)} account before scheduling or publishing.</p>}
      {job && (
        <p className="mt-2 text-xs text-slate-400">
          Job status: {job.status}
          {job.accountSnapshot?.accountHandle ? ` for ${job.accountSnapshot.accountHandle}` : ''}
        </p>
      )}
      {message && <p className="mt-2 text-sm text-slate-300">{message}</p>}
    </div>
  );
}
