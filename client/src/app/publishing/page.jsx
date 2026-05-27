'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Layers3,
  Loader2,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Send,
  XCircle
} from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { getUser } from '../../lib/auth';
import { formatDuration } from '../../lib/duration';
import { formatPlatform } from '../../lib/platforms';
import { canPublish } from '../../lib/roles';

const ACTIVE_STATUSES = ['queued', 'publishing', 'paused'];
const ATTENTION_STATUSES = ['failed', 'blocked', 'cancelled'];
const TERMINAL_STATUSES = ['published', 'failed', 'blocked', 'cancelled'];

const statusMeta = {
  queued: { label: 'Queued', tone: 'border-sky-400/30 bg-sky-400/10 text-sky-300', dot: 'bg-sky-300' },
  publishing: { label: 'Live', tone: 'border-mint/30 bg-mint/10 text-mint', dot: 'bg-mint' },
  paused: { label: 'Paused', tone: 'border-gold/30 bg-gold/10 text-gold', dot: 'bg-gold' },
  published: { label: 'Published', tone: 'border-mint/30 bg-mint/10 text-mint', dot: 'bg-mint' },
  failed: { label: 'Failed', tone: 'border-rose/30 bg-rose/10 text-rose', dot: 'bg-rose' },
  blocked: { label: 'Blocked', tone: 'border-gold/30 bg-gold/10 text-gold', dot: 'bg-gold' },
  cancelled: { label: 'Cancelled', tone: 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]', dot: 'bg-[var(--muted)]' },
  mixed: { label: 'Mixed', tone: 'border-blue-300/30 bg-blue-300/10 text-blue-200', dot: 'bg-blue-200' }
};

const groupFilters = [
  { id: 'active', label: 'Active' },
  { id: 'attention', label: 'Needs review' },
  { id: 'published', label: 'Published' },
  { id: 'all', label: 'All' }
];

