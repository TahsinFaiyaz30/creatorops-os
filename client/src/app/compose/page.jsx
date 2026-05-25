'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, ImagePlus, Sparkles, Send } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import VisibilitySelector from '../../components/publish/VisibilitySelector';
import { api } from '../../lib/api';
import { getUser } from '../../lib/auth';
import { formatPlatform, getPlatformCaptionLimit } from '../../lib/platforms';

const aspectOptions = [
  { label: '9:16', value: '9:16', className: 'aspect-[9/16]' },
  { label: '1:1', value: '1:1', className: 'aspect-square' },
  { label: '4:5', value: '4:5', className: 'aspect-[4/5]' },
  { label: '16:9', value: '16:9', className: 'aspect-video' },
  { label: 'original', value: 'original', className: 'aspect-auto min-h-[360px]' }
];

const createPostGroupId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `post_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

export default function ComposePage() {
  const [user, setUser] = useState(null);
  const [connections, setConnections] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [baseCaption, setBaseCaption] = useState('');
  const [mediaAsset, setMediaAsset] = useState(null);
  const [captions, setCaptions] = useState([]);
  const [aspect, setAspect] = useState('9:16');
  const [fit, setFit] = useState('cover');
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [scheduledAt, setScheduledAt] = useState(() => new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16));
  const [visibility, setVisibility] = useState('public');
  const [message, setMessage] = useState('');
  const [publishResults, setPublishResults] = useState([]);
  const [busy, setBusy] = useState('');

  const load = async () => {
    const payload = await api.get('/api/platform-connections');
    setConnections((payload.data.connections || []).filter(connection => connection.status === 'connected'));
  };

  useEffect(() => {
    setUser(getUser());
    load().catch(err => setMessage(err.message));
  }, []);

  const selectedConnections = useMemo(
    () => connections.filter(connection => selectedIds.includes(connection._id)),
    [connections, selectedIds]
  );

  const mediaIds = mediaAsset ? [mediaAsset._id] : [];
  const aspectClass = aspectOptions.find(option => option.value === aspect)?.className || 'aspect-[9/16]';

  const toggleConnection = id => {
    setSelectedIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  };

  const upload = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy('upload');
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('media', file);
      const payload = await api.upload('/api/media/upload', formData);
      setMediaAsset(payload.data.mediaAsset);
      setMessage('Original media uploaded. Preview crop metadata does not alter the source file.');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
    }
  };

  const customizeCaptions = async () => {
    setBusy('ai');
    setMessage('');
    try {
      const payload = await api.post('/api/ai/customize-captions', {
        baseCaption,
        connectionIds: selectedIds,
        mediaAssetIds: mediaIds
      });
      setCaptions(payload.data.results || []);
      setMessage('Captions customized per selected platform/account.');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
    }
  };

  const updateCaption = (connectionId, value) => {
    const connection = connections.find(item => item._id === connectionId);
    setCaptions(current => {
      if (current.some(item => item.connectionId === connectionId)) {
        return current.map(item => item.connectionId === connectionId ? { ...item, caption: value } : item);
      }
      return [
        ...current,
        {
          connectionId,
          platform: connection?.platform || '',
          accountHandle: connection?.accountHandle || '',
          caption: value,
          hashtags: [],
          hook: '',
          cta: '',
          brandScore: 0,
          readinessScore: 0,
          warnings: [],
          suggestions: [],
          aiProvider: 'manual'
        }
      ];
    });
  };

  const describePublishJob = publishJob => {
    if (!publishJob) return 'No publish job returned.';
    if (publishJob.status === 'published') {
      return publishJob.providerPostUrl ? `Published: ${publishJob.providerPostUrl}` : 'Published through the connected platform API.';
    }
    if (publishJob.status === 'blocked' || publishJob.status === 'failed') {
      return publishJob.errorMessage || `Job ${publishJob.status}.`;
    }
    return `Job ${publishJob.status}.`;
  };

  const publish = async ({ mode }) => {
    if (user?.role !== 'creator_admin') {
      setMessage('Backend requires Creator/Admin for publishing.');
      return;
    }
    setBusy(mode);
    setMessage('');
    setPublishResults([]);
    try {
      const endpoint = mode === 'now' ? '/api/publish/now' : '/api/publish/schedule';
      const results = [];
      const postGroupId = createPostGroupId();
      for (const connection of selectedConnections) {
        const customized = captions.find(item => item.connectionId === connection._id);
        try {
          const payload = await api.post(endpoint, {
            postGroupId,
            platformConnectionId: connection._id,
            mediaAssetIds: mediaIds,
            caption: customized?.caption || baseCaption,
            visibility,
            scheduledAt: new Date(scheduledAt).toISOString()
          });
          const publishJob = payload.data.publishJob;
          results.push({
            ok: !['blocked', 'failed'].includes(publishJob?.status),
            platform: connection.platform,
            accountHandle: connection.accountHandle,
            status: publishJob?.status || 'queued',
            detail: describePublishJob(publishJob)
          });
        } catch (err) {
          results.push({
            ok: false,
            platform: connection.platform,
            accountHandle: connection.accountHandle,
            status: 'blocked',
            detail: err.message
          });
        }
      }
      setPublishResults(results);
      const successCount = results.filter(result => result.ok).length;
      const action = mode === 'now' ? 'publish' : 'schedule';
      setMessage(`${successCount}/${results.length} ${action} request${results.length === 1 ? '' : 's'} accepted. See per-account results below.`);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="rounded-lg border border-line bg-panel p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-cyan">Real compose</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Compose & Publish</h1>
          <p className="mt-2 max-w-4xl text-sm text-slate-400">
            Upload original media, preview crop/aspect metadata, customize captions with AI, and queue real publish jobs against connected accounts. Missing credentials, scopes, or platform review block the action instead of faking success.
          </p>
        </header>

        {message && <div className="rounded-md border border-line bg-panel p-3 text-sm text-slate-300">{message}</div>}

        {publishResults.length > 0 && (
          <div className="rounded-lg border border-line bg-panel p-4">
            <h2 className="text-sm font-semibold text-white">Publish Results</h2>
            <div className="mt-3 grid gap-2">
              {publishResults.map(result => (
                <div key={`${result.platform}-${result.accountHandle}`} className={`rounded-md border p-3 text-sm ${result.ok ? 'border-mint/30 bg-mint/10 text-mint' : 'border-rose/30 bg-rose/10 text-rose'}`}>
                  <div className="font-semibold">
                    {formatPlatform(result.platform)} {result.accountHandle ? `- ${result.accountHandle}` : ''} · {result.status}
                  </div>
                  <p className="mt-1 text-xs text-slate-300">{result.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {connections.length === 0 ? (
          <div className="rounded-lg border border-gold/30 bg-gold/10 p-5 text-sm text-gold">
            Connect real accounts first. <Link href="/accounts" className="underline">Open Accounts</Link>
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <div className="space-y-4 rounded-lg border border-line bg-panel p-4">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-line bg-ink px-4 py-8 text-sm text-slate-300 hover:border-cyan">
              <ImagePlus size={18} />
              {busy === 'upload' ? 'Uploading...' : 'Upload image or video'}
              <input type="file" accept="image/*,video/*" onChange={upload} className="hidden" />
            </label>

            <textarea
              value={baseCaption}
              onChange={event => setBaseCaption(event.target.value)}
              placeholder="Base caption or text-only status"
              rows={5}
              className="focus-ring w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-white"
            />

            <div>
              <h2 className="text-sm font-semibold text-white">Select connected accounts</h2>
              <div className="mt-3 grid gap-2">
                {connections.map(connection => (
                  <label key={connection._id} className="flex items-center gap-3 rounded-md border border-line bg-ink p-3 text-sm text-slate-200">
                    <input type="checkbox" checked={selectedIds.includes(connection._id)} onChange={() => toggleConnection(connection._id)} />
                    <span className="flex-1">
                      {formatPlatform(connection.platform)} · {connection.accountName}
                      <span className="ml-2 text-xs text-slate-500">{connection.accountHandle}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={busy === 'ai' || !baseCaption || selectedIds.length === 0}
              onClick={customizeCaptions}
              className="focus-ring inline-flex items-center gap-2 rounded-md bg-cyan px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50"
            >
              <Sparkles size={15} />
              {busy === 'ai' ? 'Customizing...' : 'Customize Captions with AI'}
            </button>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-line bg-panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-white">Media Preview</h2>
                <div className="flex flex-wrap gap-2">
                  {aspectOptions.map(option => (
                    <button key={option.value} type="button" onClick={() => setAspect(option.value)} className={`rounded-md border px-2.5 py-1 text-xs ${aspect === option.value ? 'border-cyan text-cyan' : 'border-line text-slate-400'}`}>
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={`mx-auto mt-4 max-w-sm overflow-hidden rounded-lg border border-line bg-ink ${aspectClass}`}>
                {mediaAsset ? (
                  mediaAsset.mediaType === 'video' ? (
                    <video src={mediaAsset.publicUrl} controls className="h-full w-full" style={{ objectFit: fit, objectPosition: `${position.x}% ${position.y}%` }} />
                  ) : (
                    <img src={mediaAsset.publicUrl} alt={mediaAsset.originalName} className="h-full w-full" style={{ objectFit: fit, objectPosition: `${position.x}% ${position.y}%` }} />
                  )
                ) : (
                  <div className="flex h-full min-h-[360px] items-center justify-center text-sm text-slate-500">9:16 preview area</div>
                )}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <select value={fit} onChange={event => setFit(event.target.value)} className="focus-ring rounded-md border border-line bg-ink px-3 py-2 text-sm text-white">
                  <option value="cover">cover</option>
                  <option value="contain">contain</option>
                </select>
                <label className="text-xs text-slate-400">
                  Crop X
                  <input type="range" min="0" max="100" value={position.x} onChange={event => setPosition({ ...position, x: Number(event.target.value) })} className="mt-2 w-full" />
                </label>
                <label className="text-xs text-slate-400">
                  Crop Y
                  <input type="range" min="0" max="100" value={position.y} onChange={event => setPosition({ ...position, y: Number(event.target.value) })} className="mt-2 w-full" />
                </label>
              </div>
            </div>

            <div className="rounded-lg border border-line bg-panel p-4">
              <h2 className="text-base font-semibold text-white">Platform Captions</h2>
              <div className="mt-4 grid gap-3">
                {selectedConnections.map(connection => {
                  const customized = captions.find(item => item.connectionId === connection._id);
                  const captionValue = customized?.caption ?? baseCaption;
                  const maxCaptionLength = customized?.maxCaptionLength || getPlatformCaptionLimit(connection.platform);
                  const captionLength = captionValue.length;
                  const captionOverLimit = captionLength > maxCaptionLength;
                  return (
                    <article key={connection._id} className="rounded-md border border-line bg-ink p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="rounded-full bg-cyan/10 px-2 py-1 text-xs text-cyan">{formatPlatform(connection.platform)}</span>
                        <span className="text-xs text-slate-500">{connection.accountHandle}</span>
                      </div>
                      <textarea
                        value={captionValue}
                        onChange={event => updateCaption(connection._id, event.target.value)}
                        rows={4}
                        className={`focus-ring mt-3 w-full rounded-md border bg-panel px-3 py-2 text-sm text-white ${captionOverLimit ? 'border-rose' : 'border-line'}`}
                      />
                      <div className={`mt-1 text-xs ${captionOverLimit ? 'text-rose' : 'text-slate-500'}`}>
                        {captionLength}/{maxCaptionLength} characters
                      </div>
                      {customized && (
                        <div className="mt-2 grid gap-1 text-xs text-slate-400">
                          <span>Provider: {customized.aiProvider}</span>
                          <span>Hook: {customized.hook}</span>
                          <span>CTA: {customized.cta}</span>
                          <span>Scores: brand {customized.brandScore}, readiness {customized.readinessScore}</span>
                          {(customized.hashtags || []).length > 0 && <span>Hashtags: {customized.hashtags.join(' ')}</span>}
                          {(customized.warnings || []).length > 0 && (
                            <div className="mt-2 rounded-md border border-gold/30 bg-gold/10 p-2 text-gold">
                              <div className="font-semibold">Warnings</div>
                              <ul className="mt-1 list-disc space-y-1 pl-4">
                                {customized.warnings.map(warning => <li key={warning}>{warning}</li>)}
                              </ul>
                            </div>
                          )}
                          {(customized.suggestions || []).length > 0 && (
                            <div className="mt-2 rounded-md border border-cyan/20 bg-cyan/10 p-2 text-cyan">
                              <div className="font-semibold">Suggestions</div>
                              <ul className="mt-1 list-disc space-y-1 pl-4">
                                {customized.suggestions.map(suggestion => <li key={suggestion}>{suggestion}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-line bg-panel p-4">
              <div className="mb-4">
                <VisibilitySelector value={visibility} onChange={setVisibility} mediaType={mediaAsset?.mediaType || ''} />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input type="datetime-local" value={scheduledAt} onChange={event => setScheduledAt(event.target.value)} className="focus-ring rounded-md border border-line bg-ink px-3 py-2 text-sm text-white" />
                <button type="button" disabled={busy === 'now' || selectedIds.length === 0 || (!baseCaption && !mediaAsset)} onClick={() => publish({ mode: 'now' })} className="focus-ring inline-flex items-center gap-2 rounded-md bg-mint px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50">
                  <Send size={15} />
                  Publish Now
                </button>
                <button type="button" disabled={busy === 'schedule' || selectedIds.length === 0 || (!baseCaption && !mediaAsset)} onClick={() => publish({ mode: 'schedule' })} className="focus-ring inline-flex items-center gap-2 rounded-md bg-gold px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50">
                  <CalendarClock size={15} />
                  Schedule Later
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">These buttons call real connector validation. If API access is missing, the job is blocked with the platform reason.</p>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
