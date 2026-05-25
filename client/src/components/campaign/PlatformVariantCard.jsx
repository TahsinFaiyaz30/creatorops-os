'use client';

import { useState } from 'react';
import { Bot, CheckCircle2, Send, ShieldAlert, Wand2 } from 'lucide-react';
import { api } from '../../lib/api';
import SchedulePanel from '../schedule/SchedulePanel';

const statusClass = {
  draft: 'bg-slate-500/15 text-slate-200',
  in_review: 'bg-cyan/10 text-cyan',
  approved: 'bg-mint/10 text-mint',
  rejected: 'bg-rose/10 text-rose',
  changes_requested: 'bg-gold/10 text-gold',
  scheduled: 'bg-cyan/10 text-cyan',
  published: 'bg-mint/10 text-mint'
};

export default function PlatformVariantCard({ variant, user, onRefresh }) {
  const [localVariant, setLocalVariant] = useState(variant);
  const [approvalId, setApprovalId] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submitForReview = async () => {
    setBusy(true);
    setMessage('');
    try {
      const payload = await api.post('/api/approvals/request', {
        variantId: localVariant._id,
        comment: 'Ready for review'
      });
      setApprovalId(payload.data.approval._id);
      setLocalVariant({ ...localVariant, status: 'in_review' });
      setMessage('Submitted for review.');
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

  const tryApproveAsEditor = async () => {
    if (!approvalId) return;
    setBusy(true);
    setMessage('');
    try {
      await api.post(`/api/approvals/${approvalId}/approve`, { comment: 'Editor approval attempt' });
      setMessage('Unexpectedly approved.');
    } catch (err) {
      setMessage(err.status === 403 ? 'Backend blocked this action: only Creator/Admin can approve.' : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="rounded-lg border border-line bg-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-cyan">{localVariant.platform}</div>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
            <Bot size={14} />
            {localVariant.aiProvider}
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[localVariant.status] || statusClass.draft}`}>
          {localVariant.status}
        </span>
      </div>

      <div className="mt-4 grid gap-3 text-sm">
        <p className="text-white"><span className="text-slate-500">Hook:</span> {localVariant.hook}</p>
        <p className="text-slate-300"><span className="text-slate-500">Caption:</span> {localVariant.caption}</p>
        <p className="text-slate-300"><span className="text-slate-500">CTA:</span> {localVariant.cta}</p>
        <div className="flex flex-wrap gap-2">
          {(localVariant.hashtags || []).map(tag => (
            <span key={tag} className="rounded-full bg-ink px-2 py-1 text-xs text-slate-300">{tag}</span>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-md border border-line bg-ink p-3">
          <div className="text-xs text-slate-500">Brand score</div>
          <div className="text-2xl font-bold text-mint">{localVariant.brandScore}</div>
        </div>
        <div className="rounded-md border border-line bg-ink p-3">
          <div className="text-xs text-slate-500">Readiness</div>
          <div className="text-2xl font-bold text-cyan">{localVariant.readinessScore}</div>
        </div>
      </div>

      {(localVariant.warnings?.length > 0 || localVariant.suggestions?.length > 0) && (
        <div className="mt-4 grid gap-2 text-xs">
          {localVariant.warnings?.length > 0 && <p className="text-gold">Warnings: {localVariant.warnings.join(' ')}</p>}
          {localVariant.suggestions?.length > 0 && <p className="text-slate-400">Suggestions: {localVariant.suggestions.join(' ')}</p>}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={submitForReview}
          disabled={busy || localVariant.status !== 'draft'}
          className="focus-ring inline-flex items-center gap-2 rounded-md bg-cyan px-3 py-2 text-sm font-semibold text-ink"
        >
          <Send size={15} />
          Submit for review
        </button>
        <button
          type="button"
          onClick={optimize}
          disabled={busy}
          className="focus-ring inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-slate-200 hover:bg-white/5"
        >
          <Wand2 size={15} />
          Optimize
        </button>
        {user?.role === 'editor' && approvalId && (
          <button
            type="button"
            onClick={tryApproveAsEditor}
            disabled={busy}
            className="focus-ring inline-flex items-center gap-2 rounded-md border border-rose/40 px-3 py-2 text-sm text-rose hover:bg-rose/10"
          >
            <ShieldAlert size={15} />
            Try approve as Editor
          </button>
        )}
      </div>

      <SchedulePanel variant={localVariant} user={user} onDone={onRefresh} />

      {message && (
        <div className="mt-3 inline-flex items-center gap-2 text-sm text-slate-300">
          <CheckCircle2 size={15} className="text-mint" />
          {message}
        </div>
      )}
    </article>
  );
}