const getTimestamp = value => {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const formatDateTime = value => {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not scheduled';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

const formatPercent = value => `${Math.max(0, Math.min(100, Math.round(value)))}%`;

const compactId = value => {
  if (!value) return 'Ungrouped';
  const text = String(value);
  return text.length > 14 ? text.slice(-12) : text;
};

const getJobAccount = job => job.accountSnapshot || job.platformConnectionId || {};

const getJobCaption = job => job.caption || job.variantId?.caption || '';

const getJobMedia = job => (job.mediaAssetIds || []).find(asset => asset?.publicUrl) || null;

const getJobStatusMeta = status => statusMeta[status] || statusMeta.mixed;

const getGroupStatus = jobs => {
  if (jobs.some(job => job.status === 'publishing')) return 'publishing';
  if (jobs.some(job => job.status === 'queued')) return 'queued';
  if (jobs.some(job => job.status === 'paused')) return 'paused';
  if (jobs.some(job => ATTENTION_STATUSES.includes(job.status))) return 'failed';
  if (jobs.length > 0 && jobs.every(job => job.status === 'published')) return 'published';
  return 'mixed';
};

const getAttentionCount = jobs => jobs.filter(job => ATTENTION_STATUSES.includes(job.status)).length;

const getActiveCount = jobs => jobs.filter(job => ACTIVE_STATUSES.includes(job.status)).length;

const getExpectedTargetCount = jobs => Math.max(1, ...jobs.map(job => Number(job.groupTargetCount) || 1), jobs.length);

const buildDispatchGroups = jobs => {
  const groups = new Map();

  for (const job of jobs) {
    const key = job.postGroupId || job._id;
    const existing = groups.get(key) || {
      id: key,
      jobs: []
    };
    existing.jobs.push(job);
    groups.set(key, existing);
  }

  return [...groups.values()]
    .map(group => {
      const sortedJobs = [...group.jobs].sort((a, b) => getTimestamp(a.scheduledAt) - getTimestamp(b.scheduledAt));
      const expectedTargetCount = getExpectedTargetCount(sortedJobs);
      const publishedCount = sortedJobs.filter(job => job.status === 'published').length;
      const terminalCount = sortedJobs.filter(job => TERMINAL_STATUSES.includes(job.status)).length;
      const activeCount = getActiveCount(sortedJobs);
      const attentionCount = getAttentionCount(sortedJobs);
      const groupStatus = getGroupStatus(sortedJobs);
      const latestUpdatedAt = sortedJobs
        .map(job => job.updatedAt || job.processingStageUpdatedAt || job.createdAt)
        .sort((a, b) => getTimestamp(b) - getTimestamp(a))[0];

      return {
        ...group,
        jobs: sortedJobs,
        expectedTargetCount,
        status: groupStatus,
        publishedCount,
        terminalCount,
        activeCount,
        attentionCount,
        scheduledAt: sortedJobs[0]?.scheduledAt,
        latestUpdatedAt,
        completionPercent: expectedTargetCount > 0 ? (terminalCount / expectedTargetCount) * 100 : 0,
        successPercent: expectedTargetCount > 0 ? (publishedCount / expectedTargetCount) * 100 : 0
      };
    })
    .sort((a, b) => {
      const aActive = a.activeCount > 0 ? 1 : 0;
      const bActive = b.activeCount > 0 ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      const aAttention = a.attentionCount > 0 ? 1 : 0;
      const bAttention = b.attentionCount > 0 ? 1 : 0;
      if (aAttention !== bAttention) return bAttention - aAttention;
      return getTimestamp(b.latestUpdatedAt || b.scheduledAt) - getTimestamp(a.latestUpdatedAt || a.scheduledAt);
    });
};

const filterGroup = (group, filter) => {
  if (filter === 'all') return true;
  if (filter === 'active') return group.activeCount > 0;
  if (filter === 'attention') return group.attentionCount > 0;
  if (filter === 'published') return group.jobs.length > 0 && group.jobs.every(job => job.status === 'published');
  return true;
};

const getGroupActionJobs = (group, action) => {
  if (action === 'pause') {
    return group.jobs.filter(job => ['queued', 'publishing'].includes(job.status) && !job.publishControl?.action);
  }
  if (action === 'resume') {
    return group.jobs.filter(job => job.status === 'paused');
  }
  if (action === 'cancel') {
    return group.jobs.filter(job => ['queued', 'publishing', 'paused'].includes(job.status) && job.publishControl?.action !== 'cancel_requested');
  }
  return [];
};

export default function PublishingPage() {
  const [user, setUser] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [message, setMessage] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [publishSettings, setPublishSettings] = useState({ temporaryMediaRetentionSeconds: 7 * 24 * 60 * 60 });
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = async () => {
    const [jobsPayload, settingsPayload] = await Promise.all([
      api.get('/api/publish/jobs'),
      api.get('/api/publish/settings')
    ]);
    setJobs(jobsPayload.data.publishJobs || []);
    setPublishSettings(settingsPayload.data.settings);
    setLastUpdated(new Date());
  };

  useEffect(() => {
    setUser(getUser());
    load().catch(err => setMessage(err.message));
    const socket = getSocket();
    const handler = () => load().catch(() => {});
    socket.on('publishing:job_updated', handler);
    return () => socket.off('publishing:job_updated', handler);
  }, []);

  const groups = useMemo(() => buildDispatchGroups(jobs), [jobs]);
  const visibleGroups = useMemo(
    () => groups.filter(group => filterGroup(group, activeFilter)),
    [groups, activeFilter]
  );
  const stats = useMemo(() => ({
    active: groups.filter(group => group.activeCount > 0).length,
    attention: groups.filter(group => group.attentionCount > 0).length,
    published: groups.filter(group => group.jobs.length > 0 && group.jobs.every(job => job.status === 'published')).length,
    platformJobs: jobs.length
  }), [groups, jobs.length]);
  const temporaryMediaRetentionLabel = formatDuration(publishSettings.temporaryMediaRetentionSeconds);
  const canManage = canPublish(user);

  const runJobAction = async ({ job, action, options = {} }) => {
    setBusyKey(`${action}:${job._id}`);
    setMessage('');
    try {
      if (action === 'retry') {
        await api.post(`/api/publish/jobs/${job._id}/retry`, options);
        setMessage('Platform job re-queued.');
      }
      if (action === 'pause') {
        await api.post(`/api/publish/jobs/${job._id}/pause`, {});
        setMessage(job.status === 'publishing' ? 'Pause requested for active upload.' : 'Platform job paused.');
      }
      if (action === 'resume') {
        await api.post(`/api/publish/jobs/${job._id}/resume`, {});
        setMessage('Platform job resumed.');
      }
      if (action === 'cancel') {
        await api.post(`/api/publish/jobs/${job._id}/cancel`, {});
        setMessage(job.status === 'publishing' ? 'Cancel requested for active upload.' : 'Platform job cancelled.');
      }
      await load();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusyKey('');
    }
  };

  const runGroupAction = async ({ group, action }) => {
    const actionJobs = getGroupActionJobs(group, action);
    if (actionJobs.length === 0) return;

    setBusyKey(`${action}:group:${group.id}`);
    setMessage('');
    try {
      await Promise.all(actionJobs.map(job => api.post(`/api/publish/jobs/${job._id}/${action}`, {})));
      setMessage(`${actionJobs.length} platform job${actionJobs.length === 1 ? '' : 's'} updated.`);
      await load();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusyKey('');
    }
  };

  return (
    <AppShell>
      <div className="space-y-5 pb-6">
        <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mint">Post operations</p>
            <h1 className="mt-2 text-3xl font-bold text-[var(--text)]">Post Dispatch</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusStat icon={Activity} label="Active" value={stats.active} tone="text-mint" />
            <StatusStat icon={AlertTriangle} label="Review" value={stats.attention} tone="text-gold" />
            <StatusStat icon={CheckCircle2} label="Done" value={stats.published} tone="text-mint" />
            <Link href="/compose" className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg bg-mint px-3 text-sm font-semibold text-[#05130d]">
              <Send size={16} />
              Compose
            </Link>
            <button
              type="button"
              onClick={() => load().catch(err => setMessage(err.message))}
              className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"
              title="Refresh"
              aria-label="Refresh dispatches"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </header>

        <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex gap-2 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
            {groupFilters.map(filter => {
              const active = activeFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveFilter(filter.id)}
                  className={`focus-ring h-9 shrink-0 rounded-md px-3 text-sm font-semibold transition ${
                    active ? 'bg-[var(--text)] text-[var(--bg)]' : 'text-[var(--muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)]'
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
          <div className="flex min-h-10 items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--muted)] lg:justify-end">
            <span>{stats.platformJobs} platform jobs</span>
            <span>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Connecting'}</span>
          </div>
        </section>

        {message && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--text)]">
            {message}
          </div>
        )}

        <div className="space-y-4">
          {visibleGroups.map(group => (
            <DispatchGroup
              key={group.id}
              group={group}
              canManage={canManage}
              busyKey={busyKey}
              retentionLabel={temporaryMediaRetentionLabel}
              onJobAction={runJobAction}
              onGroupAction={runGroupAction}
            />
          ))}
          {visibleGroups.length === 0 && (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-center">
              <Layers3 size={24} className="text-[var(--muted)]" />
              <p className="mt-3 text-sm font-semibold text-[var(--text)]">No dispatches here</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Try another status filter.</p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function StatusStat({ icon: Icon, label, value, tone }) {
  return (
    <div className="flex h-10 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3">
      <Icon size={15} className={tone} />
      <span className="text-xs font-medium text-[var(--muted)]">{label}</span>
      <span className="text-sm font-bold text-[var(--text)]">{value}</span>
    </div>
  );
}

function DispatchGroup({ group, canManage, busyKey, retentionLabel, onJobAction, onGroupAction }) {
  const meta = getJobStatusMeta(group.status);
  const pauseJobs = getGroupActionJobs(group, 'pause');
  const resumeJobs = getGroupActionJobs(group, 'resume');
  const cancelJobs = getGroupActionJobs(group, 'cancel');

  return (
    <article className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-semibold ${meta.tone}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </span>
            <span className="text-xs text-[var(--muted)]">{compactId(group.id)}</span>
            <span className="text-xs text-[var(--muted)]">{formatDateTime(group.scheduledAt)}</span>
          </div>
          <h2 className="mt-3 truncate text-base font-semibold text-[var(--text)]">Dispatch {compactId(group.id)}</h2>

          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-[var(--muted)]">
                <span>{group.terminalCount}/{group.expectedTargetCount} finished</span>
                <span>{group.publishedCount}/{group.expectedTargetCount} published</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--surface2)]">
                <div className="h-full rounded-full bg-mint" style={{ width: formatPercent(group.successPercent) }} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              {group.jobs.map(job => (
                <PlatformPill key={job._id} job={job} />
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 xl:items-end">
          <span className="text-xs text-[var(--muted)]">Updated {formatDateTime(group.latestUpdatedAt)}</span>
          {canManage && (pauseJobs.length > 0 || resumeJobs.length > 0 || cancelJobs.length > 0) && (
            <div className="flex flex-wrap gap-2 xl:justify-end">
              {pauseJobs.length > 0 && (
                <button
                  type="button"
                  onClick={() => onGroupAction({ group, action: 'pause' })}
                  disabled={busyKey === `pause:group:${group.id}`}
                  className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg border border-gold/40 px-3 text-xs font-semibold text-gold hover:bg-gold/10"
                >
                  <PauseCircle size={14} />
                  Pause {pauseJobs.length}
                </button>
              )}
              {resumeJobs.length > 0 && (
                <button
                  type="button"
                  onClick={() => onGroupAction({ group, action: 'resume' })}
                  disabled={busyKey === `resume:group:${group.id}`}
                  className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg bg-mint px-3 text-xs font-semibold text-[#05130d]"
                >
                  <PlayCircle size={14} />
                  Resume {resumeJobs.length}
                </button>
              )}
              {cancelJobs.length > 0 && (
                <button
                  type="button"
                  onClick={() => onGroupAction({ group, action: 'cancel' })}
                  disabled={busyKey === `cancel:group:${group.id}`}
                  className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg border border-rose/40 px-3 text-xs font-semibold text-rose hover:bg-rose/10"
                >
                  <XCircle size={14} />
                  Cancel {cancelJobs.length}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-[var(--border)]">
        {group.jobs.map(job => (
          <PlatformJobRow
            key={job._id}
            job={job}
            canManage={canManage}
            busyKey={busyKey}
            retentionLabel={retentionLabel}
            onJobAction={onJobAction}
          />
        ))}
      </div>
    </article>
  );
}

function MediaPreview({ media, compact = false, emptyLabel = 'No local media' }) {
  const wrapperClassName = compact
    ? 'h-20 min-h-20 w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface2)]'
    : 'aspect-video min-h-28 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface2)] xl:aspect-[4/5]';

  if (!media?.publicUrl) {
    return (
      <div className={`${wrapperClassName} flex items-center justify-center border-dashed px-2 text-center text-[11px] text-[var(--muted)]`}>
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className={wrapperClassName}>
      {media.mediaType === 'video' ? (
        <video src={media.publicUrl} className="h-full w-full object-cover" controls={!compact} muted={compact} playsInline preload="metadata" />
      ) : (
        <img src={media.publicUrl} alt={media.originalName || 'media'} className="h-full w-full object-cover" />
      )}
    </div>
  );
}

function PlatformPill({ job }) {
  const meta = getJobStatusMeta(job.status);
  return (
    <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2 text-xs font-semibold ${meta.tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {formatPlatform(job.platform)}
    </span>
  );
}

function PlatformJobRow({ job, canManage, busyKey, retentionLabel, onJobAction }) {
  const meta = getJobStatusMeta(job.status);
  const account = getJobAccount(job);
  const media = getJobMedia(job);
  const caption = getJobCaption(job);
  const temporaryMediaExpired = Boolean(job.temporaryMediaExpiredAt);
  const temporaryMediaExpiresAt = job.temporaryMediaExpiresAt ? new Date(job.temporaryMediaExpiresAt) : null;
  const controlAction = job.publishControl?.action || '';
  const canManageJob = canManage && !temporaryMediaExpired;
  const canPause = canManageJob && ['queued', 'publishing'].includes(job.status) && controlAction !== 'pause_requested' && controlAction !== 'cancel_requested';
  const canResume = canManageJob && job.status === 'paused';
  const canCancel = canManageJob && ['queued', 'publishing', 'paused', 'failed', 'blocked'].includes(job.status) && controlAction !== 'cancel_requested';
  const canRetry = canManageJob && ['failed', 'blocked'].includes(job.status);
  const canRetryWithCompression = canRetry && (
    job.errorCode === 'FILE_TOO_LARGE' ||
    /too large|size|limit/i.test(job.errorMessage || '')
  );
  const stageText = job.processingMessage || job.errorMessage || job.processingStage || job.status;
  const busy = action => busyKey === `${action}:${job._id}`;

  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 border-t border-[var(--border)] px-4 py-3 first:border-t-0 md:grid-cols-[104px_minmax(0,1fr)] xl:grid-cols-[104px_minmax(190px,0.85fr)_minmax(0,1.35fr)_minmax(210px,auto)] xl:items-center">
      <MediaPreview
        media={media}
        compact
        emptyLabel={job.status === 'published' ? 'Media cleared' : temporaryMediaExpired ? 'Media expired' : 'No local media'}
      />

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-semibold ${meta.tone}`}>
            {job.status === 'publishing' ? <Loader2 size={12} className="animate-spin" /> : <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />}
            {meta.label}
          </span>
          <span className="truncate text-sm font-semibold text-[var(--text)]">{formatPlatform(job.platform)}</span>
        </div>
        <p className="mt-1 truncate text-xs text-[var(--muted)]">
          {account.accountHandle || account.accountName || 'account'} · {job.visibility || 'public'}
        </p>
      </div>

      <div className="col-span-2 min-w-0 xl:col-span-1">
        <p className="line-clamp-2 text-sm font-semibold text-[var(--text)]">{caption || 'No caption saved for this platform.'}</p>
        <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">{stageText}</p>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
          <span className="inline-flex items-center gap-1">
            <Clock3 size={12} />
            {formatDateTime(job.scheduledAt)}
          </span>
          <span>{job.processingStage || job.status}</span>
          {controlAction && <span className="text-gold">{job.publishControl?.message || 'Control pending'}</span>}
          {temporaryMediaExpired && <span className="text-rose">Media expired after {retentionLabel}</span>}
          {!temporaryMediaExpired && temporaryMediaExpiresAt && (
            <span className="text-gold">Retry media until {temporaryMediaExpiresAt.toLocaleString()}</span>
          )}
        </div>
      </div>

      <div className="col-span-2 flex flex-wrap gap-2 xl:col-span-1 xl:justify-end">
        {job.providerPostUrl && (
          <a
            href={job.providerPostUrl}
            target="_blank"
            rel="noreferrer"
            className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-mint hover:bg-mint/10"
          >
            <ExternalLink size={14} />
            Open
          </a>
        )}
        {canPause && (
          <button
            type="button"
            onClick={() => onJobAction({ job, action: 'pause' })}
            disabled={busy('pause')}
            className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg border border-gold/40 px-3 text-xs font-semibold text-gold hover:bg-gold/10"
          >
            <PauseCircle size={14} />
            Pause
          </button>
        )}
        {canResume && (
          <button
            type="button"
            onClick={() => onJobAction({ job, action: 'resume' })}
            disabled={busy('resume')}
            className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg bg-mint px-3 text-xs font-semibold text-[#05130d]"
          >
            <PlayCircle size={14} />
            Resume
          </button>
        )}
        {canRetry && (
          <button
            type="button"
            onClick={() => onJobAction({ job, action: 'retry' })}
            disabled={busy('retry')}
            className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg bg-gold px-3 text-xs font-semibold text-[#05130d]"
          >
            <RotateCcw size={14} />
            Retry
          </button>
        )}
        {canRetryWithCompression && (
          <button
            type="button"
            onClick={() => onJobAction({ job, action: 'retry', options: { mediaProcessing: { compressOnOversize: true, compressBeforeUpload: true } } })}
            disabled={busy('retry')}
            className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg border border-mint/40 px-3 text-xs font-semibold text-mint hover:bg-mint/10"
          >
            <AlertTriangle size={14} />
            Compress
          </button>
        )}
        {canCancel && (
          <button
            type="button"
            onClick={() => onJobAction({ job, action: 'cancel' })}
            disabled={busy('cancel')}
            className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg border border-rose/40 px-3 text-xs font-semibold text-rose hover:bg-rose/10"
          >
            <XCircle size={14} />
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
