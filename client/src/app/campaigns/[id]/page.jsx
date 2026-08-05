'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AppShell from '../../../components/layout/AppShell';
import ContentIdeaForm from '../../../components/campaign/ContentIdeaForm';
import ContentBoard from '../../../components/campaign/ContentBoard';
import LiveEventFeed from '../../../components/events/LiveEventFeed';
import { api } from '../../../lib/api';
import { getUser } from '../../../lib/auth';
import { formatPlatform, platformOptions } from '../../../lib/platforms';

export default function CampaignDetailPage() {
  const params = useParams();
  const campaignId = params.id;
  const [user, setUser] = useState(null);
  const [campaign, setCampaign] = useState(null);
  const [brandProfile, setBrandProfile] = useState(null);
  const [brandForm, setBrandForm] = useState({
    brandName: 'CodeSprint Academy',
    tone: 'friendly, confident, educational',
    targetAudience: 'beginner programmers and university students',
    bannedWords: 'guaranteed income, easy money',
    ctaStyle: 'clear, motivational, action-focused'
  });
  const [contentItems, setContentItems] = useState([]);
  const [variantsByContent, setVariantsByContent] = useState({});
  const [tracking, setTracking] = useState(null);
  const [message, setMessage] = useState('');

  const load = async () => {
    const [campaignPayload, brandPayload, contentPayload, trackingPayload] = await Promise.all([
      api.get(`/api/campaigns/${campaignId}`),
      api.get('/api/brand-profile'),
      api.get(`/api/content/campaign/${campaignId}`),
      api.get(`/api/campaigns/${campaignId}/tracking`)
    ]);

    const brand = brandPayload.data.brandProfile;
    setCampaign(campaignPayload.data.campaign);
    setTracking(trackingPayload.data.tracking);
    setBrandProfile(brand);
    if (brand) {
      setBrandForm({
        brandName: brand.brandName || '',
        tone: brand.tone || '',
        targetAudience: brand.targetAudience || '',
        bannedWords: (brand.bannedWords || []).join(', '),
        ctaStyle: brand.ctaStyle || ''
      });
    }

    const items = contentPayload.data.contentItems || [];
    setContentItems(items);
    const variantPairs = await Promise.all(
      items.map(async item => {
        const payload = await api.get(`/api/content/${item._id}/variants`);
        return [item._id, payload.data.variants || []];
      })
    );
    setVariantsByContent(Object.fromEntries(variantPairs));
  };

  useEffect(() => {
    setUser(getUser());
    load().catch(err => setMessage(err.message));
  }, [campaignId]);

  const saveBrand = async event => {
    event.preventDefault();
    setMessage('');
    const body = {
      ...brandForm,
      bannedWords: brandForm.bannedWords.split(',').map(item => item.trim()).filter(Boolean),
      preferredPlatforms: campaign?.platforms?.length ? campaign.platforms : platformOptions
    };

    try {
      const payload = brandProfile
        ? await api.patch('/api/brand-profile', body)
        : await api.post('/api/brand-profile', body);
      setBrandProfile(payload.data.brandProfile);
      setMessage('Brand profile saved.');
    } catch (err) {
      setMessage(err.message);
    }
  };

  const createContent = async form => {
    await api.post('/api/content', { ...form, campaignId });
    await load();
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-sm uppercase tracking-[0.18em] text-mint">Campaign</p>
          <h1 className="mt-2 text-3xl font-bold text-[var(--text)]">{campaign?.name || 'Loading campaign'}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{campaign?.goal}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(campaign?.platforms || []).map(platform => (
              <span key={platform} className="rounded-full bg-mint/10 px-2.5 py-1 text-xs text-mint">
                {formatPlatform(platform)}
              </span>
            ))}
          </div>
        </header>

        <CampaignTrackingPanel tracking={tracking} />

        <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
          <div className="space-y-4">
            <form onSubmit={saveBrand} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h2 className="text-base font-semibold text-[var(--text)]">Brand profile</h2>
              <div className="mt-4 grid gap-3">
                {['brandName', 'tone', 'targetAudience', 'bannedWords', 'ctaStyle'].map(field => (
                  <input
                    key={field}
                    className="focus-ring rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-sm text-[var(--text)]"
                    placeholder={field}
                    value={brandForm[field]}
                    onChange={event => setBrandForm({ ...brandForm, [field]: event.target.value })}
                  />
                ))}
              </div>
              <button className="focus-ring mt-4 rounded-xl bg-mint px-4 py-2 text-sm font-semibold text-[var(--accent-fg)]">
                {brandProfile ? 'Update brand' : 'Create brand'}
              </button>
            </form>
            <ContentIdeaForm onCreate={createContent} />
          </div>

          <div className="space-y-4">
            {message && <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--text)]">{message}</div>}
            <ContentBoard items={contentItems} variantsByContent={variantsByContent} user={user} onRefresh={load} />
          </div>
        </section>

        <LiveEventFeed compact />
      </div>
    </AppShell>
  );
}

function CampaignTrackingPanel({ tracking }) {
  if (!tracking) {
    return null;
  }

  const variants = tracking.variantsByStatus || {};
  const platforms = tracking.platformBreakdown || {};
  const accounts = Object.values(tracking.accountBreakdown || {});

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--text)]">Campaign Tracking</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Counts come from stored content, variants, real publish jobs, workflow events, and synced platform data.</p>
        </div>
        <div className="text-right text-xs text-[var(--muted)]">
          <div>{tracking.totalContentItems} content items</div>
          <div>{tracking.totalVariants} variants</div>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-5">
        <TrackStat label="Approved" value={variants.approved || 0} />
        <TrackStat label="Scheduled" value={variants.scheduled || 0} />
        <TrackStat label="Published" value={variants.published || 0} />
        <TrackStat label="Rejected" value={variants.rejected || 0} />
        <TrackStat label="Changes" value={variants.changes_requested || 0} />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <TrackStat label="Publish jobs" value={tracking.totalPublishJobs || 0} />
        <TrackStat label="Published posts" value={tracking.publishedPostCount || 0} />
        <TrackStat label="Metric snapshots" value={tracking.syncedMetrics?.snapshots || 0} />
        <TrackStat label="Provider URLs" value={(tracking.providerPostUrls || []).length} />
      </div>
      {tracking.analyticsUnavailableMessage && (
        <p className="mt-3 rounded-xl border border-gold/30 bg-gold/10 p-3 text-sm text-gold">{tracking.analyticsUnavailableMessage}</p>
      )}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Breakdown title="Platform breakdown" items={Object.entries(platforms).map(([key, value]) => [formatPlatform(key), value])} />
        <Breakdown title="Account breakdown" items={accounts.map(item => [`${item.accountName || item.accountHandle} (${formatPlatform(item.platform)})`, item.count])} />
      </div>
    </section>
  );
}

function TrackStat({ label, value }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-3">
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-2xl font-bold text-[var(--text)]">{value}</div>
    </div>
  );
}

function Breakdown({ title, items }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-3">
      <h3 className="text-sm font-semibold text-[var(--text)]">{title}</h3>
      <div className="mt-3 grid gap-2 text-xs text-[var(--text)]">
        {items.length === 0 ? (
          <span className="text-[var(--muted)]">No records yet.</span>
        ) : (
          items.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <span>{label}</span>
              <span className="font-semibold text-mint">{value}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
