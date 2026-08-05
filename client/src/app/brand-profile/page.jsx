'use client';

/**
 * Brand Profile — GET / POST / PATCH /api/brand-profile
 *
 * BrandProfile drives AI tone, banned-word filtering and preferred platforms for
 * every generated variant. The server exposed full CRUD but the client had no
 * page for it, so brand reps could never set the voice their content is
 * generated against.
 */

import { useEffect, useState } from 'react';
import { Building2, Save, Ban, Megaphone, Globe } from 'lucide-react';

import AppShell from '../../components/layout/AppShell';
import {
  Page, PageHeader, Section, Surface, Badge, Button, Input, Textarea, Field,
  Skeleton, Notice
} from '../../components/ds';
import { api } from '../../lib/api';

const PLATFORMS = [
  'facebook', 'instagram', 'linkedin', 'pinterest', 'threads',
  'tiktok', 'x', 'youtube', 'youtube_shorts', 'wordpress', 'shopify'
];

const EMPTY = {
  brandName: '', description: '', industry: '', website: '', logoUrl: '',
  tone: '', targetAudience: '', ctaStyle: '', bannedWords: [], preferredPlatforms: []
};

export default function BrandProfilePage() {
  const [form, setForm] = useState(null);
  const [exists, setExists] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [bannedInput, setBannedInput] = useState('');

  useEffect(() => {
    api
      .get('/api/brand-profile')
      .then(p => {
        const bp = p?.data?.brandProfile;
        setExists(Boolean(bp));
        setForm({ ...EMPTY, ...(bp || {}) });
        setBannedInput((bp?.bannedWords || []).join(', '));
      })
      .catch(e => { setError(e.message); setForm({ ...EMPTY }); });
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const togglePlatform = p =>
    setForm(f => ({
      ...f,
      preferredPlatforms: f.preferredPlatforms.includes(p)
        ? f.preferredPlatforms.filter(x => x !== p)
        : [...f.preferredPlatforms, p]
    }));

  const save = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    const payload = {
      ...form,
      bannedWords: bannedInput.split(',').map(s => s.trim()).filter(Boolean)
    };
    try {
      // POST creates the first profile; PATCH updates an existing one.
      await (exists ? api.patch('/api/brand-profile', payload) : api.post('/api/brand-profile', payload));
      setExists(true);
      setNotice('Brand profile saved. AI generation will use this voice.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!form) {
    return (
      <AppShell>
        <Page>
          <PageHeader eyebrow="Marketplace" title="Brand Profile" />
          <Skeleton className="h-96" />
        </Page>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Page>
        <PageHeader
          eyebrow="Marketplace"
          title="Brand Profile"
          description="The voice every AI-generated variant is written against — tone, audience, CTA style, banned words and the platforms you care about."
          actions={
            <Button variant="primary" onClick={save} disabled={busy}>
              <Save className="h-3.5 w-3.5" />
              {busy ? 'Saving…' : exists ? 'Save changes' : 'Create profile'}
            </Button>
          }
        />

        {error ? <Notice tone="danger">{error}</Notice> : null}
        {notice ? <Notice tone="success">{notice}</Notice> : null}
        {!exists ? (
          <Notice tone="warning">
            No brand profile exists yet. Filling this in gives the AI a consistent voice instead of a generic default.
          </Notice>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Identity">
            <Surface pad="md" className="space-y-3">
              <Field label="Brand name" htmlFor="bp-name">
                <Input id="bp-name" value={form.brandName} onChange={e => set('brandName', e.target.value)} placeholder="CreatorOps.OS" />
              </Field>
              <Field label="Industry" htmlFor="bp-industry">
                <Input id="bp-industry" value={form.industry} onChange={e => set('industry', e.target.value)} placeholder="Film & video production" />
              </Field>
              <Field label="Website" htmlFor="bp-web">
                <Input id="bp-web" type="url" value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://…" />
              </Field>
              <Field label="Logo URL" htmlFor="bp-logo" hint="Shown on circulars you publish.">
                <Input id="bp-logo" type="url" value={form.logoUrl} onChange={e => set('logoUrl', e.target.value)} placeholder="https://…" />
              </Field>
              <Field label="Description" htmlFor="bp-desc">
                <Textarea id="bp-desc" value={form.description} onChange={e => set('description', e.target.value)} placeholder="What the brand does, in a sentence or two." />
              </Field>
            </Surface>
          </Section>

          <Section title="Voice">
            <Surface pad="md" className="space-y-3">
              <Field label="Tone" htmlFor="bp-tone" hint="e.g. cinematic, warm, plain-spoken">
                <Input id="bp-tone" value={form.tone} onChange={e => set('tone', e.target.value)} placeholder="Cinematic and understated" />
              </Field>
              <Field label="Target audience" htmlFor="bp-aud">
                <Textarea id="bp-aud" value={form.targetAudience} onChange={e => set('targetAudience', e.target.value)} placeholder="Who this content is for." />
              </Field>
              <Field label="CTA style" htmlFor="bp-cta">
                <Input id="bp-cta" value={form.ctaStyle} onChange={e => set('ctaStyle', e.target.value)} placeholder="Invite a reply, never hard-sell" />
              </Field>
              <Field
                label="Banned words"
                htmlFor="bp-banned"
                hint="Comma-separated. The generator avoids these."
              >
                <Textarea id="bp-banned" value={bannedInput} onChange={e => setBannedInput(e.target.value)} placeholder="cheap, guaranteed, hustle" />
              </Field>
              {bannedInput.trim() ? (
                <div className="flex flex-wrap gap-1.5">
                  {bannedInput.split(',').map(s => s.trim()).filter(Boolean).map(w => (
                    <Badge key={w} tone="danger"><Ban className="h-3 w-3" />{w}</Badge>
                  ))}
                </div>
              ) : null}
            </Surface>
          </Section>
        </div>

        <Section
          title="Preferred platforms"
          description="Prioritised when generating variants."
        >
          <Surface pad="md">
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(p => {
                const on = form.preferredPlatforms.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    aria-pressed={on}
                    className={`focus-ring rounded-lg border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                      on
                        ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]'
                        : 'border-[var(--border)] bg-[var(--surface2)] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)]'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
              <Globe className="h-3 w-3" />
              {form.preferredPlatforms.length} selected
            </p>
          </Surface>
        </Section>
      </Page>
    </AppShell>
  );
}
