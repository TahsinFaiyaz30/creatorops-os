'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ApprovalQueue — review desk.
 *
 * Fixes a real defect, not just the look: decision comments were HARDCODED.
 *   reject          → always stored "CTA is weak"
 *   request-changes → always stored "Make the hook stronger"
 * The reviewer had no way to say why, and the creator received a canned reason
 * that was probably wrong. There is now a comment box; the old strings are
 * offered as one-tap presets instead of being forced.
 *
 * Endpoints: GET /api/approvals/pending, POST /api/approvals/:id/{approve,
 * reject,request-changes}.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check, X, MessageSquareWarning, ShieldCheck, Gauge, Sparkles,
  User as UserIcon, Quote, Megaphone, History
} from 'lucide-react';

import { Surface, Badge, Button, Notice, Textarea, EmptyState, Skeleton } from '../ds';
import { toast } from '../ui/toast';
import { api } from '../../lib/api';
import SchedulePanel from '../schedule/SchedulePanel';

const EASE = [0.16, 1, 0.3, 1];

/* Offered, not forced. */
const PRESETS = {
  approve: ['Approved for publishing', 'On brand, ship it', 'Strong hook — good to go'],
  reject: ['CTA is weak', 'Off brand voice', 'Claim needs substantiation'],
  'request-changes': ['Make the hook stronger', 'Tighten the first 3 seconds', 'Add a clearer CTA']
};

const ACTIONS = [
  { key: 'approve', label: 'Approve', icon: Check, variant: 'primary' },
  { key: 'request-changes', label: 'Request changes', icon: MessageSquareWarning, variant: 'secondary' },
  { key: 'reject', label: 'Reject', icon: X, variant: 'danger' }
];

const STATUS_TONE = {
  approved: 'success', rejected: 'danger',
  changes_requested: 'warning', pending: 'neutral'
};

/* ── Score meter ──────────────────────────────────────────────────────────── */

function ScoreMeter({ label, value, icon: Icon }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const tone = pct >= 75 ? 'var(--success)' : pct >= 45 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          <Icon className="h-2.5 w-2.5" />
          {label}
        </span>
        <span className="text-[11px] font-bold tabular-nums" style={{ color: tone }}>
          {value ?? '—'}
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--surface3)]">
        <motion.div
          className="h-full rounded-full"
          style={{ background: tone }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: EASE }}
        />
      </div>
    </div>
  );
}

/* ── Field block ──────────────────────────────────────────────────────────── */

function VariantField({ label, value, icon: Icon }) {
  if (!value) return null;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-2.5 py-2">
      <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--accent)]">
        <Icon className="h-2.5 w-2.5" />
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--text-2)]">{value}</p>
    </div>
  );
}

/* ── One review card ──────────────────────────────────────────────────────── */

function ReviewCard({ approval, busy, onDecide }) {
  const variant = approval.variantId || {};
  const content = approval.contentItemId || {};
  const [comment, setComment] = useState('');
  const [pending, setPending] = useState(null);

  const submit = key => {
    onDecide(approval, key, comment.trim() || PRESETS[key][0]);
    setComment('');
    setPending(null);
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.22 } }}
      transition={{ duration: 0.45, ease: EASE }}
      className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 shadow-[var(--shadow)] backdrop-blur-xl"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_70%_at_0%_0%,var(--accent-soft),transparent_55%)]"
      />

      <div className="relative space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-bold leading-snug tracking-tight text-[var(--text)]">
              {content.title || 'Untitled content'}
            </h3>
            {content.rawIdea ? (
              <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[var(--muted)]">
                {content.rawIdea}
              </p>
            ) : null}
          </div>
          <Badge tone="accent">{variant.platform || 'unknown'}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <ScoreMeter label="Brand" value={variant.brandScore} icon={ShieldCheck} />
          <ScoreMeter label="Readiness" value={variant.readinessScore} icon={Gauge} />
        </div>

        <div className="space-y-1.5">
          <VariantField label="Hook" value={variant.hook} icon={Sparkles} />
          <VariantField label="Caption" value={variant.caption} icon={Quote} />
          <VariantField label="CTA" value={variant.cta} icon={Megaphone} />
        </div>

        <p className="flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
          <UserIcon className="h-3 w-3" />
          Submitted by {approval.requestedBy?.email || 'unknown'}
        </p>

        <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface2)]/60 p-2.5">
          <Textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Why? This reaches the creator…"
            aria-label="Review comment"
            className="min-h-[52px] text-[12px]"
          />

          {pending ? (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap gap-1"
            >
              {PRESETS[pending].map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setComment(p)}
                  className="focus-ring rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] text-[var(--muted)] transition-colors hover:border-[var(--accent-line)] hover:text-[var(--accent)]"
                >
                  {p}
                </button>
              ))}
            </motion.div>
          ) : null}

          <div className="flex flex-wrap gap-1.5">
            {ACTIONS.map(a => (
              <Button
                key={a.key}
                size="sm"
                variant={a.variant}
                disabled={busy}
                onMouseEnter={() => setPending(a.key)}
                onFocus={() => setPending(a.key)}
                onClick={() => submit(a.key)}
              >
                <a.icon className="h-3.5 w-3.5" />
                {a.label}
              </Button>
            ))}
          </div>
          {!comment.trim() ? (
            <p className="text-[10px] text-[var(--muted)]">
              Leave blank and a default reason is sent. Hover an action for presets.
            </p>
          ) : null}
        </div>
      </div>
    </motion.article>
  );
}

