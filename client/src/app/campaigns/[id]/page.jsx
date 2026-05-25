'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AppShell from '../../../components/layout/AppShell';
import ContentIdeaForm from '../../../components/campaign/ContentIdeaForm';
import ContentBoard from '../../../components/campaign/ContentBoard';
import LiveEventFeed from '../../../components/events/LiveEventFeed';
import { api } from '../../../lib/api';
import { getUser } from '../../../lib/auth';

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
  const [message, setMessage] = useState('');

  const load = async () => {
    const [campaignPayload, brandPayload, contentPayload] = await Promise.all([
      api.get(`/api/campaigns/${campaignId}`),
      api.get('/api/brand-profile'),
      api.get(`/api/content/campaign/${campaignId}`)
    ]);

    const brand = brandPayload.data.brandProfile;
    setCampaign(campaignPayload.data.campaign);
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
      preferredPlatforms: campaign?.platforms || ['instagram', 'linkedin', 'tiktok', 'youtube_shorts']
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
        <header className="rounded-lg border border-line bg-panel p-5">
          <p className="text-sm uppercase tracking-[0.18em] text-cyan">Campaign</p>
          <h1 className="mt-2 text-3xl font-bold text-white">{campaign?.name || 'Loading campaign'}</h1>
          <p className="mt-2 text-sm text-slate-400">{campaign?.goal}</p>
        </header>

        <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
          <div className="space-y-4">
            <form onSubmit={saveBrand} className="rounded-lg border border-line bg-panel p-4">
              <h2 className="text-base font-semibold text-white">Brand profile</h2>
              <div className="mt-4 grid gap-3">
                {['brandName', 'tone', 'targetAudience', 'bannedWords', 'ctaStyle'].map(field => (
                  <input
                    key={field}
                    className="focus-ring rounded-md border border-line bg-ink px-3 py-2 text-sm text-white"
                    placeholder={field}
                    value={brandForm[field]}
                    onChange={event => setBrandForm({ ...brandForm, [field]: event.target.value })}
                  />
                ))}
              </div>
              <button className="focus-ring mt-4 rounded-md bg-cyan px-4 py-2 text-sm font-semibold text-ink">
                {brandProfile ? 'Update brand' : 'Create brand'}
              </button>
            </form>
            <ContentIdeaForm onCreate={createContent} />
          </div>

          <div className="space-y-4">
            {message && <div className="rounded-md border border-line bg-panel p-3 text-sm text-slate-300">{message}</div>}
            <ContentBoard items={contentItems} variantsByContent={variantsByContent} user={user} onRefresh={load} />
          </div>
        </section>

        <LiveEventFeed compact />
      </div>
    </AppShell>
  );
}
