'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ScriptChatPanel — rebuilt as a three-column writing room.
 *
 * Fixes two real problems, not just styling:
 *
 *  1. Campaign was a RAW ID TEXT BOX ("Optional campaignId for conversion").
 *     Nobody can type a Mongo ObjectId from memory, so convert-to-content was
 *     effectively unreachable. It's now a picker fed by GET /api/campaigns.
 *
 *  2. GET /api/scripts was never called by any client code — every past
 *     conversation was written to the database and then unreachable. It now
 *     backs a history rail, and GET /api/scripts/:id reopens a thread.
 *
 * Layout: history · chat · final script. The side rails are what fill the space
 * that used to sit empty beside a narrow chat column.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bot, Send, Sparkles, History, FileText, Clock, Wand2,
  MessageSquarePlus, ArrowRightLeft, User as UserIcon, Film
} from 'lucide-react';

import { Surface, Badge, Button, Skeleton, EmptyState } from '../ds';
import { api } from '../../lib/api';
import { platformOptions, formatPlatform } from '../../lib/platforms';
import { useToastState } from '../ui/toast';

const EASE = [0.16, 1, 0.3, 1];

const SCRIPT_TYPES = [
  'reel script', 'TikTok script', 'YouTube Shorts script', 'long-form YouTube outline',
  'product promo script', 'UGC ad script', 'hook variations', 'voiceover script',
  'scene-by-scene script'
];

/* One-tap starters so an empty chat isn't a blank prompt box. */
const STARTERS = [
  { icon: Wand2, label: 'Hook variations', text: 'Give me 5 scroll-stopping hook variations for a cinematic behind-the-scenes short.' },
  { icon: Film, label: 'Scene breakdown', text: 'Write a scene-by-scene script for a 45-second brand film about a small production house.' },
  { icon: Sparkles, label: 'Punch it up', text: 'Rewrite the last script with tighter pacing and a stronger closing CTA.' },
  { icon: ArrowRightLeft, label: 'Re-platform', text: 'Adapt the current script for YouTube Shorts, keeping it under 40 seconds.' }
];

const relTime = d => {
  if (!d) return '';
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

/* ── Typing indicator ─────────────────────────────────────────────────────── */

function Thinking() {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)] px-3 py-2.5">
      <Bot className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
      <span className="flex gap-1">
        {[0, 1, 2].map(i => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]"
            animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          />
        ))}
      </span>
      <span className="text-[11px] text-[var(--accent)]">Script AI is writing…</span>
    </div>
  );
}

/* ── Chat bubble ──────────────────────────────────────────────────────────── */

