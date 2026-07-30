'use client';

import { useState } from 'react';
import { Bot, Send } from 'lucide-react';
import { api } from '../../lib/api';
import { platformOptions, formatPlatform } from '../../lib/platforms';

const scriptTypes = ['reel script', 'TikTok script', 'YouTube Shorts script', 'long-form YouTube outline', 'product promo script', 'UGC ad script', 'hook variations', 'voiceover script', 'scene-by-scene script'];

export default function ScriptChatPanel() {
  const [conversation, setConversation] = useState(null);
  const [message, setMessage] = useState('');
  const [platform, setPlatform] = useState('youtube_shorts');
  const [scriptType, setScriptType] = useState('reel script');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [campaignId, setCampaignId] = useState('');

  const send = async () => {
    if (!message.trim()) return;
    setBusy(true);
    setNotice('');
    try {
      const payload = await api.post('/api/ai/script', {
        conversationId: conversation?._id,
        message,
        platform,
        scriptType,
        campaignId: campaignId || undefined
      });
      setConversation(payload.data.conversation);
      setMessage('');
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  };

  const convert = async () => {
    if (!conversation?._id) return;
    setBusy(true);
    try {
      await api.post(`/api/scripts/${conversation._id}/convert-to-content`, { campaignId });
      setNotice('Script converted into a content item.');
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  };

  const finalScript = conversation?.finalScript || {};

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <select value={platform} onChange={event => setPlatform(event.target.value)} className="focus-ring rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-sm text-[var(--text)]">
            {platformOptions.map(item => <option key={item} value={item}>{formatPlatform(item)}</option>)}
          </select>
          <select value={scriptType} onChange={event => setScriptType(event.target.value)} className="focus-ring rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-sm text-[var(--text)]">
            {scriptTypes.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <input value={campaignId} onChange={event => setCampaignId(event.target.value)} placeholder="Optional campaignId for conversion" className="focus-ring rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-sm text-[var(--text)]" />
        </div>

        <div className="mt-4 min-h-[360px] space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-3">
          {(conversation?.messages || []).map((item, index) => (
            <div key={`${item.role}-${index}`} className={`rounded-xl p-3 text-sm ${item.role === 'assistant' ? 'bg-mint/10 text-slate-100' : 'bg-[var(--surface)] text-[var(--text)]'}`}>
              <div className="mb-1 text-xs uppercase text-[var(--muted)]">{item.role}</div>
              <p>{item.content}</p>
            </div>
          ))}
          {!conversation && <p className="text-sm text-[var(--muted)]">Ask for a hook, UGC ad, scene-by-scene script, revision, shorter version, or platform optimization.</p>}
        </div>

        <div className="mt-3 flex gap-2">
          <textarea value={message} onChange={event => setMessage(event.target.value)} rows={3} placeholder="Ask Script AI to create or revise a script..." className="focus-ring flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-sm text-[var(--text)]" />
          <button type="button" disabled={busy} onClick={send} className="focus-ring inline-flex items-center gap-2 rounded-xl bg-mint px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] disabled:opacity-50">
            <Send size={16} /> Send
          </button>
        </div>
        {notice && <p className="mt-2 text-sm text-gold">{notice}</p>}
      </section>

      <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex items-center gap-2 text-lg font-semibold text-[var(--text)]"><Bot size={18} /> Final script</div>
        {finalScript.title ? (
          <div className="mt-4 space-y-3 text-sm text-[var(--text)]">
            <h2 className="text-xl font-bold text-[var(--text)]">{finalScript.title}</h2>
            <p><span className="text-mint">Hook:</span> {finalScript.hook}</p>
            <p><span className="text-mint">CTA:</span> {finalScript.cta}</p>
            <p><span className="text-mint">Duration:</span> {finalScript.estimatedDuration}</p>
            <div>
              <div className="text-mint">Scenes</div>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {(finalScript.sceneBreakdown || []).map((scene, index) => {
                  if (typeof scene === 'string') return <li key={index}>{scene}</li>;
                  const prefix = scene.label ? `${scene.label}: ` : scene.sceneNumber ? `Scene ${scene.sceneNumber}: ` : '';
                  const body = scene.description || scene.visualDescription || scene.audioDescription || scene.dialogue || scene.textOnScreen || JSON.stringify(scene);
                  return <li key={index}>{prefix}{body}</li>;
                })}
              </ul>
            </div>
            <pre className="whitespace-pre-wrap rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-3 text-xs text-[var(--text)]">{finalScript.voiceover || finalScript.dialogue}</pre>
            <button type="button" disabled={busy || !campaignId} onClick={convert} className="focus-ring rounded-xl bg-mint px-3 py-2 text-sm font-semibold text-[var(--accent-fg)] disabled:opacity-50">Convert to ContentItem</button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--muted)]">No final script yet.</p>
        )}
      </aside>
    </div>
  );
}
