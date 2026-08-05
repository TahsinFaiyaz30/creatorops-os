'use client';

import { useEffect, useState } from 'react';
import { Bot, CheckCircle2, Send, Wand2 } from 'lucide-react';
import { api } from '../../lib/api';
import { formatPlatform } from '../../lib/platforms';
import SchedulePanel from '../schedule/SchedulePanel';

const statusClass = {
  draft: 'bg-slate-500/15 text-[var(--text)]',
  in_review: 'bg-mint/10 text-mint',
  approved: 'bg-mint/10 text-mint',
  rejected: 'bg-rose/10 text-rose',
  changes_requested: 'bg-gold/10 text-gold',
  scheduled: 'bg-mint/10 text-mint',
  published: 'bg-mint/10 text-mint'
};

export default function PlatformVariantCard({ variant, user, onRefresh }) {
  const [localVariant, setLocalVariant] = useState(variant);
  const [formatRule, setFormatRule] = useState(null);
  const [matchingAccounts, setMatchingAccounts] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLocalVariant(variant);
  }, [variant]);

  useEffect(() => {
    if (!localVariant?.platform) return;

    Promise.allSettled([
      api.get(`/api/platform-formats/${localVariant.platform}`),
      api.get(`/api/platform-connections?platform=${localVariant.platform}`)
    ]).then(results => {
      setFormatRule(results[0].value?.data?.rule || null);
      setMatchingAccounts((results[1].value?.data?.connections || []).filter(account => account.status === 'connected'));
    });
  }, [localVariant?.platform]);

  const submitForReview = async () => {
    setBusy(true);
    setMessage('');
    try {
      await api.post('/api/approvals/request', {
        variantId: localVariant._id,
        comment: 'Ready for final creator review'
      });
      setLocalVariant({ ...localVariant, status: 'in_review' });
      setMessage('Queued for creator review.');
      onRefresh?.();
    } catch (err) {
      setMessage(err.status === 409 ? 'A pending review request already exists for this variant.' : err.message);
    } finally {
      setBusy(false);
    }
  };

  const optimize = async () => {
    setBusy(true);
    setMessage('');
    try {
      const payload = await api.post('/api/ai/optimize', {
        variantId: localVariant._id,
        changeNote: 'Optimized from frontend'
      });
      setLocalVariant(payload.data.variant);
      setMessage('Variant optimized.');
      onRefresh?.();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-mint">{formatPlatform(localVariant.platform)}</div>
          <div className="mt-1 flex items-center gap-2 text-xs text-[var(--muted)]">
            <Bot size={14} />
            {localVariant.aiProvider}
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[localVariant.status] || statusClass.draft}`}>
          {localVariant.status}
        </span>
      </div>

      <div className="mt-4 grid gap-3 text-sm">
        <p className="text-[var(--text)]"><span className="text-[var(--muted)]">Hook:</span> {localVariant.hook}</p>
        <p className="text-[var(--text)]"><span className="text-[var(--muted)]">Caption:</span> {localVariant.caption}</p>
        <p className="text-[var(--text)]"><span className="text-[var(--muted)]">CTA:</span> {localVariant.cta}</p>
        <div className="flex flex-wrap gap-2">
          {(localVariant.hashtags || []).map(tag => (
            <span key={tag} className="rounded-full bg-[var(--surface2)] px-2 py-1 text-xs text-[var(--text)]">{tag}</span>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-3">
          <div className="text-xs text-[var(--muted)]">Brand score</div>
          <div className="text-2xl font-bold text-mint">{localVariant.brandScore}</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-3">
          <div className="text-xs text-[var(--muted)]">Readiness</div>
          <div className="text-2xl font-bold text-mint">{localVariant.readinessScore}</div>
        </div>
      </div>

      {(localVariant.warnings?.length > 0 || localVariant.suggestions?.length > 0) && (
        <div className="mt-4 grid gap-2 text-xs">
          {localVariant.warnings?.length > 0 && <p className="text-gold">Warnings: {localVariant.warnings.join(' ')}</p>}
          {localVariant.suggestions?.length > 0 && <p className="text-[var(--muted)]">Suggestions: {localVariant.suggestions.join(' ')}</p>}
        </div>
      )}

      <FormatChecklist variant={localVariant} rule={formatRule} accountAvailable={matchingAccounts.length > 0} />

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={submitForReview}
          disabled={busy || localVariant.status !== 'draft'}
          className="focus-ring inline-flex items-center gap-2 rounded-xl bg-mint px-3 py-2 text-sm font-semibold text-[var(--accent-fg)]"
        >
          <Send size={15} />
          Queue for review
        </button>
        <button
          type="button"
          onClick={optimize}
          disabled={busy}
          className="focus-ring inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)] hover:bg-white/5"
        >
          <Wand2 size={15} />
          Optimize
        </button>
      </div>

      <SchedulePanel variant={localVariant} user={user} onDone={onRefresh} />

      {message && (
        <div className="mt-3 inline-flex items-center gap-2 text-sm text-[var(--text)]">
          <CheckCircle2 size={15} className="text-mint" />
          {message}
        </div>
      )}
    </article>
  );
}

function FormatChecklist({ variant, rule, accountAvailable }) {
  if (!rule) {
    return null;
  }

  const captionLength = (variant.caption || '').length;
  const hashtagCount = (variant.hashtags || []).length;
  const items = [
    ['Hook exists', Boolean(variant.hook)],
    ['CTA exists', Boolean(variant.cta)],
    ['Hashtags within limit', hashtagCount <= rule.maxHashtags],
    ['Caption within limit', captionLength <= rule.maxCaptionLength],
    ['Real connected account available', accountAvailable],
    ['Creator reviewed before publishing', ['approved', 'scheduled', 'published'].includes(variant.status)]
  ];

  return (
    <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface2)]/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-[var(--text)]">Platform fit</div>
        <div className="text-xs text-[var(--muted)]">
          Caption {captionLength}/{rule.maxCaptionLength} | Hashtags {hashtagCount}/{rule.maxHashtags}
        </div>
      </div>
      <p className="mt-1 text-xs text-[var(--muted)]">{rule.contentStyle}</p>
      <div className="mt-3 grid gap-1 text-xs">
        {items.map(([label, ok]) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <span className="text-[var(--text)]">{label}</span>
            <span className={ok ? 'text-mint' : 'text-gold'}>{ok ? 'yes' : 'needs work'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