/* ── Queue ────────────────────────────────────────────────────────────────── */

export default function ApprovalQueue({ user, onStats }) {
  const [approvals, setApprovals] = useState(null);
  const [decisions, setDecisions] = useState([]);
  const [message, setMessage] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState('');

  const load = async () => {
    setMessage('');
    try {
      const payload = await api.get('/api/approvals/pending');
      /*
       * The endpoint now returns deliverable submissions and release requests
       * alongside per-variant reviews. Those are rendered by TeamReviewQueue,
       * which knows how to show a bundle of media; here they arrived with no
       * variant attached and drew as "Untitled content / unknown".
       */
      setApprovals(
        (payload.data.approvals || []).filter(
          approval => approval.variantId && (approval.subjectType || 'PlatformVariant') === 'PlatformVariant'
        )
      );
      setForbidden(false);
    } catch (err) {
      setApprovals([]);
      if (err.status === 403) {
        /*
         * Not an event — it is the standing state of this screen for this
         * account, and it explains why the queue is empty. It stays inline;
         * a toast would vanish and leave a blank page with no reason given.
         */
        setForbidden(true);
        setMessage('Your current roles cannot access creator review. This is backend-enforced RBAC.');
      } else {
        toast.error(err.message);
      }
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    onStats?.({ pending: approvals?.length ?? 0, decisions });
  }, [approvals, decisions, onStats]);

  const decide = async (approval, action, comment) => {
    setBusyId(approval._id);
    setMessage('');
    try {
      const payload = await api.post(`/api/approvals/${approval._id}/${action}`, { comment });
      setApprovals(current => (current || []).filter(item => item._id !== approval._id));
      setDecisions(current => [payload.data, ...current]);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Only the RBAC refusal reaches here now — everything else is a toast. */}
      {message && forbidden ? <Notice tone="warning">{message}</Notice> : null}

      {!approvals ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-64" />)}
        </div>
      ) : approvals.length === 0 && !forbidden ? (
        <EmptyState
          icon={ShieldCheck}
          title="Queue is clear"
          description="Nothing is waiting on a creator decision. Variants submitted for review from Compose or a campaign land here."
        />
      ) : (
        <AnimatePresence mode="popLayout">
          {approvals.map(approval => (
            <ReviewCard
              key={approval._id}
              approval={approval}
              busy={busyId === approval._id}
              onDecide={decide}
            />
          ))}
        </AnimatePresence>
      )}

      {decisions.length > 0 ? (
        <div className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            <History className="h-3 w-3" />
            This session · {decisions.length}
          </h3>
          {decisions.map(decision => (
            <motion.article
              key={decision.approval._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              <Surface pad="sm" className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--text)]">
                    {decision.variant?.platform}
                  </span>
                  <Badge tone={STATUS_TONE[decision.approval.status] || 'neutral'}>
                    {(decision.approval.status || '').replace(/_/g, ' ')}
                  </Badge>
                </div>
                {decision.approval.comment ? (
                  <p className="rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-2.5 py-1.5 text-[11px] leading-relaxed text-[var(--text-2)]">
                    “{decision.approval.comment}”
                  </p>
                ) : null}
                <SchedulePanel variant={decision.variant} user={user} onDone={load} />
              </Surface>
            </motion.article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
