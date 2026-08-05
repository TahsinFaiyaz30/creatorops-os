'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatPlatform } from '../../lib/platforms';

export default function CircularApplicationForm({ onSubmit, statistics, busy }) {
  const [message, setMessage] = useState('');
  const [summary, setSummary] = useState('');
  const [posts, setPosts] = useState([]);
  const [mediaAssets, setMediaAssets] = useState([]);
  const [selectedPostIds, setSelectedPostIds] = useState([]);
  const [selectedMediaAssetIds, setSelectedMediaAssetIds] = useState([]);

  useEffect(() => {
    Promise.allSettled([
      api.get('/api/social/posts'),
      api.get('/api/media')
    ]).then(results => {
      setPosts(results[0].value?.data?.posts || []);
      setMediaAssets(results[1].value?.data?.mediaAssets || []);
    });
  }, []);

  const toggle = (id, values, setter) => {
    setter(values.includes(id) ? values.filter(value => value !== id) : [...values, id].slice(0, 2));
  };

  return (
    <form
      onSubmit={event => {
        event.preventDefault();
        onSubmit({ message, creatorProfileSummary: summary, selectedPostIds, selectedMediaAssetIds });
      }}
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
    >
      <h2 className="text-lg font-semibold text-[var(--text)]">Apply as creator</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">Your current real synced statistics snapshot will be attached. Unavailable metrics stay marked as unavailable.</p>
      <textarea value={summary} onChange={event => setSummary(event.target.value)} placeholder="Creator profile summary" rows={3} className="focus-ring mt-3 w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-sm text-[var(--text)]" />
      <textarea value={message} onChange={event => setMessage(event.target.value)} placeholder="Application message" rows={4} className="focus-ring mt-3 w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-sm text-[var(--text)]" />
      <div className="mt-3 grid gap-2 text-xs text-[var(--muted)] md:grid-cols-3">
        <span>Views: {statistics?.combinedStats?.views || 0}</span>
        <span>Comments: {statistics?.combinedStats?.comments || 0}</span>
        <span>Source: {statistics?.source || 'unavailable'}</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <AttachmentPicker
          title="Attach up to two real posts"
          empty="No real published posts available for this creator."
          items={posts}
          selectedIds={selectedPostIds}
          onToggle={id => toggle(id, selectedPostIds, setSelectedPostIds)}
          renderItem={post => `${formatPlatform(post.platform)} · ${post.caption || post.providerPostUrl || post.providerPostId || 'Published post'}`}
        />
        <AttachmentPicker
          title="Attach up to two media assets"
          empty="No uploaded media assets available."
          items={mediaAssets}
          selectedIds={selectedMediaAssetIds}
          onToggle={id => toggle(id, selectedMediaAssetIds, setSelectedMediaAssetIds)}
          renderItem={asset => `${asset.mediaType || 'media'} · ${asset.originalName || asset.publicUrl}`}
        />
      </div>
      <button type="submit" disabled={busy} className="focus-ring mt-4 rounded-xl bg-mint px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] disabled:opacity-50">
        {busy ? 'Submitting...' : 'Submit application'}
      </button>
    </form>
  );
}

function AttachmentPicker({ title, empty, items, selectedIds, onToggle, renderItem }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{title}</div>
      <div className="mt-2 max-h-48 space-y-2 overflow-auto">
        {items.slice(0, 8).map(item => (
          <label key={item._id} className="flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 text-xs text-[var(--text)]">
            <input type="checkbox" checked={selectedIds.includes(item._id)} onChange={() => onToggle(item._id)} />
            <span>{renderItem(item)}</span>
          </label>
        ))}
        {items.length === 0 && <p className="text-xs text-[var(--muted)]">{empty}</p>}
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">Selected: {selectedIds.length}/2</p>
    </div>
  );
}
