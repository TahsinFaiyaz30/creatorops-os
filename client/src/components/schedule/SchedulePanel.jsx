'use client';

import { useMemo, useState } from 'react';
import { CalendarClock, Send } from 'lucide-react';
import { api } from '../../lib/api';

export default function SchedulePanel({ variant, user, onDone }) {
  const defaultTime = useMemo(() => {
    const date = new Date(Date.now() + 2 * 60 * 60 * 1000);
    return date.toISOString().slice(0, 16);
  }, []);
  const [scheduledAt, setScheduledAt] = useState(defaultTime);
  const [job, setJob] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  if (!variant || !['approved', 'scheduled', 'published'].includes(variant.status)) {
    return null;
  }

  const schedule = async () => {
    setBusy(true);
    setMessage('');
    try {
      const iso = new Date(scheduledAt).toISOString();
      const payload = await api.post('/api/schedule', { variantId: variant._id, scheduledAt: iso });
      setJob(payload.data.scheduleJob);
      setMessage('Schedule job created.');
      onDone?.();
    } catch (err) {
      setMessage(err.status === 403 ? 'Backend blocked scheduling: only Creator/Admin can schedule.' : err.message);
    } finally {
      setBusy(false);
    }
  };

  const runNow = async () => {
    if (!job?._id) return;
    setBusy(true);
    setMessage('');
    try {
      const payload = await api.post(`/api/schedule/${job._id}/run-now`, {});
      setJob(payload.data.scheduleJob);
      setMessage(payload.data.scheduleJob.resultMessage || 'Publishing simulator finished.');
      onDone?.();
    } catch (err) {
      setMessage(err.status === 403 ? 'Backend blocked publishing: only Creator/Admin can run the simulator.' : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-md border border-line bg-ink/70 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <CalendarClock size={16} />
        Schedule approved variant
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={event => setScheduledAt(event.target.value)}
          className="focus-ring rounded-md border border-line bg-panel px-3 py-2 text-sm text-white"
        />
        <button
          type="button"
          onClick={schedule}
          disabled={busy || variant.status === 'published'}
          className="focus-ring inline-flex items-center gap-2 rounded-md bg-gold px-3 py-2 text-sm font-semibold text-ink"
        >
          <CalendarClock size={15} />
          Schedule
        </button>
        {job && (
          <button
            type="button"
            onClick={runNow}
            disabled={busy || job.status === 'published'}
            className="focus-ring inline-flex items-center gap-2 rounded-md bg-mint px-3 py-2 text-sm font-semibold text-ink"
          >
            <Send size={15} />
            Run now
          </button>
        )}
      </div>
      {job && <p className="mt-2 text-xs text-slate-400">Job status: {job.status}</p>}
      {message && <p className="mt-2 text-sm text-slate-300">{message}</p>}
    </div>
  );
}
