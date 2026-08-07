'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Brand representative dashboard.
 *
 * A brand rep does not run campaigns, publish, or manage a team — so the creator
 * dashboard showed them a screen of zeroes. What they actually do all day is read
 * applications and decide on them, so that is what this is: the decision queue
 * first, with a glance at how their own posts are doing underneath.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  ClipboardList, Inbox, ListChecks, ThumbsUp, ThumbsDown, BriefcaseBusiness,
  ArrowUpRight, Eye, Heart, Rss, UserCircle, Clock3
} from 'lucide-react';

import { Badge, Button, EmptyState, Page, Section, Skeleton, GlareStat, GlareStatGrid, GLARE_TINTS } from '../ds';
import { api } from '../../lib/api';
import { formatPlatform } from '../../lib/platforms';
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

const compact = value => {
  const n = Number(value) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
};

export default function BrandDashboard({ user }) {
  const [applications, setApplications] = useState(null);
  const [circulars, setCirculars] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useToastState('danger');

  useEffect(() => {
    Promise.allSettled([
      api.get('/api/applications'),
      api.get('/api/brand-circulars'),
      api.get('/api/social/analytics/summary')
    ]).then(([apps, circs, stats]) => {
      if (apps.status === 'rejected') setError(apps.reason?.message || 'Could not load applications.');
      setApplications(apps.value?.data?.applications || []);
      setCirculars(circs.value?.data?.circulars || []);
      setSummary(stats.value?.data?.summary || null);
    });
  }, []);

  const counts = useMemo(() => {
    const list = applications || [];
    return {
      total: list.length,
      pending: list.filter(a => ['submitted', 'viewed'].includes(a.status)).length,
      shortlisted: list.filter(a => a.status === 'shortlisted').length,
      accepted: list.filter(a => a.status === 'accepted').length,
      rejected: list.filter(a => a.status === 'rejected').length
    };
  }, [applications]);

  const needsDecision = useMemo(
    () => (applications || []).filter(a => ['submitted', 'viewed'].includes(a.status)).slice(0, 6),
    [applications]
  );

  const openCirculars = circulars.filter(c => c.status === 'published');
  const engagement = summary
    ? (summary.totals?.likes || 0) + (summary.totals?.comments || 0) + (summary.totals?.shares || 0)
    : 0;

  return (
    <Page>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Brand</p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
            {user?.name ? `Welcome back, ${user.name.split(' ')[0]}` : 'Dashboard'}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
            Who applied to your circulars, what you have decided, and how your own posts are doing.
          </p>
        </div>
        <Button as="a" href="/brand-circulars/create" variant="primary" className="shrink-0">
          <BriefcaseBusiness className="h-4 w-4" />
          New circular
        </Button>
      </div>


      <GlareStatGrid>
        <GlareStat label="Awaiting you" value={counts.pending} icon={Inbox} tint={GLARE_TINTS[0]} hint="Undecided applications" />
        <GlareStat label="Shortlisted" value={counts.shortlisted} icon={ListChecks} tint={GLARE_TINTS[2]} />
        <GlareStat label="Accepted" value={counts.accepted} icon={ThumbsUp} tint={GLARE_TINTS[3]} />
        <GlareStat label="Rejected" value={counts.rejected} icon={ThumbsDown} tint={GLARE_TINTS[4]} />
        <GlareStat label="Open circulars" value={openCirculars.length} icon={BriefcaseBusiness} tint={GLARE_TINTS[1]} hint={`${circulars.length} total`} />
      </GlareStatGrid>

      <Section
        title="Waiting on your decision"
        description={counts.pending ? `${counts.pending} undecided` : undefined}
        actions={
          <Button as="a" href="/applications" size="sm" variant="ghost">
            All applications
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        }
      >
        {!applications ? (
          <div className="grid gap-2 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <Skeleton key={index} className="h-28" />
            ))}
          </div>
        ) : needsDecision.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={counts.total ? 'Everything is decided' : 'No applications yet'}
            description={
              counts.total
                ? 'Every application on your circulars has been shortlisted, accepted or rejected.'
                : 'Publish a circular and creators who cover its platforms can apply with real synced statistics.'
            }
            action={
              counts.total ? null : (
                <Button as="a" href="/brand-circulars/create" size="sm" variant="primary">
                  Create a circular
                </Button>
              )
            }
          />
        ) : (
          <div className="grid gap-2 lg:grid-cols-2">
            {needsDecision.map((application, index) => (
              <ApplicationRow key={application._id} application={application} index={index} />
            ))}
          </div>
        )}
      </Section>

      {/* A glance, not the analytics page. */}
      <Section
        title="Your posts at a glance"
        description="Synced from your own connected accounts."
        actions={
          <Button as="a" href="/analytics" size="sm" variant="ghost">
            Full analytics
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        }
      >
        {!summary ? (
          <Skeleton className="h-24" />
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat label="Published posts" value={summary.totalPublishedPosts ?? 0} icon={Rss} />
            <MiniStat label="Views" value={compact(summary.totals?.views)} icon={Eye} />
            <MiniStat label="Engagements" value={compact(engagement)} icon={Heart} hint="Likes, comments, shares" />
            <MiniStat label="Metric reads" value={summary.totalMetricSnapshots ?? 0} icon={Clock3} hint="Real API syncs" />
          </div>
        )}

        {summary?.unavailableMessage ? (
          <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">{summary.unavailableMessage}</p>
        ) : null}
      </Section>
    </Page>
  );
}

function MiniStat({ label, value, icon: Icon, hint }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 px-3 py-2.5 backdrop-blur-xl">
      <span className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        <Icon className="h-3 w-3" />
        {label}
      </span>
      <p className="mt-1 text-xl font-bold tabular-nums tracking-tight text-[var(--text)]">{value}</p>
      {hint ? <p className="truncate text-[10px] text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

function ApplicationRow({ application, index }) {
  const mean = application.meanStatsSnapshot?.mean || {};
  const creator = application.creatorId || {};

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE, delay: Math.min(index, 6) * 0.04 }}
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/75 p-3 backdrop-blur-xl"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface2)]">
            {creator.profile?.avatarUrl ? (
              <img src={creator.profile.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <UserCircle className="h-5 w-5 text-[var(--muted)]" />
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[var(--text)]">{creator.name || 'Creator'}</p>
            <p className="truncate text-[11px] text-[var(--muted)]">
              {application.circularId?.title || 'A circular'}
            </p>
          </div>
        </div>
        <Badge tone={STATUS_TONE[application.status] || 'neutral'}>{application.status}</Badge>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
        <span>
          <span className="font-semibold text-[var(--text-2)]">
            {mean.followers === null || mean.followers === undefined ? '—' : compact(mean.followers)}
          </span>{' '}
          followers mean
        </span>
        <span>
          <span className="font-semibold text-[var(--text-2)]">{compact(mean.views)}</span> views mean
        </span>
        {(application.commonPlatforms || []).slice(0, 3).map(platform => (
          <span key={platform} className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px]">
            {formatPlatform(platform)}
          </span>
        ))}
      </div>

      <div className="mt-2.5 flex gap-1.5 border-t border-[var(--border)] pt-2.5">
        <Button
          as={Link}
          href={`/applications/${application._id}/creator`}
          size="sm"
          variant="secondary"
          target="_blank"
        >
          View profile
        </Button>
        <Button as="a" href={`/brand-circulars/${application.circularId?._id || ''}`} size="sm" variant="ghost">
          Review on circular
          <ArrowUpRight className="h-3 w-3" />
        </Button>
      </div>
    </motion.article>
  );
}
