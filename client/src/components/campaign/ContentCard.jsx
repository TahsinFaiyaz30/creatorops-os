'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { api } from '../../lib/api';
import AIResultPanel from '../ai/AIResultPanel';
import PlatformVariantCard from './PlatformVariantCard';
import VersionHistory from './VersionHistory';

export default function ContentCard({ item, user, initialVariants = [], onRefresh }) {
  const [variants, setVariants] = useState(initialVariants);
  const [provider, setProvider] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setVariants(initialVariants);
  }, [initialVariants]);

  const repurpose = async () => {
    setBusy(true);
    setError('');
    try {
      const payload = await api.post('/api/ai/repurpose', { contentItemId: item._id });
      setProvider(payload.data.provider);
      setVariants(payload.data.variants || []);
      onRefresh?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="rounded-2xl border border-[var(--border)] bg-[#101720] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text)]">{item.title}</h3>
          <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">{item.rawIdea}</p>
        </div>
        <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-[var(--text)]">{item.status}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={repurpose}
          disabled={busy}
          className="focus-ring inline-flex items-center gap-2 rounded-xl bg-mint px-4 py-2 text-sm font-semibold text-[#05130d]"
        >
          <Sparkles size={16} />
          {busy ? 'Generating...' : 'AI Repurpose'}
        </button>
        <VersionHistory contentItemId={item._id} />
      </div>

      {error && <p className="mt-3 text-sm text-rose">{error}</p>}
      <div className="mt-4">
        <AIResultPanel provider={provider} count={variants.length} />
      </div>

      {variants.length > 0 && (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {variants.map(variant => (
            <PlatformVariantCard key={variant._id} variant={variant} user={user} onRefresh={onRefresh} />
          ))}
        </div>
      )}
    </article>
  );
}
