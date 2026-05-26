'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AppShell from '../../components/layout/AppShell';
import CampaignForm from '../../components/campaign/CampaignForm';
import { api } from '../../lib/api';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const payload = await api.get('/api/campaigns');
      setCampaigns(payload.data.campaigns || []);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async form => {
    await api.post('/api/campaigns', form);
    await load();
  };

  return (
    <AppShell>
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <CampaignForm onCreate={create} />
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h1 className="text-xl font-bold text-[var(--text)]">Campaigns</h1>
          {error && <p className="mt-3 text-sm text-rose">{error}</p>}
          <div className="mt-4 grid gap-3">
            {campaigns.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No campaigns yet.</p>
            ) : (
              campaigns.map(campaign => (
                <Link key={campaign._id} href={`/campaigns/${campaign._id}`} className="rounded-2xl border border-[var(--border)] bg-[var(--surface2)] p-4 hover:border-mint/50">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-semibold text-[var(--text)]">{campaign.name}</h2>
                    <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-[var(--text)]">{campaign.status}</span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted)]">{campaign.goal || 'No goal set'}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(campaign.platforms || []).map(platform => (
                      <span key={platform} className="rounded-full bg-mint/10 px-2 py-1 text-xs text-mint">{platform}</span>
                    ))}
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
