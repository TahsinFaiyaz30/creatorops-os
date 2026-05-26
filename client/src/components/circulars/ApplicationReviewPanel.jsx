'use client';

import { api } from '../../lib/api';
import { formatPlatform } from '../../lib/platforms';

export default function ApplicationReviewPanel({ applications, onChanged }) {
  const act = async (application, action) => {
    await api.post(`/api/applications/${application._id}/${action}`, { reviewComment: `${action} from review panel` });
    await onChanged();
  };

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="text-lg font-semibold text-[var(--text)]">Applications</h2>
      <div className="mt-4 space-y-3">
        {applications.map(application => (
          <article key={application._id} className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-[var(--text)]">{application.creatorId?.name || 'Creator'}</div>
                <div className="text-xs text-[var(--muted)]">{application.creatorId?.email}</div>
              </div>
              <span className="rounded-full bg-mint/10 px-2 py-1 text-xs text-mint">{application.status}</span>
            </div>
            <p className="mt-2 text-sm text-[var(--text)]">{application.message || 'No message.'}</p>
            <p className="mt-2 text-xs text-[var(--muted)]">{application.creatorProfileSummary}</p>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <MiniMetric label="Views" value={application.combinedStatsSnapshot?.views || 0} />
              <MiniMetric label="Comments" value={application.combinedStatsSnapshot?.comments || 0} />
              <MiniMetric label="Engagement" value={`${application.combinedStatsSnapshot?.engagementRate || 0}%`} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(application.platformStatsSnapshot || []).filter(item => item.source === 'real_sync').map(item => (
                <span key={item.platform} className="rounded-full bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text)]">{formatPlatform(item.platform)}</span>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => act(application, 'view-profile')} className="focus-ring rounded-xl border border-[var(--border)] px-3 py-2 text-xs text-[var(--text)] hover:bg-white/5">View profile</button>
              <button onClick={() => act(application, 'shortlist')} className="focus-ring rounded-xl bg-mint px-3 py-2 text-xs font-semibold text-[#05130d]">Shortlist</button>
              <button onClick={() => act(application, 'accept')} className="focus-ring rounded-xl bg-mint px-3 py-2 text-xs font-semibold text-[#05130d]">Accept</button>
              <button onClick={() => act(application, 'reject')} className="focus-ring rounded-xl border border-rose/40 px-3 py-2 text-xs text-rose hover:bg-rose/10">Reject</button>
            </div>
          </article>
        ))}
        {applications.length === 0 && <p className="text-sm text-[var(--muted)]">No applications yet.</p>}
      </div>
    </section>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2">
      <div className="text-[10px] uppercase text-[var(--muted)]">{label}</div>
      <div className="text-base font-bold text-[var(--text)]">{value}</div>
    </div>
  );
}
