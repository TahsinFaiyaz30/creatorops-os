'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Applicant profile — GET /api/applications/:id/creator-profile
 *
 * Scoped to one application on purpose: a brand representative reaches this only
 * through a creator who applied to a circular that representative owns, and the
 * server enforces that. There is no creator directory to browse from here.
 *
 * Unlike the frozen numbers on the application card, everything below is
 * recomputed on load — so a brand comparing a shortlist a week later sees where
 * each creator stands now, next to what they applied with.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  UserCircle, MapPin, Link as LinkIcon, Star, ExternalLink, ThumbsUp, ThumbsDown,
  ListChecks, BarChart3, Eye, Heart, MessageSquare, Share2, Bookmark, ShieldCheck,
  Camera, ImageOff, Rss, ArrowRight, Users
} from 'lucide-react';

import AppShell from '../../../../components/layout/AppShell';
import { Badge, Button, EmptyState, Notice, Page, Section, Skeleton } from '../../../../components/ds';
import {
  MeanTiles, PlatformMeanChart, WindowTimeline, compactNumber
} from '../../../../components/circulars/ApplicantAnalytics';
import { api } from '../../../../lib/api';
import { formatPlatform } from '../../../../lib/platforms';

const EASE = [0.16, 1, 0.3, 1];

const STATUS_TONE = {
  submitted: 'neutral',
  viewed: 'accent',
  shortlisted: 'warning',
  accepted: 'success',
  rejected: 'danger',
  withdrawn: 'neutral'
};

const POST_METRICS = [
  { key: 'views', label: 'Views', icon: Eye },
  { key: 'likes', label: 'Likes', icon: Heart },
  { key: 'comments', label: 'Comments', icon: MessageSquare },
  { key: 'shares', label: 'Shares', icon: Share2 },
  { key: 'saves', label: 'Saves', icon: Bookmark }
];

