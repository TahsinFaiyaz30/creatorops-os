'use client';

import { useState } from 'react';
import { platformOptions, formatPlatform } from '../../lib/platforms';

const defaultForm = {
  title: '',
  productName: '',
  productDescription: '',
  productCategory: '',
  targetAudience: '',
  campaignObjective: '',
  platforms: ['instagram', 'tiktok'],
  deliverables: { reels: 1, posts: 1, stories: 0, videos: 0, notes: '' },
  contentFormats: ['reel'],
  deadline: '',
  budgetAmount: 0,
  currency: 'USD',
  eligibilityRequirements: '',
  brandDemands: '',
  judgingCriteria: ''
};

export default function BrandCircularForm({ initialValue = {}, onSubmit, busy = false }) {
  const [form, setForm] = useState({ ...defaultForm, ...initialValue, deliverables: { ...defaultForm.deliverables, ...(initialValue.deliverables || {}) } });

  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const updateDeliverable = (key, value) => setForm(current => ({ ...current, deliverables: { ...current.deliverables, [key]: value } }));
  const togglePlatform = platform => {
    update('platforms', form.platforms.includes(platform) ? form.platforms.filter(item => item !== platform) : [...form.platforms, platform]);
  };

  return (
    <form
      onSubmit={event => {
        event.preventDefault();
        onSubmit(form);
      }}
      className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Input label="Circular title" value={form.title} onChange={value => update('title', value)} required />
        <Input label="Product name" value={form.productName} onChange={value => update('productName', value)} required />
        <Input label="Product category" value={form.productCategory} onChange={value => update('productCategory', value)} />
        <Input label="Target audience" value={form.targetAudience} onChange={value => update('targetAudience', value)} />
        <Input label="Deadline" type="datetime-local" value={form.deadline} onChange={value => update('deadline', value)} required />
        <div className="grid grid-cols-[1fr_120px] gap-2">
          <Input label="Budget" type="number" value={form.budgetAmount} onChange={value => update('budgetAmount', Number(value))} />
          <Input label="Currency" value={form.currency} onChange={value => update('currency', value)} />
        </div>
      </div>

      <Textarea label="Product description" value={form.productDescription} onChange={value => update('productDescription', value)} />
      <Textarea label="Campaign objective" value={form.campaignObjective} onChange={value => update('campaignObjective', value)} />

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Platforms needed</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {platformOptions.map(platform => (
            <button
              key={platform}
              type="button"
              onClick={() => togglePlatform(platform)}
              className={`rounded-full border px-3 py-1 text-xs ${form.platforms.includes(platform) ? 'border-mint bg-mint/10 text-mint' : 'border-[var(--border)] text-[var(--muted)]'}`}
            >
              {formatPlatform(platform)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {['reels', 'posts', 'stories', 'videos'].map(key => (
          <Input key={key} label={key} type="number" value={form.deliverables[key]} onChange={value => updateDeliverable(key, Number(value))} />
        ))}
      </div>
      <Input label="Content formats (comma separated)" value={form.contentFormats.join(', ')} onChange={value => update('contentFormats', value.split(',').map(item => item.trim()).filter(Boolean))} />
      <Textarea label="Eligibility requirements" value={form.eligibilityRequirements} onChange={value => update('eligibilityRequirements', value)} />
      <Textarea label="Brand demands" value={form.brandDemands} onChange={value => update('brandDemands', value)} />
      <Textarea label="Judging criteria" value={form.judgingCriteria} onChange={value => update('judgingCriteria', value)} />

      <button type="submit" disabled={busy} className="focus-ring rounded-xl bg-mint px-4 py-2 text-sm font-semibold text-[#05130d] disabled:opacity-50">
        {busy ? 'Saving...' : 'Save circular'}
      </button>
    </form>
  );
}

function Input({ label, value, onChange, type = 'text', required = false }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</span>
      <input required={required} type={type} value={value || ''} onChange={event => onChange(event.target.value)} className="focus-ring mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-sm text-[var(--text)]" />
    </label>
  );
}

function Textarea({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</span>
      <textarea value={value || ''} onChange={event => onChange(event.target.value)} rows={3} className="focus-ring mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-sm text-[var(--text)]" />
    </label>
  );
}
