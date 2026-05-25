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
      setMessage(err.status === 403 ? 'Editors cannot access the approval queue. This is backend-enforced RBAC.' : err.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (approval, action) => {
    setBusyId(approval._id);
    setMessage('');
    const commentMap = {
      approve: 'Approved from frontend',
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
      {message && <div className="rounded-md border border-gold/30 bg-gold/10 p-3 text-sm text-gold">{message}</div>}
      {approvals.length === 0 && !message && <div className="rounded-lg border border-line bg-panel p-6 text-sm text-slate-400">No pending approvals.</div>}

      {approvals.map(approval => {
        const variant = approval.variantId;
        const content = approval.contentItemId;
        return (
          <article key={approval._id} className="rounded-lg border border-line bg-panel p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">{content?.title}</h3>
                <p className="mt-1 text-sm text-slate-400">{content?.rawIdea}</p>
              </div>
              <span className="rounded-full bg-cyan/10 px-2.5 py-1 text-xs font-semibold text-cyan">{variant?.platform}</span>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-slate-300">
              <p><span className="text-slate-500">Hook:</span> {variant?.hook}</p>
              <p><span className="text-slate-500">Caption:</span> {variant?.caption}</p>
              <p><span className="text-slate-500">CTA:</span> {variant?.cta}</p>
              <p><span className="text-slate-500">Requested by:</span> {approval.requestedBy?.email}</p>
              <p><span className="text-slate-500">Scores:</span> Brand {variant?.brandScore} / Readiness {variant?.readinessScore}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => decide(approval, 'approve')} disabled={busyId === approval._id} className="focus-ring inline-flex items-center gap-2 rounded-md bg-mint px-3 py-2 text-sm font-semibold text-ink">
                <Check size={15} /> Approve
              </button>
              <button onClick={() => decide(approval, 'reject')} disabled={busyId === approval._id} className="focus-ring inline-flex items-center gap-2 rounded-md bg-rose px-3 py-2 text-sm font-semibold text-white">
                <X size={15} /> Reject
              </button>
              <button onClick={() => decide(approval, 'request-changes')} disabled={busyId === approval._id} className="focus-ring inline-flex items-center gap-2 rounded-md bg-gold px-3 py-2 text-sm font-semibold text-ink">
                <MessageSquareWarning size={15} /> Request changes
              </button>
            </div>
          </article>
        );
      })}

      {decisions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-white">Recent decisions</h3>
          {decisions.map(decision => (
            <article key={decision.approval._id} className="rounded-lg border border-line bg-panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-white">{decision.variant.platform}</span>
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-300">{decision.approval.status}</span>
              </div>
              <p className="mt-2 text-sm text-slate-400">{decision.approval.comment}</p>
              <SchedulePanel variant={decision.variant} user={user} onDone={load} />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