export default function ApplicantProfilePage() {
  const params = useParams();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');

  const load = async () => {
    const payload = await api.get(`/api/applications/${params.id}/creator-profile`);
    setProfile(payload.data.profile);
  };

  useEffect(() => {
    /* Records the view and notifies the creator, then reloads so the status
       badge reflects it. A failed view record never blocks the page. */
    api
      .post(`/api/applications/${params.id}/view-profile`, {})
      .catch(() => {})
      .then(() => load())
      .catch(err => setError(err.message));
  }, [params.id]);

  const decide = async action => {
    setBusy(action);
    setError('');
    try {
      await api.post(`/api/applications/${params.id}/${action}`, {});
      setNotice(`Applicant ${action === 'shortlist' ? 'shortlisted' : `${action}ed`}.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  if (error && !profile) {
    return (
      <AppShell>
        <Page>
          <Notice tone="danger">{error}</Notice>
          <EmptyState
            icon={UserCircle}
            title="Profile unavailable"
            description="This profile is readable only by the brand representative who owns the circular this creator applied to."
          />
        </Page>
      </AppShell>
    );
  }

  if (!profile) {
    return (
      <AppShell>
        <Page>
          <Skeleton className="h-40" />
          <Skeleton className="h-28" />
          <Skeleton className="h-64" />
        </Page>
      </AppShell>
    );
  }

  const { creator, circular, application, meanStatistics, submittedMeanStatistics, posts, reviews } = profile;
  const visiblePosts = platformFilter ? posts.filter(post => post.platform === platformFilter) : posts;
  const postPlatforms = [...new Set(posts.map(post => post.platform))];

  /*
   * Read the attached pair out of `posts` rather than the application's raw
   * populated documents: those are plain PublishedPost records with no metrics
   * attached, so rendering them directly showed "no metrics synced" on posts
   * that do have them. Anything the list cannot account for still falls back to
   * the raw record so an attachment is never silently dropped.
   */
  const attachedFromList = posts.filter(post => post.isAttachedToApplication);
  const accountedFor = new Set(attachedFromList.map(post => String(post._id)));
  const attachedPosts = [
    ...attachedFromList,
    ...(application.selectedPostIds || []).filter(post => !accountedFor.has(String(post._id)))
  ];

  return (
    <AppShell>
      <Page>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        {notice ? <Notice tone="success">{notice}</Notice> : null}

        {/* Circular context — this page only exists relative to one application. */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)] px-3 py-2 text-[11px] text-[var(--text-2)]">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
          <span>
            Reviewing for <span className="font-semibold text-[var(--text)]">{circular.title}</span>
          </span>
          <ArrowRight className="h-3 w-3 text-[var(--muted)]" />
          <a
            href={`/brand-circulars/${circular._id}`}
            className="focus-ring rounded font-semibold text-[var(--accent)] hover:underline"
          >
            Back to circular
          </a>
        </div>

        <ProfileHero creator={creator} application={application} />

        <Section
          title="Platform accounts"
          description="The connected accounts behind this circular's required platforms. Open one to check the real profile."
        >
          <PlatformAccounts statistics={meanStatistics} />
        </Section>

        <Section
          title="Decision"
          description="Applies to this application only. The creator is notified either way."
        >
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" loading={busy === 'shortlist'} disabled={Boolean(busy)} onClick={() => decide('shortlist')}>
              {busy === 'shortlist' ? null : <ListChecks className="h-4 w-4" />}
              Shortlist
            </Button>
            <Button variant="primary" loading={busy === 'accept'} disabled={Boolean(busy)} onClick={() => decide('accept')}>
              {busy === 'accept' ? null : <ThumbsUp className="h-4 w-4" />}
              Accept
            </Button>
            <Button variant="danger" loading={busy === 'reject'} disabled={Boolean(busy)} onClick={() => decide('reject')}>
              {busy === 'reject' ? null : <ThumbsDown className="h-4 w-4" />}
              Reject
            </Button>
          </div>
        </Section>

        <Section
          title="Platform means, recomputed now"
          description={`Averaged across ${(meanStatistics.commonPlatforms || []).map(formatPlatform).join(', ') || 'the required platforms'} · last ${meanStatistics.windowDays} days`}
        >
          <div className="space-y-3">
            <MeanTiles statistics={meanStatistics} />
            {meanStatistics.unavailableMessage ? <Notice tone="warning">{meanStatistics.unavailableMessage}</Notice> : null}
            <div className="grid gap-3 lg:grid-cols-2">
              <PlatformMeanChart statistics={meanStatistics} />
              <div className="space-y-3">
                <WindowTimeline statistics={meanStatistics} />
                <MeanDelta now={meanStatistics} submitted={submittedMeanStatistics} />
              </div>
            </div>
          </div>
        </Section>

        <Section
          title="Attached to this application"
          description="The two posts the creator applied with."
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {attachedPosts.map(post => (
              <PostCard key={String(post._id)} post={post} highlighted />
            ))}
            {attachedPosts.length === 0 ? (
              <p className="text-[11px] text-[var(--muted)]">No posts were attached.</p>
            ) : null}
          </div>
        </Section>

        <Section
          title="Every published post"
          description={`${posts.length} published post${posts.length === 1 ? '' : 's'} across ${postPlatforms.length} platform${postPlatforms.length === 1 ? '' : 's'}`}
          actions={
            postPlatforms.length > 1 ? (
              <div className="flex flex-wrap gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface2)] p-0.5">
                <FilterPill active={!platformFilter} onClick={() => setPlatformFilter('')}>
                  All
                </FilterPill>
                {postPlatforms.map(platform => (
                  <FilterPill
                    key={platform}
                    active={platformFilter === platform}
                    onClick={() => setPlatformFilter(platform)}
                  >
                    {formatPlatform(platform)}
                  </FilterPill>
                ))}
              </div>
            ) : null
          }
        >
          {visiblePosts.length === 0 ? (
            <EmptyState
              icon={Rss}
              title="No published posts"
              description="Nothing has reached a platform from this creator's workspace yet."
            />
          ) : (
            <div className="grid gap-2 lg:grid-cols-2">
              {visiblePosts.map((post, index) => (
                <PostCard key={String(post._id)} post={post} index={index} highlighted={post.isAttachedToApplication} />
              ))}
            </div>
          )}
        </Section>

        <Section title="Collaboration history" description={`${reviews.length} review${reviews.length === 1 ? '' : 's'}`}>
          {reviews.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface2)] px-3 py-4 text-center text-xs text-[var(--muted)]">
              No reviews yet.
            </p>
          ) : (
            <div className="grid gap-2 lg:grid-cols-2">
              {reviews.map(review => (
                <article key={String(review._id)} className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-[var(--text)]">
                        {review.reviewerId?.name || 'Unknown reviewer'}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                        {review.reviewerId?.role?.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-[var(--text)]">
                      {review.rating} <Star className="h-3 w-3 fill-warning text-warning" />
                    </span>
                  </div>
                  {review.collaborationContext ? (
                    <p className="mt-1.5 inline-block rounded border border-[var(--accent-line)] bg-[var(--accent-soft)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--accent)]">
                      {review.collaborationContext}
                    </p>
                  ) : null}
                  <p className="mt-1.5 whitespace-pre-wrap text-[11px] leading-relaxed text-[var(--text-2)]">
                    {review.comment}
                  </p>
                </article>
              ))}
            </div>
          )}
        </Section>
      </Page>
    </AppShell>
  );
}

/* ── Hero ─────────────────────────────────────────────────────────────────── */

function ProfileHero({ creator, application }) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
      className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/75 shadow-[var(--shadow)] backdrop-blur-xl"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_100%_at_0%_0%,var(--accent-soft),transparent_60%)]"
      />
      <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface2)]">
          {creator.profile?.avatarUrl ? (
            <img src={creator.profile.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <UserCircle className="h-10 w-10 text-[var(--muted)]" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">{creator.name}</h1>
              <p className="mt-0.5 truncate text-xs text-[var(--muted)]">{creator.email}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={STATUS_TONE[application.status] || 'neutral'}>{application.status}</Badge>
              <span className="flex items-center gap-1 text-sm font-bold text-[var(--text)]">
                {creator.averageRating ? creator.averageRating.toFixed(1) : 'New'}
                <Star className="h-3.5 w-3.5 fill-warning text-warning" />
              </span>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[var(--muted)]">
            {creator.profile?.location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {creator.profile.location}
              </span>
            ) : null}
            <span>{creator.totalReviews || 0} collaborations</span>
            <span>Applied {new Date(application.createdAt).toLocaleDateString()}</span>
          </div>

          {creator.profile?.bio ? (
            <p className="mt-3 max-w-3xl text-xs leading-relaxed text-[var(--text-2)]">{creator.profile.bio}</p>
          ) : null}

          {creator.profile?.socialLinks?.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {creator.profile.socialLinks.map((link, index) => (
                <a
                  key={index}
                  href={link.startsWith('http') ? link : `https://${link}`}
                  target="_blank"
                  rel="noreferrer"
                  className="focus-ring inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface2)] px-2 py-1 text-[10px] font-semibold text-[var(--text-2)] hover:border-[var(--accent-line)] hover:text-[var(--accent)]"
                >
                  <LinkIcon className="h-2.5 w-2.5" />
                  {link.replace(/^https?:\/\//, '')}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </motion.header>
  );
}

/* ── Platform accounts ────────────────────────────────────────────────────── */

/*
 * One row per required platform, linking out to the creator's real profile so a
 * brand can verify the account rather than take the numbers on trust. Some
 * providers hand back nothing addressable — LinkedIn returns an opaque subject
 * id, TikTok an open_id when no username scope was granted — so those rows show
 * the handle without a link rather than a URL that would 404.
 */
function PlatformAccounts({ statistics }) {
  const platforms = statistics?.perPlatform || [];

  if (platforms.length === 0) {
    return <p className="text-[11px] text-[var(--muted)]">This circular does not name any platform.</p>;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {platforms.map((platform, index) => (
        <motion.div
          key={platform.platform}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE, delay: Math.min(index, 8) * 0.04 }}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <Badge tone="accent">{platform.label || formatPlatform(platform.platform)}</Badge>
            <span className="flex items-center gap-1 text-[10px] font-semibold tabular-nums text-[var(--text-2)]">
              <Users className="h-2.5 w-2.5 text-[var(--muted)]" />
              {typeof platform.followers === 'number' ? compactNumber(platform.followers) : '—'}
            </span>
          </div>

          <div className="mt-2 space-y-1.5">
            {(platform.accounts || []).map((account, accountIndex) => {
              const handle = account.accountHandle || account.accountName || 'Connected account';
              return (
                <div key={`${account.accountHandle}-${accountIndex}`} className="min-w-0">
                  {account.profileUrl ? (
                    <a
                      href={account.profileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="focus-ring group flex items-center gap-1.5 rounded text-xs font-semibold text-[var(--accent)] hover:underline"
                    >
                      <span className="truncate">{handle}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 opacity-70 transition-opacity group-hover:opacity-100" />
                    </a>
                  ) : (
                    <p className="truncate text-xs font-semibold text-[var(--text-2)]" title={handle}>
                      {handle}
                    </p>
                  )}
                  <p className="truncate text-[10px] text-[var(--muted)]">
                    {account.accountName}
                    {account.accountType ? ` · ${account.accountType}` : ''}
                    {account.status && account.status !== 'connected' ? ` · ${account.status.replace(/_/g, ' ')}` : ''}
                    {account.profileUrl ? '' : ' · no public link'}
                  </p>
                </div>
              );
            })}

            {(platform.accounts || []).length === 0 ? (
              <p className="text-[11px] text-[var(--muted)]">
                No connected account — the posts on this platform predate the current connection.
              </p>
            ) : null}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ── Submitted vs. now ────────────────────────────────────────────────────── */

function MeanDelta({ now, submitted }) {
  const submittedMean = submitted?.mean;
  if (!submittedMean) {
    return (
      <p className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-[10px] leading-relaxed text-[var(--muted)]">
        This application carries no submitted-time means to compare against.
      </p>
    );
  }

  const rows = [
    { key: 'followers', label: 'Followers mean' },
    { key: 'views', label: 'Views mean' },
    { key: 'engagement', label: 'Engagement mean' }
  ];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface2)]/60 p-3">
      <h4 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        <BarChart3 className="h-3 w-3" />
        At application vs. now
      </h4>
      <div className="mt-2 space-y-1.5">
        {rows.map(row => {
          const then = submittedMean[row.key];
          const current = now?.mean?.[row.key];
          const comparable = typeof then === 'number' && typeof current === 'number';
          const delta = comparable ? current - then : null;
          return (
            <div key={row.key} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-[var(--muted)]">{row.label}</span>
              <span className="flex items-center gap-1.5 tabular-nums">
                <span className="text-[var(--text-2)]">{compactNumber(then)}</span>
                <ArrowRight className="h-2.5 w-2.5 text-[var(--muted)]" />
                <span className="font-bold text-[var(--text)]">{compactNumber(current)}</span>
                {delta !== null && delta !== 0 ? (
                  <span className={`font-bold ${delta > 0 ? 'text-success' : 'text-danger'}`}>
                    {delta > 0 ? '+' : ''}
                    {compactNumber(delta)}
                  </span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Post card ────────────────────────────────────────────────────────────── */

function FilterPill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`focus-ring relative rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${
        active ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
      }`}
    >
      {active ? (
        <motion.span
          layoutId="applicant-posts-filter"
          className="absolute inset-0 rounded-md bg-[var(--accent-soft)]"
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        />
      ) : null}
      <span className="relative">{children}</span>
    </button>
  );
}

function PostCard({ post, index = 0, highlighted = false }) {
  const media = (post.mediaAssets || post.mediaAssetIds || []).find(asset => asset?.publicUrl) || null;
  const [broken, setBroken] = useState(false);

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE, delay: Math.min(index, 8) * 0.03 }}
      className={`flex gap-3 rounded-xl border p-3 ${
        highlighted ? 'border-[var(--accent-line)] bg-[var(--accent-soft)]' : 'border-[var(--border)] bg-[var(--surface2)]'
      }`}
    >
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
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="accent">{formatPlatform(post.platform)}</Badge>
            {highlighted ? <Badge tone="success">attached</Badge> : null}
          </div>
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
          {post.accountSnapshot?.accountName ? ` · ${post.accountSnapshot.accountName}` : ''}
        </p>

        {post.metrics ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {POST_METRICS.map(metric => (
              <span
                key={metric.key}
                className="inline-flex items-center gap-1 rounded-md bg-[var(--surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-2)]"
              >
                <metric.icon className="h-2.5 w-2.5 text-[var(--muted)]" />
                <span className="font-semibold tabular-nums">{compactNumber(post.metrics[metric.key])}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[10px] text-[var(--muted)]">No metrics synced for this post yet.</p>
        )}
      </div>
    </motion.article>
  );
}
