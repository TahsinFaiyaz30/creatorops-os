'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Applications on one circular, from the brand representative's side.
 *
 * The card used to print raw workspace-wide Views / Comments / Engagement totals,
 * which said nothing useful: an applicant with one viral post on an irrelevant
 * platform outranked a consistent creator on exactly the platforms the circular
 * asked for. It now shows the server-generated means — followers, views and
 * engagement averaged across this circular's required platforms only — so two
 * applicants are always read on the same scale.
 *
 * "Details" opens the full review: both attached posts, the analytics as a
 * chart, the decision buttons, and a link that opens the applicant's profile in
 * a new tab.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Users, Eye, Heart, X, ExternalLink, Star, ThumbsUp, ThumbsDown, ListChecks,
  Camera, ImageOff, LayoutList, Inbox
} from 'lucide-react';

import { Badge, Button, EmptyState, Notice } from '../ds';
import { api } from '../../lib/api';
import { formatPlatform } from '../../lib/platforms';
import { MeanTiles, PlatformMeanChart, WindowTimeline, compactNumber } from './ApplicantAnalytics';
import { useToastState } from '../ui/toast';

const EASE = [0.16, 1, 0.3, 1];

const STATUS_TONE = {
  submitted: 'neutral',
  viewed: 'accent',
  shortlisted: 'warning',
  accepted: 'success',
  rejected: 'danger',
  withdrawn: 'neutral'
};

const idOf = item => String(item?._id || item?.id || '');

const profileHref = application => `/applications/${idOf(application)}/creator`;

export default function ApplicationReviewPanel({ applications, onChanged }) {
  const [openApplication, setOpenApplication] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useToastState('danger');

  /* Keep the modal in step with a refreshed list after a decision. */
  useEffect(() => {
    if (!openApplication) return;
    const fresh = applications.find(application => idOf(application) === idOf(openApplication));
    if (fresh && fresh !== openApplication) setOpenApplication(fresh);
  }, [applications, openApplication]);

  const act = async (application, action) => {
    setBusy(`${idOf(application)}:${action}`);
    setError('');
    try {
      await api.post(`/api/applications/${idOf(application)}/${action}`, {});
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-base font-semibold tracking-tight text-[var(--text)]">
          <Inbox className="h-4 w-4 text-[var(--accent)]" />
          Applications
        </h2>
        <span className="text-[11px] text-[var(--muted)]">
          {applications.length} applicant{applications.length === 1 ? '' : 's'}
        </span>
      </div>


      {applications.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No applications yet"
          description="Creators who cover every platform this circular requires can apply with two published posts and their generated platform means."
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {applications.map((application, index) => (
            <ApplicantCard
              key={idOf(application)}
              application={application}
              index={index}
              busy={busy}
              onAct={act}
              onOpen={() => setOpenApplication(application)}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {openApplication ? (
          <ApplicantModal
            application={openApplication}
            busy={busy}
            onAct={act}
            onClose={() => setOpenApplication(null)}
          />
        ) : null}
      </AnimatePresence>
    </section>
  );
}

/* ── Card ─────────────────────────────────────────────────────────────────── */

function ApplicantCard({ application, index, busy, onAct, onOpen }) {
  const mean = application.meanStatsSnapshot?.mean || {};
  const windowDays = application.analyticsWindow?.days || application.meanStatsSnapshot?.windowDays || 30;
  const creator = application.creatorId || {};

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE, delay: Math.min(index, 8) * 0.03 }}
      className="relative flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/75 shadow-[var(--shadow)] backdrop-blur-xl"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_70%_at_0%_0%,var(--accent-soft),transparent_55%)]"
      />

      <div className="relative flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold tracking-tight text-[var(--text)]">{creator.name || 'Creator'}</h3>
          <p className="truncate text-[11px] text-[var(--muted)]">{creator.email}</p>
          {creator.totalReviews ? (
            <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--muted)]">
              <Star className="h-2.5 w-2.5 fill-warning text-warning" />
              {creator.averageRating?.toFixed?.(1) ?? creator.averageRating} · {creator.totalReviews} collaborations
            </p>
          ) : null}
        </div>
        <Badge tone={STATUS_TONE[application.status] || 'neutral'}>{application.status}</Badge>
      </div>

      {/* The three means that replaced raw workspace totals. */}
      <div className="relative grid grid-cols-3 gap-2 px-4">
        <MeanMetric
          label="Followers mean"
          icon={Users}
          value={mean.followers === null || mean.followers === undefined ? '—' : compactNumber(mean.followers)}
        />
        <MeanMetric label="Views mean" icon={Eye} value={compactNumber(mean.views ?? 0)} hint={`last ${windowDays}d`} />
        <MeanMetric label="Engagement mean" icon={Heart} value={compactNumber(mean.engagement ?? 0)} hint={`last ${windowDays}d`} />
      </div>

      <div className="relative mt-3 flex flex-wrap gap-1 px-4">
        {(application.commonPlatforms || []).map(platform => (
          <span
            key={platform}
            className="rounded-md border border-[var(--accent-line)] bg-[var(--accent-soft)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--accent)]"
          >
            {formatPlatform(platform)}
          </span>
        ))}
      </div>

      {application.message ? (
        <p className="relative mt-3 line-clamp-2 px-4 text-[11px] leading-relaxed text-[var(--text-2)]">
          {application.message}
        </p>
      ) : null}

      <div className="relative mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--surface2)]/40 px-4 py-2.5">
        <span className="text-[10px] text-[var(--muted)]">
          {(application.selectedPostIds || []).length} posts attached
        </span>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="secondary" as="a" href={profileHref(application)} target="_blank" rel="noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            Profile
          </Button>
          <Button size="sm" variant="primary" onClick={onOpen}>
            <LayoutList className="h-3.5 w-3.5" />
            Details
          </Button>
        </div>
      </div>
    </motion.article>
  );
}

