'use client';

import { useEffect, useState } from 'react';
import { Check, MessageSquareWarning, X } from 'lucide-react';
import { api } from '../../lib/api';
import SchedulePanel from '../schedule/SchedulePanel';

export default function ApprovalQueue({ user }) {
  const [approvals, setApprovals] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = async () => {
    setMessage('');
    try {
      const payload = await api.get('/api/approvals/pending');
      setApprovals(payload.data.approvals || []);
    } catch (err) {
      setMessage(err.status === 403 ? 'Your current roles cannot access creator review. This is backend-enforced RBAC.' : err.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (approval, action) => {
    setBusyId(approval._id);
    setMessage('');
    const commentMap = {
      approve: 'Approved for publishing',
      reject: 'CTA is weak',
      'request-changes': 'Make the hook stronger'
    };

    try {
      const payload = await api.post(`/api/approvals/${approval._id}/${action}`, {
        comment: commentMap[action]
      });
      setApprovals(current => current.filter(item => item._id !== approval._id));
      setDecisions(current => [payload.data, ...current]);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusyId('');
    }
  };

  return (
    <section className="space-y-4">
      {message && <div className="rounded-xl border border-gold/30 bg-gold/10 p-3 text-sm text-gold">{message}</div>}
      {approvals.length === 0 && !message && <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">No variants waiting for creator review.</div>}

      {approvals.map(approval => {
        const variant = approval.variantId;
        const content = approval.contentItemId;
        return (
          <article key={approval._id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text)]">{content?.title}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{content?.rawIdea}</p>
              </div>
              <span className="rounded-full bg-mint/10 px-2.5 py-1 text-xs font-semibold text-mint">{variant?.platform}</span>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-[var(--text)]">
              <p><span className="text-[var(--muted)]">Hook:</span> {variant?.hook}</p>
              <p><span className="text-[var(--muted)]">Caption:</span> {variant?.caption}</p>
              <p><span className="text-[var(--muted)]">CTA:</span> {variant?.cta}</p>
              <p><span className="text-[var(--muted)]">Submitted by:</span> {approval.requestedBy?.email}</p>
              <p><span className="text-[var(--muted)]">Scores:</span> Brand {variant?.brandScore} / Readiness {variant?.readinessScore}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => decide(approval, 'approve')} disabled={busyId === approval._id} className="focus-ring inline-flex items-center gap-2 rounded-xl bg-mint px-3 py-2 text-sm font-semibold text-[var(--accent-fg)]">
                <Check size={15} /> Approve for publishing
              </button>
              <button onClick={() => decide(approval, 'reject')} disabled={busyId === approval._id} className="focus-ring inline-flex items-center gap-2 rounded-xl bg-rose px-3 py-2 text-sm font-semibold text-[var(--text)]">
                <X size={15} /> Reject
              </button>
              <button onClick={() => decide(approval, 'request-changes')} disabled={busyId === approval._id} className="focus-ring inline-flex items-center gap-2 rounded-xl bg-gold px-3 py-2 text-sm font-semibold text-[var(--accent-fg)]">
                <MessageSquareWarning size={15} /> Request changes
              </button>
            </div>
          </article>
        );
      })}

      {decisions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-[var(--text)]">Recent review decisions</h3>
          {decisions.map(decision => (
            <article key={decision.approval._id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-[var(--text)]">{decision.variant.platform}</span>
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-[var(--text)]">{decision.approval.status}</span>
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">{decision.approval.comment}</p>
              <SchedulePanel variant={decision.variant} user={user} onDone={load} />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
