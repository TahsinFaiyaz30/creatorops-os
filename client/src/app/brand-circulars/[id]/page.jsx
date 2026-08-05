'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AppShell from '../../../components/layout/AppShell';
import CircularApplicationForm from '../../../components/circulars/CircularApplicationForm';
import ApplicationReviewPanel from '../../../components/circulars/ApplicationReviewPanel';
import { api } from '../../../lib/api';
import { getUser } from '../../../lib/auth';
import { formatPlatform } from '../../../lib/platforms';
import { isBrandRep } from '../../../lib/roles';

export default function BrandCircularDetailPage() {
  const params = useParams();
  const [user, setUser] = useState(null);
  const [circular, setCircular] = useState(null);
  const [applications, setApplications] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  const load = async () => {
    const [circularPayload, statsPayload] = await Promise.all([
      api.get(`/api/brand-circulars/${params.id}`),
      api.get('/api/statistics/creator').catch(() => null)
    ]);
    setCircular(circularPayload.data.circular);
    setStatistics(statsPayload?.data?.statistics || null);
    const currentUser = getUser();
    if (isBrandRep(currentUser)) {
      const appPayload = await api.get(`/api/brand-circulars/${params.id}/applications`);
      setApplications(appPayload.data.applications || []);
    }
  };

  useEffect(() => {
    setUser(getUser());
    load().catch(err => setMessage(err.message));
  }, [params.id]);

  const transition = async action => {
    setBusy(action);
    try {
      const payload = await api.post(`/api/brand-circulars/${params.id}/${action}`, {});
      setCircular(payload.data.circular);
      setMessage(`Circular ${action} complete.`);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
    }
  };

  const apply = async body => {
    setBusy('apply');
    try {
      await api.post(`/api/brand-circulars/${params.id}/apply`, body);
      setMessage('Application submitted with current statistics snapshot.');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
    }
  };

  if (!circular) {
    return <AppShell><div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--text)]">Loading circular...</div></AppShell>;
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-mint">Circular detail</p>
              <h1 className="mt-2 text-3xl font-bold text-[var(--text)]">{circular.title}</h1>
              <p className="mt-2 text-sm text-[var(--muted)]">{circular.productName} · {circular.productCategory}</p>
            </div>
            <span className="rounded-full bg-mint/10 px-3 py-1 text-sm font-semibold text-mint">{circular.status}</span>
          </div>
          <p className="mt-4 max-w-4xl text-sm text-[var(--text)]">{circular.productDescription}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(circular.platforms || []).map(platform => <span key={platform} className="rounded-full bg-[var(--surface2)] px-2 py-1 text-xs text-[var(--text)]">{formatPlatform(platform)}</span>)}
          </div>
        </header>
        {message && <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--text)]">{message}</div>}
        <section className="grid gap-4 md:grid-cols-3">
          <Info label="Deadline" value={circular.deadline ? new Date(circular.deadline).toLocaleString() : 'n/a'} />
          <Info label="Budget" value={`${circular.budgetAmount || 0} ${circular.currency || 'USD'}`} />
          <Info label="Target" value={circular.targetAudience || 'n/a'} />
        </section>
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text)]">
          <h2 className="text-lg font-semibold text-[var(--text)]">Requirements</h2>
          <p className="mt-2">Objective: {circular.campaignObjective || 'n/a'}</p>
          <p className="mt-2">Eligibility: {circular.eligibilityRequirements || 'n/a'}</p>
          <p className="mt-2">Brand demands: {circular.brandDemands || 'n/a'}</p>
          <p className="mt-2">Judging criteria: {circular.judgingCriteria || 'n/a'}</p>
        </section>

        {isBrandRep(user) ? (
          <>
            <div className="flex flex-wrap gap-2">
              <button disabled={busy === 'publish'} onClick={() => transition('publish')} className="focus-ring rounded-xl bg-mint px-3 py-2 text-sm font-semibold text-[var(--accent-fg)]">Publish</button>
              <button disabled={busy === 'close'} onClick={() => transition('close')} className="focus-ring rounded-xl bg-gold px-3 py-2 text-sm font-semibold text-[var(--accent-fg)]">Close</button>
              <button disabled={busy === 'archive'} onClick={() => transition('archive')} className="focus-ring rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]">Archive</button>
            </div>
            <ApplicationReviewPanel applications={applications} onChanged={load} />
          </>
        ) : (
          <CircularApplicationForm statistics={statistics} busy={busy === 'apply'} onSubmit={apply} />
        )}
      </div>
    </AppShell>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-sm font-semibold text-[var(--text)]">{value}</div>
    </div>
  );
}
