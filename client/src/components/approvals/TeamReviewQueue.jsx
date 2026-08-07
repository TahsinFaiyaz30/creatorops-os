'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Team review queue.
 *
 * Two things a head decides on, in one place:
 *
 *   · Deliverables — a member's finished work. Approving one is a gate, not a
 *     status: tasks that were waiting on it unlock the moment it clears, and the
 *     response says which ones did.
 *   · Releases — a cross-platform post waiting to go onto the head's own
 *     connected accounts. Until this is approved the worker will not claim the
 *     job, whatever permissions the member who queued it holds.
 *
 * Members without approval.decide still see this: the server returns their own
 * submissions so they can track what they sent in, and the decision buttons are
 * simply not rendered for them.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  PackageCheck, Send, Check, X, MessageSquareWarning, Camera, ImageOff, Clock3,
  Unlock, ChevronDown, UserCircle
} from 'lucide-react';

import { Badge, Button, EmptyState, Textarea } from '../ds';
import { api } from '../../lib/api';
import { formatPlatform } from '../../lib/platforms';
import { useToastState } from '../ui/toast';

const EASE = [0.16, 1, 0.3, 1];

const idOf = item => String(item?._id || item?.id || '');

export default function TeamReviewQueue({ onCounts }) {
  const [deliverables, setDeliverables] = useState(null);
  const [releases, setReleases] = useState([]);
  const [error, setError] = useToastState('danger');
  const [notice, setNotice] = useToastState('success');
  const [busy, setBusy] = useState('');

  const load = async () => {
    const [approvalsPayload, releasePayload] = await Promise.all([
      api.get('/api/approvals/pending').catch(() => null),
      api.get('/api/publish/releases').catch(() => null)
    ]);

    const pending = (approvalsPayload?.data?.approvals || []).filter(approval => approval.deliverable);
    const pendingReleases = releasePayload?.data?.releases || [];
    setDeliverables(pending);
    setReleases(pendingReleases);
    onCounts?.({ deliverables: pending.length, releases: pendingReleases.length });
  };

  useEffect(() => {
    load().catch(err => setError(err.message));
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const decideDeliverable = async (approval, decision, comment) => {
    const key = `${idOf(approval)}:${decision}`;
    setBusy(key);
    setError('');
    setNotice('');
    try {
      const payload = await api.post(
        `/api/collab/deliverables/${idOf(approval.deliverable)}/${decision}`,
        { comment }
      );
      const unblocked = payload.data?.unblockedTasks || [];
      setNotice(
        decision === 'approve' && unblocked.length
          ? `Approved. ${unblocked.length} task${unblocked.length === 1 ? '' : 's'} just unlocked: ${unblocked
              .map(task => `"${task.title}"`)
              .join(', ')}.`
          : `Decision recorded.`
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const decideRelease = async (release, action, comment) => {
    const key = `${release.postGroupId}:${action}`;
    setBusy(key);
    setError('');
    setNotice('');
    try {
      await api.post(`/api/publish/releases/${release.postGroupId}/${action}`, { comment });
      setNotice(
        action === 'approve'
          ? 'Released. The post will publish on the connected accounts.'
          : 'Release declined. The post stays held.'
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  if (!deliverables) {
    return <p className="text-xs text-[var(--muted)]">Loading team review queue…</p>;
  }

  const isEmpty = deliverables.length === 0 && releases.length === 0;

  return (
    <div className="space-y-3">

      {isEmpty ? (
        <EmptyState
          icon={PackageCheck}
          title="Nothing waiting on you"
          description="Work your team submits, and posts waiting to go onto your connected accounts, both land here."
        />
      ) : null}

      {releases.map(release => (
        <ReleaseCard
          key={release.postGroupId}
          release={release}
          busy={busy}
          onDecide={decideRelease}
        />
      ))}

      {deliverables.map(approval => (
        <DeliverableCard
          key={idOf(approval)}
          approval={approval}
          busy={busy}
          onDecide={decideDeliverable}
        />
      ))}
    </div>
  );
}

/* ── Release ──────────────────────────────────────────────────────────────── */

function ReleaseCard({ release, busy, onDecide }) {
  const [comment, setComment] = useState('');

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="overflow-hidden rounded-2xl border border-warning/30 bg-warning/5 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-[var(--text)]">
            <Send className="h-3.5 w-3.5 text-warning" />
            Post waiting for your release
          </h3>
          <p className="mt-0.5 text-[11px] text-[var(--muted)]">
            requested by {release.requestedBy?.name || 'a member'}
            {release.projectId?.name ? ` · ${release.projectId.name}` : ''} ·{' '}
            {new Date(release.createdAt).toLocaleString()}
          </p>
        </div>
        <Badge tone="warning">
          <Clock3 className="h-2.5 w-2.5" />
          held
        </Badge>
      </div>

      {release.comment ? (
        <p className="mt-2 text-[11px] italic leading-relaxed text-[var(--text-2)]">“{release.comment}”</p>
      ) : null}

      <div className="mt-3 space-y-1.5">
        {(release.jobs || []).map(job => (
          <div
            key={idOf(job)}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5"
          >
            <Badge tone="accent">{formatPlatform(job.platform)}</Badge>
            <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--text-2)]">
              {job.caption || 'No caption'}
            </span>
            <span className="shrink-0 text-[10px] text-[var(--muted)]">
              {job.accountSnapshot?.accountName || 'connected account'}
            </span>
          </div>
        ))}
      </div>

      <Textarea
        rows={2}
        value={comment}
        onChange={event => setComment(event.target.value)}
        placeholder="Optional note back to the member"
        className="mt-3 text-xs"
      />

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="primary"
          loading={busy === `${release.postGroupId}:approve`}
          onClick={() => onDecide(release, 'approve', comment)}
        >
          <Check className="h-3.5 w-3.5" />
          Release to accounts
        </Button>
        <Button
          size="sm"
          variant="danger"
          loading={busy === `${release.postGroupId}:reject`}
          onClick={() => onDecide(release, 'reject', comment)}
        >
          <X className="h-3.5 w-3.5" />
          Hold back
        </Button>
      </div>
    </motion.article>
  );
}

/* ── Deliverable ──────────────────────────────────────────────────────────── */

function DeliverableCard({ approval, busy, onDecide }) {
  const deliverable = approval.deliverable;
  const [comment, setComment] = useState('');
  const [open, setOpen] = useState(true);
  const canDecide = approval.canDecide;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/75 p-4 backdrop-blur-xl"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-[var(--text)]">{deliverable.title}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--muted)]">
            <UserCircle className="h-3 w-3" />
            {deliverable.ownerId?.name || 'a member'}
            {approval.projectId?.name ? ` · ${approval.projectId.name}` : ''} · revision {deliverable.revision}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge tone="accent">{deliverable.kind.replace(/_/g, ' ')}</Badge>
          <button
            type="button"
            onClick={() => setOpen(value => !value)}
            aria-expanded={open}
            className="focus-ring rounded p-1 text-[var(--muted)] hover:text-[var(--text)]"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="overflow-hidden"
          >
            {deliverable.notes ? (
              <p className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-[var(--text-2)]">
                {deliverable.notes}
              </p>
            ) : null}

            {(deliverable.mediaAssetIds || []).length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {deliverable.mediaAssetIds.map(asset => (
                  <MediaThumb key={idOf(asset)} asset={asset} />
                ))}
              </div>
            ) : null}

            {(deliverable.variantIds || []).length > 0 ? (
              <div className="mt-3 space-y-1.5">
                {deliverable.variantIds.map(variant => (
                  <div
                    key={idOf(variant)}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-2.5 py-1.5"
                  >
                    <Badge tone="accent">{formatPlatform(variant.platform)}</Badge>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[var(--text-2)]">
                      {variant.caption || 'No caption'}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            {canDecide ? (
              <>
                <Textarea
                  rows={2}
                  value={comment}
                  onChange={event => setComment(event.target.value)}
                  placeholder="What needs changing, or why this works"
                  className="mt-3 text-xs"
                />
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="primary"
                    loading={busy === `${idOf(approval)}:approve`}
                    onClick={() => onDecide(approval, 'approve', comment)}
                  >
                    <Unlock className="h-3.5 w-3.5" />
                    Approve &amp; unlock
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={busy === `${idOf(approval)}:request-changes`}
                    onClick={() => onDecide(approval, 'request-changes', comment)}
                  >
                    <MessageSquareWarning className="h-3.5 w-3.5" />
                    Request changes
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    loading={busy === `${idOf(approval)}:reject`}
                    onClick={() => onDecide(approval, 'reject', comment)}
                  >
                    <X className="h-3.5 w-3.5" />
                    Reject
                  </Button>
                </div>
              </>
            ) : (
              <p className="mt-3 rounded-lg bg-[var(--surface2)] px-2.5 py-2 text-[10px] leading-relaxed text-[var(--muted)]">
                Waiting on someone with approval rights in this team. You are seeing this because you submitted it.
              </p>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.article>
  );
}

function MediaThumb({ asset }) {
  const [broken, setBroken] = useState(false);

  return (
    <div className="h-16 w-16 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface2)]">
      {asset?.publicUrl && !broken ? (
        asset.mediaType === 'video' ? (
          <video
            src={asset.publicUrl}
            className="h-full w-full object-cover"
            muted
            playsInline
            preload="metadata"
            onError={() => setBroken(true)}
          />
        ) : (
          <img src={asset.publicUrl} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
        )
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          {broken ? <ImageOff className="h-4 w-4 text-[var(--muted)]" /> : <Camera className="h-4 w-4 text-[var(--muted)]" />}
        </div>
      )}
    </div>
  );
}
