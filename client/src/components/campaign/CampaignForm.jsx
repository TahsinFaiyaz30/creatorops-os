'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { formatPlatform, platformOptions } from '../../lib/platforms';

export default function CampaignForm({ onCreate }) {
  const [form, setForm] = useState({
    name: '',
    goal: '',
    targetAudience: '',
    platforms: platformOptions
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const togglePlatform = platform => {
    setForm(current => ({
      ...current,
      platforms: current.platforms.includes(platform)
        ? current.platforms.filter(item => item !== platform)
        : [...current.platforms, platform]
    }));
  };

  const submit = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onCreate(form);
      setForm({ name: '', goal: '', targetAudience: '', platforms: platformOptions });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-lg border border-line bg-panel p-4">
      <h2 className="text-base font-semibold text-white">Create Campaign</h2>
      <div className="mt-4 grid gap-3">
        <input
          className="focus-ring rounded-md border border-line bg-ink px-3 py-2 text-sm text-white"
          placeholder="Campaign name"
          value={form.name}
          onChange={event => setForm({ ...form, name: event.target.value })}
          required
        />
        <input
          className="focus-ring rounded-md border border-line bg-ink px-3 py-2 text-sm text-white"
          placeholder="Goal"
          value={form.goal}
          onChange={event => setForm({ ...form, goal: event.target.value })}
        />
        <input
          className="focus-ring rounded-md border border-line bg-ink px-3 py-2 text-sm text-white"
          placeholder="Target audience"
          value={form.targetAudience}
          onChange={event => setForm({ ...form, targetAudience: event.target.value })}
        />
        <div className="flex flex-wrap gap-2">
          {platformOptions.map(platform => (
            <label key={platform} className="inline-flex items-center gap-2 rounded-md border border-line bg-ink px-3 py-2 text-xs text-slate-200">
              <input
                type="checkbox"
                checked={form.platforms.includes(platform)}
                onChange={() => togglePlatform(platform)}
              />
              {formatPlatform(platform)}
            </label>
          ))}
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-rose">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="focus-ring mt-4 inline-flex items-center gap-2 rounded-md bg-cyan px-4 py-2 text-sm font-semibold text-ink hover:bg-sky-300"
      >
        <Plus size={16} />
        {busy ? 'Creating...' : 'Create campaign'}
      </button>
    </form>
  );
}