function MeanMetric({ label, value, icon: Icon, hint }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-2 py-1.5">
      <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-[var(--muted)]">
        <Icon className="h-2.5 w-2.5" />
        {label}
      </p>
      <p className="mt-0.5 text-sm font-bold tabular-nums text-[var(--text)]">{value}</p>
      {hint ? <p className="text-[9px] text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

/* ── Details modal ────────────────────────────────────────────────────────── */

function ApplicantModal({ application, busy, onAct, onClose }) {
  const statistics = application.meanStatsSnapshot || null;
  const creator = application.creatorId || {};
  const posts = application.selectedPostIds || [];

  useEffect(() => {
    const onKey = event => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const decisions = [
    { action: 'shortlist', label: 'Shortlist', icon: ListChecks, variant: 'secondary' },
    { action: 'accept', label: 'Accept', icon: ThumbsUp, variant: 'primary' },
    { action: 'reject', label: 'Reject', icon: ThumbsDown, variant: 'danger' }
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-sm sm:p-6"
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Application from ${creator.name || 'creator'}`}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.3, ease: EASE }}
        className="my-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface2)]/50 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold tracking-tight text-[var(--text)]">
              {creator.name || 'Creator'}
            </h2>
            <p className="truncate text-[11px] text-[var(--muted)]">
              {creator.email} · applied {new Date(application.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge tone={STATUS_TONE[application.status] || 'neutral'}>{application.status}</Badge>
            <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto p-4">
          {application.creatorProfileSummary || application.message ? (
            <section className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface2)]/60 p-3">
              {application.creatorProfileSummary ? (
                <p className="text-[11px] leading-relaxed text-[var(--text-2)]">
                  <span className="font-semibold text-[var(--text)]">Profile: </span>
                  {application.creatorProfileSummary}
                </p>
              ) : null}
              {application.message ? (
                <p className="text-[11px] leading-relaxed text-[var(--text-2)]">
                  <span className="font-semibold text-[var(--text)]">Message: </span>
                  {application.message}
                </p>
              ) : null}
            </section>
          ) : null}

          <section className="space-y-2">
            <h3 className="text-sm font-semibold tracking-tight text-[var(--text)]">
              Attached posts ({posts.length})
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {posts.map(post => (
                <AttachedPost key={idOf(post)} post={post} />
              ))}
              {posts.length === 0 ? (
                <p className="text-[11px] text-[var(--muted)]">No posts were attached to this application.</p>
              ) : null}
            </div>
          </section>

          {statistics ? (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold tracking-tight text-[var(--text)]">
                Analytics at time of application
              </h3>
              <MeanTiles statistics={statistics} />
              <PlatformMeanChart statistics={statistics} />
              <WindowTimeline statistics={statistics} />
              {statistics.unavailableMessage ? <Notice tone="warning">{statistics.unavailableMessage}</Notice> : null}
            </section>
          ) : (
            <Notice tone="warning">
              This application was submitted before platform means were generated, so only the attached posts are
              available.
            </Notice>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--surface2)]/50 px-4 py-3">
          <Button as="a" variant="secondary" size="sm" href={profileHref(application)} target="_blank" rel="noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            View profile
          </Button>
          <div className="flex flex-wrap gap-1.5">
            {decisions.map(decision => (
              <Button
                key={decision.action}
                size="sm"
                variant={decision.variant}
                loading={busy === `${idOf(application)}:${decision.action}`}
                disabled={Boolean(busy)}
                onClick={() => onAct(application, decision.action)}
              >
                {busy === `${idOf(application)}:${decision.action}` ? null : <decision.icon className="h-3.5 w-3.5" />}
                {decision.label}
              </Button>
            ))}
          </div>
        </footer>
      </motion.div>
    </motion.div>
  );
}

export function AttachedPost({ post }) {
  const media = (post.mediaAssetIds || post.mediaAssets || []).find(asset => asset?.publicUrl) || null;
  const [broken, setBroken] = useState(false);

  return (
    <article className="flex gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-2.5">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface3)]">
        {media && !broken ? (
          media.mediaType === 'video' ? (
            <video src={media.publicUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" onError={() => setBroken(true)} />
          ) : (
            <img src={media.publicUrl} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            {broken ? <ImageOff className="h-4 w-4 text-[var(--muted)]" /> : <Camera className="h-4 w-4 text-[var(--muted)]" />}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <Badge tone="accent">{formatPlatform(post.platform)}</Badge>
          {post.providerPostUrl ? (
            <a
              href={post.providerPostUrl}
              target="_blank"
              rel="noreferrer"
              className="focus-ring rounded text-[var(--muted)] hover:text-[var(--accent)]"
              aria-label="Open the live post"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[var(--text-2)]">
          {post.caption || post.title || 'Published post'}
        </p>
        <p className="mt-0.5 text-[10px] text-[var(--muted)]">
          {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : 'Not dated'}
        </p>
      </div>
    </article>
  );
}