function Bubble({ role, content, index }) {
  const isAssistant = role === 'assistant';
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE, delay: Math.min(index * 0.03, 0.3) }}
      className={`flex gap-2.5 ${isAssistant ? '' : 'flex-row-reverse'}`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
          isAssistant
            ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]'
            : 'border-[var(--border)] bg-[var(--surface2)] text-[var(--muted)]'
        }`}
      >
        {isAssistant ? <Bot className="h-3.5 w-3.5" /> : <UserIcon className="h-3.5 w-3.5" />}
      </span>
      <div
        className={`min-w-0 max-w-[85%] rounded-xl border px-3 py-2.5 ${
          isAssistant
            ? 'border-[var(--border)] bg-[var(--surface2)]'
            : 'border-[var(--accent-line)] bg-[var(--accent-soft)]'
        }`}
      >
        <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[var(--text-2)]">
          {content}
        </p>
      </div>
    </motion.div>
  );
}

/* ── Panel ────────────────────────────────────────────────────────────────── */

export default function ScriptChatPanel() {
  const [conversation, setConversation] = useState(null);
  const [history, setHistory] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [message, setMessage] = useState('');
  const [platform, setPlatform] = useState('youtube_shorts');
  const [scriptType, setScriptType] = useState('reel script');
  const [campaignId, setCampaignId] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useToastState('success');
  const [error, setError] = useToastState('danger');
  const scrollRef = useRef(null);

  /* GET /api/scripts + /api/campaigns — neither was wired before. */
  const loadSideData = async () => {
    const [h, c] = await Promise.allSettled([
      api.get('/api/scripts'),
      api.get('/api/campaigns')
    ]);
    setHistory(h.status === 'fulfilled' ? h.value?.data?.conversations || [] : []);
    if (c.status === 'fulfilled') setCampaigns(c.value?.data?.campaigns || []);
  };

  useEffect(() => { loadSideData(); }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [conversation?.messages?.length, busy]);

  const send = async (override) => {
    const text = (override ?? message).trim();
    if (!text) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const payload = await api.post('/api/ai/script', {
        conversationId: conversation?._id,
        message: text,
        platform,
        scriptType,
        campaignId: campaignId || undefined
      });
      setConversation(payload.data.conversation);
      setMessage('');
      loadSideData();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  /* GET /api/scripts/:id — reopen a past thread. */
  const openThread = async id => {
    setBusy(true);
    setError('');
    try {
      const payload = await api.get(`/api/scripts/${id}`);
      const c = payload?.data?.conversation;
      if (c) {
        setConversation(c);
        if (c.platform) setPlatform(c.platform);
        if (c.scriptType) setScriptType(c.scriptType);
        if (c.campaignId) setCampaignId(c.campaignId);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const convert = async () => {
    if (!conversation?._id) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/api/scripts/${conversation._id}/convert-to-content`, { campaignId });
      setNotice('Script converted into a content item.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const startFresh = () => {
    setConversation(null);
    setMessage('');
    setNotice('');
    setError('');
  };

  const finalScript = conversation?.finalScript || {};
  const messages = conversation?.messages || [];
  const scenes = useMemo(() => finalScript.sceneBreakdown || [], [finalScript]);

  return (
    <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_360px]">
      {/* ── History rail — GET /api/scripts, previously unreachable ───────── */}
      <aside className="order-2 space-y-3 xl:order-1">
        <Surface pad="sm" className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              <History className="h-3 w-3" />
              Threads
            </span>
            <Button size="sm" variant="ghost" onClick={startFresh} aria-label="New thread">
              <MessageSquarePlus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {!history ? (
            <div className="space-y-1.5">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-11" />)}
            </div>
          ) : history.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--border)] px-2 py-3 text-center text-[10px] text-[var(--muted)]">
              No saved threads yet
            </p>
          ) : (
            <ul className="space-y-1">
              {history.slice(0, 12).map(c => {
                const active = c._id === conversation?._id;
                return (
                  <li key={c._id}>
                    <button
                      type="button"
                      onClick={() => openThread(c._id)}
                      className={`focus-ring w-full rounded-lg border px-2 py-1.5 text-left transition-colors ${
                        active
                          ? 'border-[var(--accent-line)] bg-[var(--accent-soft)]'
                          : 'border-transparent hover:border-[var(--border)] hover:bg-[var(--surface2)]'
                      }`}
                    >
                      <p className={`truncate text-[11px] font-medium ${active ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}>
                        {c.title || c.finalScript?.title || 'Untitled thread'}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-[9px] text-[var(--muted)]">
                        <Clock className="h-2.5 w-2.5" />
                        {relTime(c.updatedAt || c.createdAt)}
                        {c.platform ? <span>· {formatPlatform(c.platform)}</span> : null}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Surface>

        {/* Starters */}
        <Surface pad="sm" className="space-y-2">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            <Sparkles className="h-3 w-3" />
            Quick starts
          </span>
          <div className="space-y-1">
            {STARTERS.map(s => (
              <motion.button
                key={s.label}
                type="button"
                onClick={() => send(s.text)}
                disabled={busy}
                whileHover={{ x: 2 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="focus-ring flex w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface2)]/50 px-2 py-1.5 text-left text-[11px] text-[var(--text-2)] transition-colors hover:border-[var(--accent-line)] hover:text-[var(--accent)] disabled:opacity-40"
              >
                <s.icon className="h-3 w-3 shrink-0" />
                <span className="truncate">{s.label}</span>
              </motion.button>
            ))}
          </div>
        </Surface>
      </aside>

      {/* ── Chat ──────────────────────────────────────────────────────────── */}
      <section className="order-1 min-w-0 xl:order-2">
        <Surface pad="none" className="flex h-full flex-col overflow-hidden">
          {/* Controls */}
          <div className="grid gap-2 border-b border-[var(--border)] bg-[var(--surface2)]/40 p-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Platform</span>
              <select
                value={platform}
                onChange={e => setPlatform(e.target.value)}
                className="focus-ring rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--text)]"
              >
                {platformOptions.map(p => <option key={p} value={p}>{formatPlatform(p)}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Script type</span>
              <select
                value={scriptType}
                onChange={e => setScriptType(e.target.value)}
                className="focus-ring rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--text)]"
              >
                {SCRIPT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Campaign</span>
              {/* Was a raw ObjectId text box — nobody can type one from memory. */}
              <select
                value={campaignId}
                onChange={e => setCampaignId(e.target.value)}
                className="focus-ring rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--text)]"
              >
                <option value="">None (no conversion)</option>
                {campaigns.map(c => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Stream */}
          <div
            ref={scrollRef}
            className="min-h-[380px] flex-1 space-y-3 overflow-y-auto p-3"
          >
            {messages.length === 0 && !busy ? (
              <div className="flex h-full min-h-[340px] flex-col items-center justify-center gap-3 text-center">
                <motion.span
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--accent-line)] bg-[var(--accent-soft)] shadow-[0_0_28px_-8px_var(--glow)]"
                >
                  <Bot className="h-5 w-5 text-[var(--accent)]" />
                </motion.span>
                <div>
                  <p className="text-sm font-semibold text-[var(--text)]">Start a script</p>
                  <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-[var(--muted)]">
                    Ask for hooks, a UGC ad, a scene-by-scene breakdown, a revision, a
                    shorter cut, or a platform re-optimisation.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {messages.map((m, i) => (
                  <Bubble key={`${m.role}-${i}`} role={m.role} content={m.content} index={i} />
                ))}
                <AnimatePresence>
                  {busy ? (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      <Thinking />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-[var(--border)] bg-[var(--surface2)]/40 p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={2}
                placeholder="Ask Script AI to create or revise a script…  (⌘/Ctrl + Enter to send)"
                className="focus-ring max-h-40 min-h-[52px] flex-1 resize-y rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--muted)]"
              />
              <Button
                variant="primary"
                onClick={() => send()}
                disabled={busy || !message.trim()}
                className="h-[52px] px-4"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Surface>
      </section>

      {/* ── Final script ──────────────────────────────────────────────────── */}
      <aside className="order-3 space-y-3">
        <Surface pad="sm" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              <FileText className="h-3 w-3" />
              Final script
            </span>
            {conversation?.aiProvider ? (
              <Badge tone="accent">{conversation.aiProvider}</Badge>
            ) : null}
          </div>

          {finalScript.title ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="space-y-3"
            >
              <h3 className="text-sm font-bold leading-snug tracking-tight text-[var(--text)]">
                {finalScript.title}
              </h3>

              <dl className="space-y-1.5">
                {[
                  { k: 'Hook', v: finalScript.hook },
                  { k: 'CTA', v: finalScript.cta },
                  { k: 'Duration', v: finalScript.estimatedDuration }
                ].filter(x => x.v).map(x => (
                  <div key={x.k} className="rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-2.5 py-1.5">
                    <dt className="text-[9px] font-semibold uppercase tracking-wider text-[var(--accent)]">{x.k}</dt>
                    <dd className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-2)]">{x.v}</dd>
                  </div>
                ))}
              </dl>

              {scenes.length ? (
                <div>
                  <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Scenes · {scenes.length}
                  </p>
                  <ol className="space-y-1.5">
                    {scenes.map((scene, i) => {
                      const isStr = typeof scene === 'string';
                      const label = isStr
                        ? null
                        : scene.label || (scene.sceneNumber ? `Scene ${scene.sceneNumber}` : null);
                      const body = isStr
                        ? scene
                        : scene.description || scene.visualDescription || scene.audioDescription ||
                          scene.dialogue || scene.textOnScreen || JSON.stringify(scene);
                      return (
                        <li
                          key={i}
                          className="flex gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-2.5 py-1.5"
                        >
                          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[var(--accent-line)] bg-[var(--accent-soft)] text-[8px] font-bold text-[var(--accent)]">
                            {i + 1}
                          </span>
                          <span className="min-w-0 text-[11px] leading-relaxed text-[var(--text-2)]">
                            {label ? <strong className="text-[var(--text)]">{label}: </strong> : null}
                            {body}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ) : null}

              {finalScript.voiceover || finalScript.dialogue ? (
                <div>
                  <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Voiceover
                  </p>
                  <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border border-[var(--border)] bg-[var(--surface2)] p-2.5 text-[11px] leading-relaxed text-[var(--text-2)]">
                    {finalScript.voiceover || finalScript.dialogue}
                  </pre>
                </div>
              ) : null}

              <Button
                variant="primary"
                onClick={convert}
                disabled={busy || !campaignId}
                className="w-full"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                Convert to content item
              </Button>
              {!campaignId ? (
                <p className="text-center text-[10px] text-[var(--muted)]">
                  Pick a campaign above to enable conversion.
                </p>
              ) : null}
            </motion.div>
          ) : (
            <EmptyState
              icon={FileText}
              title="No final script yet"
              description="Once Script AI settles on a structured script, its hook, CTA, scenes and voiceover land here."
            />
          )}
        </Surface>
      </aside>
    </div>
  );
}
