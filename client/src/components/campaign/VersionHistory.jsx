'use client';

import { useState } from 'react';
import { History } from 'lucide-react';
import { api } from '../../lib/api';

export default function VersionHistory({ contentItemId }) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setOpen(current => !current);
    if (open || versions.length > 0) return;

    setBusy(true);
    setError('');
    try {
      const payload = await api.get(`/api/content/${contentItemId}/versions`);
      setVersions(payload.data.versions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={load}
        className="focus-ring inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-xs text-slate-200 hover:bg-white/5"
      >
        <History size={14} />
        Version history
      </button>
      {open && (
        <div className="mt-3 rounded-md border border-line bg-ink/70 p-3">
          {busy && <p className="text-sm text-slate-400">Loading versions...</p>}
          {error && <p className="text-sm text-rose">{error}</p>}
          {!busy && versions.length === 0 && !error && <p className="text-sm text-slate-400">No versions yet.</p>}
          <div className="space-y-2">
            {versions.map(version => (
              <div key={version._id} className="rounded border border-line bg-panel p-3 text-xs text-slate-300">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Version {version.versionNumber}</span>
                  <span className="text-slate-500">{new Date(version.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-slate-400">{version.changeNote || 'Snapshot saved'}</p>
                <div className="mt-2 grid gap-1 text-slate-400">
                  <span>Status: {version.snapshot?.status || version.snapshot?.variantStatus || version.snapshot?.contentItemStatus || 'n/a'}</span>
                  {version.snapshot?.approvalStatus && <span>Approval: {version.snapshot.approvalStatus}</span>}
                  {version.snapshot?.scheduleJobStatus && <span>Schedule: {version.snapshot.scheduleJobStatus}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
