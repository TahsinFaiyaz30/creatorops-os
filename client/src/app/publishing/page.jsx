'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Cloud,
  ExternalLink,
  Layers3,
  Loader2,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  TimerReset,
  Trash2,
  UploadCloud,
  XCircle
} from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { getUser } from '../../lib/auth';
import { formatDuration } from '../../lib/duration';
import { formatPlatform } from '../../lib/platforms';
import { canPublish } from '../../lib/roles';
import {
  cancelUploadSession,
  deletePendingPublish,
  deleteUploadFile,
  getUploadFile,
  getUploadSession,
  getPendingPublishes,
  mergePendingPublishRecords,
  pauseUploadSession,
  putPendingPublish,
  runWithUploadWorkerLock,
  subscribeUploadStateChanges,
  uploadFileResumable
} from '../../lib/resumableUploads';

const ACTIVE_STATUSES = ['queued', 'publishing', 'paused'];
const ATTENTION_STATUSES = ['failed', 'blocked', 'cancelled'];
const TERMINAL_STATUSES = ['published', 'failed', 'blocked', 'cancelled'];
const PROCESSING_STAGES = [
  'starting',
  'checking_connection',
  'loading_media',
  'checking_media_policy',
  'compressing',
  'uploading',
  'uploading_compressed',
  'initializing_provider_upload',
  'provider_ingesting',
  'provider_uploaded',
  'queued_retry',
  'queued_resume'
];

const statusMeta = {
  waiting_upload: { label: 'Waiting', tone: 'border-sky-400/30 bg-sky-400/10 text-sky-300', dot: 'bg-sky-300' },
  uploading_client: { label: 'Cloud upload', tone: 'border-mint/30 bg-mint/10 text-mint', dot: 'bg-mint' },
  paused_upload: { label: 'Paused', tone: 'border-gold/30 bg-gold/10 text-gold', dot: 'bg-gold' },
  interrupted_upload: { label: 'Interrupted', tone: 'border-gold/30 bg-gold/10 text-gold', dot: 'bg-gold' },
  failed_upload: { label: 'Failed', tone: 'border-rose/30 bg-rose/10 text-rose', dot: 'bg-rose' },
  verifying_upload: { label: 'Verifying cloud', tone: 'border-blue-300/30 bg-blue-300/10 text-blue-200', dot: 'bg-blue-200' },
  queued: { label: 'Queued', tone: 'border-sky-400/30 bg-sky-400/10 text-sky-300', dot: 'bg-sky-300' },
  publishing: { label: 'Processing', tone: 'border-mint/30 bg-mint/10 text-mint', dot: 'bg-mint' },
  paused: { label: 'Paused', tone: 'border-gold/30 bg-gold/10 text-gold', dot: 'bg-gold' },
  published: { label: 'Published', tone: 'border-mint/30 bg-mint/10 text-mint', dot: 'bg-mint' },
  failed: { label: 'Failed', tone: 'border-rose/30 bg-rose/10 text-rose', dot: 'bg-rose' },
  blocked: { label: 'Blocked', tone: 'border-gold/30 bg-gold/10 text-gold', dot: 'bg-gold' },
  cancelled: { label: 'Cancelled', tone: 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]', dot: 'bg-[var(--muted)]' },
  expired: { label: 'Expired', tone: 'border-rose/30 bg-rose/10 text-rose', dot: 'bg-rose' },
  mixed: { label: 'Mixed', tone: 'border-blue-300/30 bg-blue-300/10 text-blue-200', dot: 'bg-blue-200' }
};

const dispatchFilters = [
  { id: 'all', label: 'All' },
  { id: 'uploading', label: 'Uploading' },
  { id: 'queued', label: 'Queued' },
  { id: 'processing', label: 'Processing' },
  { id: 'paused', label: 'Paused' },
  { id: 'review', label: 'Review' },
  { id: 'published', label: 'Published' },
  { id: 'expired', label: 'Expired' }
];

const PLATFORM_DELETE_SUPPORTED = new Set(['youtube', 'youtube_shorts', 'facebook', 'x', 'pinterest', 'wordpress', 'shopify']);

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

const clampPercent = value => Math.max(0, Math.min(100, Number(value) || 0));

const formatBytes = bytes => {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${unitIndex === 0 ? Math.round(size) : size.toFixed(2)} ${units[unitIndex]}`;
};

const formatThroughput = bytesPerSecond => {
  const value = Number(bytesPerSecond || 0);
  if (!Number.isFinite(value) || value <= 0) return '';
  return `${formatBytes(value)}/s`;
};

const compactId = value => {
  if (!value) return 'Ungrouped';
  const text = String(value);
  return text.length > 14 ? text.slice(-12) : text;
};

const normalizeText = value => String(value || '').toLowerCase();

const getJobAccount = job => job.accountSnapshot || job.platformConnectionId || {};

const getJobCaption = job => job.caption || job.variantId?.caption || '';

const getJobMedia = job => (job.mediaAssetIds || []).find(asset => asset?.publicUrl) || null;

const getJobStatusMeta = status => statusMeta[status] || statusMeta.mixed;

const stageLabels = {
  queued_now: 'Queued for immediate publish',
  scheduled: 'Scheduled',
  starting: 'Starting platform dispatch',
  checking_connection: 'Checking platform connection',
  loading_media: 'Loading verified cloud media',
  checking_media_policy: 'Checking provider media limits',
  compressing: 'Compressing media for provider',
  uploading_compressed: 'Uploading compressed cloud copy',
  initializing_provider_upload: 'Starting provider upload',
  uploading: 'Uploading to platform',
  provider_ingesting: 'Provider is ingesting media',
  provider_uploaded: 'Provider accepted media',
  provider_rejected: 'Provider rejected media',
  queued_retry: 'Retry queued',
  queued_resume: 'Resume queued',
  interrupted: 'Interrupted',
  provider_unreachable: 'Provider unreachable',
  published: 'Published',
  failed: 'Failed',
  blocked: 'Blocked',
  paused: 'Paused',
  cancelled: 'Cancelled'
};

const getJobStageLabel = job => {
  const controlAction = job.publishControl?.action || '';
  if (controlAction === 'pause_requested') return 'Pause requested';
  if (controlAction === 'cancel_requested') return 'Cancel requested';
  if (job.temporaryMediaExpiredAt) return 'Temporary cloud media expired';
  return stageLabels[job.processingStage] || stageLabels[job.status] || job.processingStage || job.status || 'Waiting';
};

const getProviderPhaseLabel = phase => {
  if (phase === 'initializing') return 'Starting provider upload';
  if (phase === 'uploading') return 'Uploading to platform';
  if (phase === 'provider_ingest') return 'Provider ingesting media';
  if (phase === 'provider_ingest_complete') return 'Provider accepted media';
  if (phase === 'uploaded') return 'Provider upload complete';
  return 'Platform media transfer';
};

const getProviderUploadProgress = job => {
  const upload = job.providerUpload || {};
  const hasStructuredProgress = upload.phase || Number(upload.totalBytes) > 0 || Number(upload.percent) > 0;
  if (hasStructuredProgress) {
    const totalBytes = Number(upload.totalBytes || 0);
    const bytesUploaded = Number(upload.bytesUploaded || 0);
    const percent = totalBytes > 0
      ? clampPercent((Math.max(bytesUploaded, 0) / totalBytes) * 100)
      : clampPercent(upload.percent);
    return {
      active: ['initializing', 'uploading', 'provider_ingest'].includes(upload.phase) || job.processingStage === 'uploading' || job.processingStage === 'provider_ingesting',
      complete: ['uploaded', 'provider_ingest_complete'].includes(upload.phase) || job.processingStage === 'provider_uploaded',
      phase: upload.phase || job.processingStage || '',
      bytesUploaded,
      totalBytes,
      percent,
      bytesPerSecond: Number(upload.bytesPerSecond || 0),
      message: upload.message || job.processingMessage || ''
    };
  }

  const match = String(job.processingMessage || '').match(/(\d+(?:\.\d+)?)%\s+complete/i);
  if (!match) return null;
  return {
    active: job.status === 'publishing',
    complete: Number(match[1]) >= 100,
    phase: job.processingStage || 'uploading',
    bytesUploaded: 0,
    totalBytes: 0,
    percent: clampPercent(Number(match[1])),
    bytesPerSecond: 0,
    message: job.processingMessage || ''
  };
};

const isProcessingJob = job =>
  job.status === 'publishing' ||
  PROCESSING_STAGES.includes(job.processingStage || '') ||
  Boolean(job.processingStage && job.status === 'queued' && ['queued_retry', 'queued_resume'].includes(job.processingStage));

const getGroupStatus = jobs => {
  if (jobs.some(job => job.temporaryMediaExpiredAt)) return 'expired';
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
      const queuedCount = sortedJobs.filter(job => job.status === 'queued').length;
      const processingCount = sortedJobs.filter(isProcessingJob).length;
      const pausedCount = sortedJobs.filter(job => job.status === 'paused').length;
      const expiredCount = sortedJobs.filter(job => job.temporaryMediaExpiredAt).length;
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
        queuedCount,
        processingCount,
        pausedCount,
        expiredCount,
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

const pendingMediaItems = pending => Array.isArray(pending?.mediaItems) ? pending.mediaItems : [];

const isPendingItemCloudReady = item => Boolean(item?.mediaAssetId);

const getPendingItemVerifiedBytes = item => {
  const size = Number(item?.size || 0);
  const bytesUploaded = Number(item?.bytesUploaded || 0);
  return Math.max(bytesUploaded, isPendingItemCloudReady(item) ? size : 0);
};

const getPendingItemDisplayBytes = item => {
  const verifiedBytes = getPendingItemVerifiedBytes(item);
  if (item?.status !== 'uploading') return verifiedBytes;
  const size = Number(item?.size || 0);
  return Math.min(size || Number.MAX_SAFE_INTEGER, Math.max(verifiedBytes, Number(item?.bytesSent || 0)));
};

const isPendingItemAtCloudSize = item => {
  const size = Number(item?.size || 0);
  return size > 0 && getPendingItemVerifiedBytes(item) >= size;
};

const isPendingItemSentToCloudSize = item => {
  const size = Number(item?.size || 0);
  return size > 0 && getPendingItemDisplayBytes(item) >= size;
};

const getSessionMediaAsset = session => session?.mediaAsset || null;

const getSessionMediaAssetId = session => {
  const mediaAsset = getSessionMediaAsset(session);
  return mediaAsset?._id || mediaAsset?.id || '';
};

const applyUploadSessionToPendingItem = (item, session, { forceSpeedZero = true } = {}) => {
  if (!session) return '';
  item.sessionId = session._id || item.sessionId || '';
  const verifiedBytes = Number(session.verifiedBytesReceived ?? session.bytesReceived ?? 0);
  const sentBytes = Number(session.bytesSent ?? verifiedBytes);
  item.bytesUploaded = verifiedBytes;
  item.bytesSent = session.status === 'uploading'
    ? Math.max(Number(item.bytesSent || 0), sentBytes, verifiedBytes)
    : verifiedBytes;
  item.status = session.status || item.status || 'waiting';
  item.failureReason = session.failureReason || item.failureReason || '';
  if (forceSpeedZero) item.uploadSpeedBytesPerSecond = 0;
  const mediaAssetId = getSessionMediaAssetId(session);
  if (mediaAssetId) {
    item.mediaAssetId = mediaAssetId;
    item.bytesUploaded = Number(item.size || session.size || item.bytesUploaded || 0);
    item.bytesSent = item.bytesUploaded;
    item.status = 'completed';
    item.failureReason = '';
  }
  return mediaAssetId;
};

const targetCountForPending = pending => (pending.selectedConnections || []).length;

const acceptedTargetCountForPending = pending =>
  new Set((pending.results || []).filter(result => result.jobId).map(result => result.targetKey)).size;

const isPendingFullyHandedOff = pending => {
  const targetCount = targetCountForPending(pending);
  return targetCount > 0 && acceptedTargetCountForPending(pending) >= targetCount;
};

const getPendingProgress = pending => {
  const items = pendingMediaItems(pending);
  const totalBytes = items.reduce((sum, item) => sum + Number(item.size || 0), 0);
  const uploadedBytes = items.reduce((sum, item) => sum + getPendingItemDisplayBytes(item), 0);
  const completedCount = items.filter(isPendingItemCloudReady).length;
  const pendingItems = items.filter(item => !isPendingItemCloudReady(item));
  const statuses = new Set(pendingItems.map(item => item.status || 'waiting'));
  const hasFullSizeUnverifiedItem = pendingItems.some(item =>
    item.sessionId && (isPendingItemAtCloudSize(item) || isPendingItemSentToCloudSize(item))
  );
  const hasCreatedJobs = (pending.results || []).some(result => result.jobId);
  const hasTargetFailure = (pending.results || []).some(result =>
    !result.jobId && (result.ok === false || ['blocked', 'failed'].includes(result.status))
  );
  const bytesPerSecond = pendingItems.reduce((sum, item) => sum + Number(item.uploadSpeedBytesPerSecond || 0), 0);

  let status = 'waiting_upload';
  if (statuses.has('failed') || hasTargetFailure) status = 'failed_upload';
  else if (hasFullSizeUnverifiedItem) status = 'verifying_upload';
  else if (pending.pauseReason === 'user' || statuses.has('paused')) status = 'paused_upload';
  else if (statuses.has('uploading')) status = 'uploading_client';
  else if (statuses.has('interrupted')) status = 'interrupted_upload';
  else if (items.length > 0 && completedCount === items.length) status = hasCreatedJobs ? 'verifying_upload' : 'verifying_upload';

  return {
    totalBytes,
    uploadedBytes,
    completedCount,
    totalCount: items.length,
    percent: totalBytes > 0 ? (uploadedBytes / totalBytes) * 100 : completedCount === items.length ? 100 : 0,
    bytesPerSecond,
    status,
    hasCreatedJobs,
    active: ['waiting_upload', 'uploading_client', 'interrupted_upload', 'paused_upload', 'verifying_upload'].includes(status),
    attention: ['failed_upload', 'interrupted_upload'].includes(status) || hasTargetFailure
  };
};

const pendingMatchesFilter = (pending, filter) => {
  const progress = getPendingProgress(pending);
  if (filter === 'all') return true;
  if (filter === 'uploading') return ['waiting_upload', 'uploading_client', 'interrupted_upload', 'verifying_upload'].includes(progress.status);
  if (filter === 'paused') return progress.status === 'paused_upload';
  if (filter === 'review') return progress.attention;
  return false;
};

const groupMatchesFilter = (group, filter) => {
  if (filter === 'all') return true;
  if (filter === 'queued') return group.queuedCount > 0;
  if (filter === 'processing') return group.processingCount > 0;
  if (filter === 'paused') return group.pausedCount > 0;
  if (filter === 'review') return group.attentionCount > 0;
  if (filter === 'published') return group.jobs.length > 0 && group.jobs.every(job => job.status === 'published');
  if (filter === 'expired') return group.expiredCount > 0;
  return false;
};

const groupMatchesSearch = (group, query) => {
  if (!query) return true;
  return group.jobs.some(job => {
    const account = getJobAccount(job);
    return [
      group.id,
      job._id,
      job.platform,
      account.accountHandle,
      account.accountName,
      getJobCaption(job),
      job.processingStage,
      job.processingMessage,
      job.errorMessage
    ].some(value => normalizeText(value).includes(query));
  });
};

const pendingMatchesSearch = (pending, query) => {
  if (!query) return true;
  const connectionText = (pending.selectedConnections || [])
    .map(connection => [connection.platform, connection.accountHandle, connection.targetKey].filter(Boolean).join(' '))
    .join(' ');
  const mediaText = pendingMediaItems(pending)
    .map(item => [item.originalName, item.mimeType, item.mediaType, item.status].filter(Boolean).join(' '))
    .join(' ');
  return [
    pending.id,
    pending.postGroupId,
    pending.baseCaption,
    pending.mode,
    connectionText,
    mediaText
  ].some(value => normalizeText(value).includes(query));
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

const getPlatformDeleteSupport = job => {
  if (!job.providerPostId) {
    return { supported: false, reason: 'No platform post id is saved for this row.' };
  }
  const connectionDeleteCapability = job.platformConnectionId?.capabilities?.delete;
  const supported = connectionDeleteCapability === true || PLATFORM_DELETE_SUPPORTED.has(job.platform);
  return supported
    ? { supported: true, reason: 'Provider delete API is available for this platform connector.' }
    : { supported: false, reason: `${formatPlatform(job.platform)} delete API is not supported by this connector yet.` };
};

const buildInitialDeleteModes = jobs =>
  Object.fromEntries(jobs.map(job => [String(job._id), 'local']));

const getConnectionTargetKey = connection =>
  connection.targetKey || `${connection.platformConnectionId || connection._id || 'connection'}:${connection.platform || 'platform'}`;

const describePublishJob = publishJob => {
  if (!publishJob) return 'No publish job returned.';
  if (publishJob.status === 'published') {
    return publishJob.providerPostUrl ? `Published: ${publishJob.providerPostUrl}` : 'Published through the connected platform API.';
  }
  if (publishJob.status === 'blocked' || publishJob.status === 'failed') {
    return publishJob.errorMessage || `Job ${publishJob.status}.`;
  }
  return `Job ${publishJob.status}.`;
};

const markPendingInterrupted = pending => {
  pending.pauseReason = '';
  pending.mediaItems = pendingMediaItems(pending).map(item =>
    item.mediaAssetId || item.status === 'completed'
      ? item
      : {
          ...item,
          status: item.sessionId ? 'interrupted' : 'waiting'
        }
  );
};

const isShaMismatchUploadError = error => String(error?.message || '').toLowerCase().includes('sha-256');

const isUploadPausedError = error => error?.code === 'UPLOAD_PAUSED' || String(error?.message || '').toLowerCase() === 'upload paused.';

const isMissingUploadFileError = error => error?.code === 'UPLOAD_FILE_UNAVAILABLE';

const isUploadSessionFailedError = error => error?.code === 'UPLOAD_SESSION_FAILED';

const shouldAutoResumePending = pending => {
  if (!pending || pending.pauseReason === 'user') return false;
  if (isPendingFullyHandedOff(pending)) return false;
  const needsReview = (pending.results || []).some(result => !result.jobId && (result.ok === false || ['blocked', 'failed'].includes(result.status)));
  if (needsReview) return false;
  const progress = getPendingProgress(pending);
  return ['waiting_upload', 'uploading_client', 'interrupted_upload', 'verifying_upload'].includes(progress.status);
};

const upsertTargetResult = (results, nextResult) => {
  const existingIndex = results.findIndex(result => result.targetKey === nextResult.targetKey);
  if (existingIndex === -1) return [...results, nextResult];
  const nextResults = [...results];
  nextResults[existingIndex] = {
    ...results[existingIndex],
    ...nextResult
  };
  return nextResults;
};

export default function PublishingPage() {
  const [user, setUser] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [pendingUploads, setPendingUploads] = useState([]);
  const [pendingUploadError, setPendingUploadError] = useState('');
  const [message, setMessage] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [publishSettings, setPublishSettings] = useState({ temporaryMediaRetentionSeconds: 7 * 24 * 60 * 60 });
  const [lastUpdated, setLastUpdated] = useState(null);
  const [liveTransport, setLiveTransport] = useState('connecting');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const uploadControlsRef = useRef(new Map());
  const autoResumeIdsRef = useRef(new Set());

  const sortPendingUploads = items =>
    [...items].sort((a, b) => getTimestamp(b.updatedAt || b.createdAt) - getTimestamp(a.updatedAt || a.createdAt));

  const upsertPendingUploadState = useCallback(pending => {
    setPendingUploads(current => {
      const existing = current.find(item => item.id === pending.id);
      const next = current.filter(item => item.id !== pending.id);
      next.push(mergePendingPublishRecords(existing || null, pending));
      return sortPendingUploads(next);
    });
  }, []);

  const removePendingUploadState = useCallback(pendingId => {
    setPendingUploads(current => current.filter(item => item.id !== pendingId));
  }, []);

  const persistPendingUpload = useCallback(async pending => {
    await putPendingPublish(pending);
    upsertPendingUploadState(pending);
  }, [upsertPendingUploadState]);

  const getUploadControlRef = useCallback(pendingId => {
    const key = String(pendingId);
    if (!uploadControlsRef.current.has(key)) {
      uploadControlsRef.current.set(key, {
        current: {
          paused: false,
          cancelled: false,
          abortController: null,
          currentSessionId: '',
          stopOnPause: true
        }
      });
    }
    return uploadControlsRef.current.get(key);
  }, []);

  const loadServerState = useCallback(async () => {
    const [jobsPayload, settingsPayload] = await Promise.all([
      api.get('/api/publish/jobs'),
      api.get('/api/publish/settings')
    ]);
    setJobs(jobsPayload.data.publishJobs || []);
    setPublishSettings(settingsPayload.data.settings);
    setLastUpdated(new Date());
  }, []);

  const loadPendingUploads = useCallback(async currentUser => {
    try {
      const owner = currentUser || user;
      const pendingItems = await getPendingPublishes();
      const ownedPendingItems = pendingItems.filter(item => !owner?._id || !item.userId || item.userId === owner._id);
      const staleCompletedItems = ownedPendingItems.filter(isPendingFullyHandedOff);
      if (staleCompletedItems.length > 0) {
        await Promise.allSettled(
          staleCompletedItems.flatMap(pending => [
            ...pendingMediaItems(pending).filter(item => item.uploadKey).map(item => deleteUploadFile(item.uploadKey)),
            deletePendingPublish(pending.id)
          ])
        );
      }
      setPendingUploads(current => {
        const currentById = new Map(current.map(item => [item.id, item]));
        return ownedPendingItems
          .filter(item => !isPendingFullyHandedOff(item))
          .map(item => mergePendingPublishRecords(currentById.get(item.id) || null, item))
          .sort((a, b) => getTimestamp(b.updatedAt || b.createdAt) - getTimestamp(a.updatedAt || a.createdAt));
      });
      setPendingUploadError('');
    } catch (err) {
      setPendingUploadError(err.message || 'Unable to read resumable upload state in this browser.');
    }
  }, [user?._id]);

  const load = useCallback(async () => {
    await Promise.all([
      loadServerState(),
      loadPendingUploads()
    ]);
  }, [loadPendingUploads, loadServerState]);

  useEffect(() => {
    const currentUser = getUser();
    setUser(currentUser);
    loadServerState().catch(err => setMessage(err.message));
    loadPendingUploads(currentUser).catch(() => {});

    const socket = getSocket();
    const handler = () => loadServerState().catch(() => {});
    const handleMediaUploadSession = async payload => {
      const uploadSession = payload?.uploadSession;
      if (!uploadSession?._id && !uploadSession?.uploadKey) {
        await loadPendingUploads(currentUser).catch(() => {});
        return;
      }

      const pendingItems = await getPendingPublishes().catch(() => []);
      let changed = false;
      for (const pending of pendingItems) {
        const item = pendingMediaItems(pending).find(mediaItem =>
          (uploadSession._id && mediaItem.sessionId === uploadSession._id) ||
          (uploadSession.uploadKey && mediaItem.uploadKey === uploadSession.uploadKey)
        );
        if (!item) continue;
        applyUploadSessionToPendingItem(item, uploadSession, { forceSpeedZero: false });
        if (item.mediaAssetId && item.uploadKey) {
          deleteUploadFile(item.uploadKey).catch(() => {});
        }
        await putPendingPublish(pending).catch(() => {});
        changed = true;
      }

      if (changed) {
        await loadPendingUploads(currentUser).catch(() => {});
      }
    };
    const handleConnect = () => setLiveTransport('socket');
    const handleDisconnect = () => setLiveTransport('polling');
    if (socket.connected) handleConnect();
    socket.on('publishing:job_updated', handler);
    socket.on('media:upload_session_updated', handleMediaUploadSession);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleDisconnect);
    return () => {
      socket.off('publishing:job_updated', handler);
      socket.off('media:upload_session_updated', handleMediaUploadSession);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleDisconnect);
    };
  }, [loadPendingUploads, loadServerState]);

  useEffect(() => {
    const stopActiveControlForPending = (pendingId, { cancelled = false, paused = false } = {}) => {
      const controlRef = uploadControlsRef.current.get(String(pendingId || ''));
      if (!controlRef?.current) return;
      if (cancelled) controlRef.current.cancelled = true;
      if (paused) controlRef.current.paused = true;
      controlRef.current.abortController?.abort();
      if (paused && controlRef.current.currentSessionId) {
        pauseUploadSession(controlRef.current.currentSessionId).catch(() => {});
      }
    };

    const unsubscribe = subscribeUploadStateChanges(async event => {
      const pendingId = event.pendingId ? String(event.pendingId) : '';
      if (event.type === 'pending_publish_deleted' && pendingId) {
        stopActiveControlForPending(pendingId, { cancelled: true });
      }
      if (event.type === 'pending_publish_updated' && pendingId) {
        const pendingItems = await getPendingPublishes().catch(() => []);
        const latestPending = pendingItems.find(item => String(item.id) === pendingId);
        if (!latestPending) {
          stopActiveControlForPending(pendingId, { cancelled: true });
        } else if (latestPending.pauseReason === 'user') {
          stopActiveControlForPending(pendingId, { paused: true });
        }
      }
      loadPendingUploads().catch(() => {});
    });
    const intervalId = window.setInterval(() => {
      loadPendingUploads().catch(() => {});
    }, 1000);
    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') loadPendingUploads().catch(() => {});
    };
    document.addEventListener('visibilitychange', visibilityHandler);
    return () => {
      unsubscribe();
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', visibilityHandler);
    };
  }, [loadPendingUploads]);

  useEffect(() => {
    const refreshLiveServerState = () => {
      if (document.visibilityState !== 'visible') return;
      loadServerState().catch(() => {});
    };
    const intervalId = window.setInterval(refreshLiveServerState, 1000);
    const focusHandler = () => {
      loadServerState().catch(() => {});
      loadPendingUploads().catch(() => {});
    };
    window.addEventListener('focus', focusHandler);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', focusHandler);
    };
  }, [loadPendingUploads, loadServerState]);

  const groups = useMemo(() => buildDispatchGroups(jobs), [jobs]);
  const searchQuery = normalizeText(query.trim());
  const visiblePendingUploads = useMemo(
    () => pendingUploads.filter(pending => pendingMatchesFilter(pending, activeFilter) && pendingMatchesSearch(pending, searchQuery)),
    [activeFilter, pendingUploads, searchQuery]
  );
  const visibleGroups = useMemo(
    () => groups.filter(group => groupMatchesFilter(group, activeFilter) && groupMatchesSearch(group, searchQuery)),
    [activeFilter, groups, searchQuery]
  );
  const stats = useMemo(() => {
    const pendingProgress = pendingUploads.map(getPendingProgress);
    return {
      uploading: pendingProgress.filter(progress => ['waiting_upload', 'uploading_client', 'interrupted_upload', 'verifying_upload'].includes(progress.status)).length,
      queued: groups.filter(group => group.queuedCount > 0).length,
      processing: groups.filter(group => group.processingCount > 0).length,
      paused: groups.filter(group => group.pausedCount > 0).length + pendingProgress.filter(progress => progress.status === 'paused_upload').length,
      review: groups.filter(group => group.attentionCount > 0).length + pendingProgress.filter(progress => progress.attention).length,
      published: groups.filter(group => group.jobs.length > 0 && group.jobs.every(job => job.status === 'published')).length,
      expired: groups.filter(group => group.expiredCount > 0).length,
      platformJobs: jobs.length
    };
  }, [groups, jobs.length, pendingUploads]);
  const filterCounts = useMemo(() => ({
    all: pendingUploads.length + groups.length,
    uploading: stats.uploading,
    queued: stats.queued,
    processing: stats.processing,
    paused: stats.paused,
    review: stats.review,
    published: stats.published,
    expired: stats.expired
  }), [groups.length, pendingUploads.length, stats]);
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
        setMessage(job.status === 'publishing' ? 'Pause requested for active platform upload.' : 'Platform job paused.');
      }
      if (action === 'resume') {
        await api.post(`/api/publish/jobs/${job._id}/resume`, {});
        setMessage('Platform job resumed.');
      }
      if (action === 'cancel') {
        await api.post(`/api/publish/jobs/${job._id}/cancel`, {});
        setMessage(job.status === 'publishing' ? 'Cancel requested for active platform upload.' : 'Platform job cancelled.');
      }
      await loadServerState();
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
      await loadServerState();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusyKey('');
    }
  };

  const cancelPendingUpload = async pending => {
    const progress = getPendingProgress(pending);
    const controlRef = uploadControlsRef.current.get(String(pending.id));
    if (controlRef?.current) {
      controlRef.current.cancelled = true;
      controlRef.current.paused = false;
      controlRef.current.abortController?.abort();
    }
    setBusyKey(`cancel-upload:${pending.id}`);
    setMessage('');
    try {
      const items = pendingMediaItems(pending);
      await Promise.allSettled(
        items
          .filter(item => item.sessionId && !item.mediaAssetId)
          .map(item => cancelUploadSession(item.sessionId))
      );
      await Promise.allSettled(items.filter(item => item.uploadKey).map(item => deleteUploadFile(item.uploadKey)));
      if (!progress.hasCreatedJobs) {
        await Promise.allSettled(items.map(item => item.mediaAssetId).filter(Boolean).map(mediaAssetId => api.delete(`/api/media/${mediaAssetId}`)));
      }
      await deletePendingPublish(pending.id);
      removePendingUploadState(pending.id);
      await loadPendingUploads();
      setMessage(progress.hasCreatedJobs ? 'Upload intake record cleared. Created platform jobs were kept.' : 'Upload cancelled and temporary cloud media was removed.');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusyKey('');
    }
  };

  const pausePendingUpload = async pending => {
    const controlRef = uploadControlsRef.current.get(String(pending.id));
    if (controlRef?.current) {
      controlRef.current.paused = true;
      controlRef.current.abortController?.abort();
    }
    setBusyKey(`pause-upload:${pending.id}`);
    setMessage('');
    try {
      const mediaItems = pendingMediaItems(pending).map(item =>
        item.mediaAssetId || item.status === 'completed'
          ? item
          : {
              ...item,
              status: 'paused'
            }
      );
      await Promise.allSettled(
        mediaItems
          .filter(item => item.sessionId && !item.mediaAssetId)
          .map(item => pauseUploadSession(item.sessionId))
      );
      await putPendingPublish({
        ...pending,
        mediaItems,
        pauseReason: 'user'
      });
      await loadPendingUploads();
      setMessage('Cloud upload intake paused. Resume it from Dispatch when ready.');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusyKey('');
    }
  };

  const uploadMediaForPending = async ({ pending, controlRef }) => {
    const mediaAssetIds = [];

    for (const item of pendingMediaItems(pending)) {
      if (item.mediaAssetId) {
        mediaAssetIds.push(item.mediaAssetId);
        continue;
      }

      if (item.sessionId) {
        const sessionPayload = await getUploadSession(item.sessionId).catch(() => null);
        const session = sessionPayload?.data?.uploadSession;
        if (session) {
          const mediaAssetId = applyUploadSessionToPendingItem(item, session);
          await persistPendingUpload(pending);
          if (mediaAssetId) {
            mediaAssetIds.push(mediaAssetId);
            if (item.uploadKey) await deleteUploadFile(item.uploadKey).catch(() => {});
            continue;
          }
          if (session.status === 'completed') {
            const error = new Error('Completed upload is missing its verified media asset.');
            error.uploadItem = item;
            error.code = 'UPLOAD_SESSION_FAILED';
            throw error;
          }
          if (session.status === 'failed') {
            const error = new Error(session.failureReason || `${item.originalName || 'Media'} upload failed before platform dispatch.`);
            error.uploadItem = item;
            error.code = 'UPLOAD_SESSION_FAILED';
            throw error;
          }
          if (session.status === 'cancelled') {
            const error = new Error(`${item.originalName || 'Media'} upload was cancelled before platform dispatch.`);
            error.uploadItem = item;
            throw error;
          }
        }
      }

      const file = await getUploadFile(item.uploadKey);
      if (!file) {
        const error = new Error(`${item.originalName} is no longer available in this browser. Select the file again to continue.`);
        error.code = 'UPLOAD_FILE_UNAVAILABLE';
        error.uploadItem = item;
        throw error;
      }

      item.status = 'uploading';
      await persistPendingUpload(pending);

      let mediaAsset;
      try {
        mediaAsset = await uploadFileResumable({
          file,
          uploadKey: item.uploadKey,
          sha256: item.sha256,
          sessionId: item.sessionId,
          storageIntent: 'temporary_publish',
          cleanupGroupId: pending.postGroupId,
          cropMetadata: item.cropMetadata,
          controlRef,
          onSession: session => {
            applyUploadSessionToPendingItem(item, session, { forceSpeedZero: false });
            item.uploadSpeedBytesPerSecond = session.uploadSpeedBytesPerSecond || 0;
            persistPendingUpload(pending).catch(() => {});
          },
          onProgress: session => {
            applyUploadSessionToPendingItem(item, session, { forceSpeedZero: false });
            item.uploadSpeedBytesPerSecond = session.uploadSpeedBytesPerSecond || 0;
            persistPendingUpload(pending).catch(() => {});
          }
        });
      } catch (error) {
        error.uploadItem = item;
        throw error;
      }

      item.mediaAssetId = mediaAsset._id;
      item.bytesUploaded = item.size;
      item.bytesSent = item.size;
      item.status = 'completed';
      item.uploadSpeedBytesPerSecond = 0;
      item.failureReason = '';
      mediaAssetIds.push(mediaAsset._id);
      await deleteUploadFile(item.uploadKey);
      await persistPendingUpload(pending);
    }

    return mediaAssetIds;
  };

  const createPublishJobsForPending = async ({ pending, mediaAssetIds }) => {
    let results = [...(pending.results || [])];
    const completedKeys = new Set(results.filter(result => result.jobId).map(result => result.targetKey));
    const pendingConnections = (pending.selectedConnections || []).filter(connection => !completedKeys.has(getConnectionTargetKey(connection)));

    const createdResults = await Promise.all(pendingConnections.map(async connection => {
      const targetKey = getConnectionTargetKey(connection);
      const customizedForTarget = (pending.captions || []).find(
        item => item.connectionId === connection.platformConnectionId && item.platform === connection.platform
      );
      const scheduledAt = new Date(pending.scheduledAt || Date.now());

      try {
        const payload = await api.post(pending.endpoint || '/api/publish/now', {
          postGroupId: pending.postGroupId,
          groupTargetCount: pending.groupTargetCount || (pending.selectedConnections || []).length || 1,
          platformConnectionId: connection.platformConnectionId,
          targetPlatform: connection.platform,
          mediaAssetIds,
          mediaProcessing: pending.mediaProcessingDecisions?.[targetKey] || { compressOnOversize: false, compressBeforeUpload: false },
          coverIndex: pending.coverIndex,
          caption: customizedForTarget?.caption || pending.baseCaption,
          visibility: pending.visibility,
          scheduledAt: Number.isNaN(scheduledAt.getTime()) ? new Date().toISOString() : scheduledAt.toISOString()
        });
        const publishJob = payload.data.publishJob;
        return {
          ok: !['blocked', 'failed'].includes(publishJob?.status),
          targetKey,
          platform: connection.platform,
          accountHandle: connection.accountHandle,
          status: publishJob?.status || 'queued',
          jobId: publishJob?._id,
          detail: describePublishJob(publishJob)
        };
      } catch (err) {
        return {
          ok: false,
          targetKey,
          platform: connection.platform,
          accountHandle: connection.accountHandle,
          status: 'blocked',
          detail: err.message
        };
      }
    }));

    for (const result of createdResults) {
      results = upsertTargetResult(results, result);
    }
    pending.results = results;
    await persistPendingUpload(pending);

    return results;
  };

  const cleanupPendingUploadRecord = async pending => {
    const items = pendingMediaItems(pending);
    await Promise.allSettled(items.filter(item => item.uploadKey).map(item => deleteUploadFile(item.uploadKey)));
    await deletePendingPublish(pending.id);
    removePendingUploadState(pending.id);
  };

  const resumePendingUpload = async (pending, { skipLock = false } = {}) => {
    if (!skipLock) {
      const lockResult = await runWithUploadWorkerLock(pending.id, () =>
        resumePendingUpload(pending, { skipLock: true })
      );
      if (!lockResult.acquired) {
        upsertPendingUploadState(pending);
        setMessage('This upload is already running in another tab. Dispatch will follow live progress here.');
        return;
      }
      return lockResult.value;
    }

    const controlRef = getUploadControlRef(pending.id);
    controlRef.current = {
      paused: false,
      cancelled: false,
      abortController: null,
      currentSessionId: '',
      stopOnPause: true
    };
    setBusyKey(`resume-upload:${pending.id}`);
    setMessage('');

    try {
      pending.pauseReason = '';
      pending.mediaItems = pendingMediaItems(pending).map(item =>
        item.mediaAssetId || item.status === 'completed'
          ? item
          : item.status === 'failed'
            ? {
                ...item,
                sessionId: '',
                bytesUploaded: 0,
                bytesSent: 0,
                uploadSpeedBytesPerSecond: 0,
                status: 'waiting',
                failureReason: ''
              }
          : {
              ...item,
              status: item.sessionId ? 'interrupted' : 'waiting',
              failureReason: ''
            }
      );
      await persistPendingUpload(pending);

      const mediaAssetIds = await uploadMediaForPending({ pending, controlRef });
      const results = await createPublishJobsForPending({ pending, mediaAssetIds });
      const acceptedTargetCount = new Set(results.filter(result => result.jobId).map(result => result.targetKey)).size;
      const targetCount = (pending.selectedConnections || []).length;

      if (targetCount > 0 && acceptedTargetCount < targetCount) {
        pending.results = results;
        await persistPendingUpload(pending);
        await load();
        const missingCount = targetCount - acceptedTargetCount;
        setMessage(`${acceptedTargetCount}/${targetCount} platform request${targetCount === 1 ? '' : 's'} accepted. ${missingCount} target${missingCount === 1 ? '' : 's'} stayed in Dispatch for retry.`);
        return;
      }

      await cleanupPendingUploadRecord(pending);
      await load();
      const action = pending.mode === 'schedule' ? 'schedule' : 'publish';
      setMessage(`${acceptedTargetCount}/${targetCount || results.length} ${action} request${results.length === 1 ? '' : 's'} accepted from Dispatch.`);
    } catch (err) {
      if (isUploadPausedError(err) || controlRef.current.paused) {
        pending.pauseReason = 'user';
        pending.mediaItems = pendingMediaItems(pending).map(item =>
          item.mediaAssetId || item.status === 'completed'
            ? item
            : {
                ...item,
                status: 'paused'
              }
        );
        await persistPendingUpload(pending).catch(() => {});
        setMessage('Cloud upload intake paused. Resume it from Dispatch when ready.');
        return;
      }

      if (controlRef.current.cancelled || String(err.message || '').toLowerCase().includes('cancelled')) {
        await cleanupPendingUploadRecord(pending).catch(() => {});
        setMessage('Upload cancelled. Temporary uploaded media was removed.');
        return;
      }

      if (isShaMismatchUploadError(err) && err.uploadItem) {
        err.uploadItem.sessionId = '';
        err.uploadItem.bytesUploaded = 0;
        err.uploadItem.bytesSent = 0;
        err.uploadItem.status = 'failed';
        err.uploadItem.mediaAssetId = '';
        err.uploadItem.failureReason = err.message;
        pending.pauseReason = 'user';
        await persistPendingUpload(pending).catch(() => {});
        const retry = window.confirm(`${err.uploadItem.originalName} was corrupted during upload and CreatorOps deleted the uploaded copy. Retry this upload from the beginning?`);
        if (retry) {
          err.uploadItem.status = 'waiting';
          err.uploadItem.failureReason = '';
          pending.pauseReason = '';
          await persistPendingUpload(pending).catch(() => {});
          await resumePendingUpload(pending, { skipLock: true });
          return;
        }
      } else if (isMissingUploadFileError(err) && err.uploadItem) {
        err.uploadItem.status = 'failed';
        err.uploadItem.failureReason = err.message;
        pending.pauseReason = 'user';
        await persistPendingUpload(pending).catch(() => {});
      } else if (isUploadSessionFailedError(err) && err.uploadItem) {
        err.uploadItem.status = 'failed';
        err.uploadItem.uploadSpeedBytesPerSecond = 0;
        err.uploadItem.failureReason = err.message;
        pending.pauseReason = 'user';
        await persistPendingUpload(pending).catch(() => {});
      } else {
        markPendingInterrupted(pending);
        await persistPendingUpload(pending).catch(() => {});
      }

      setMessage(err.message);
    } finally {
      uploadControlsRef.current.delete(String(pending.id));
      setBusyKey('');
      await loadPendingUploads().catch(() => {});
    }
  };

  useEffect(() => {
    if (!canManage || busyKey) return;
    const pending = pendingUploads.find(item => {
      const pendingId = String(item.id);
      return (
        shouldAutoResumePending(item) &&
        !autoResumeIdsRef.current.has(pendingId) &&
        !uploadControlsRef.current.has(pendingId)
      );
    });
    if (!pending) return;

    const pendingId = String(pending.id);
    autoResumeIdsRef.current.add(pendingId);
    window.setTimeout(() => {
      resumePendingUpload({ ...pending })
        .catch(err => setMessage(err.message))
        .finally(() => {
          autoResumeIdsRef.current.delete(pendingId);
        });
    }, 0);
  }, [busyKey, canManage, pendingUploads]);

  const deleteDispatchTarget = async ({ target, targets = [] }) => {
    const targetId = target.kind === 'group' ? target.group.id : target.job._id;
    setBusyKey(`delete:${target.kind}:${targetId}`);
    setMessage('');
    try {
      const payload = { targets };
      const response = target.kind === 'group'
        ? await api.post(`/api/publish/groups/${encodeURIComponent(target.group.id)}/delete`, payload)
        : await api.post(`/api/publish/jobs/${target.job._id}/delete`, payload);
      const result = response.data;
      const failedProviderDeletes = (result.providerResults || []).filter(item => !item.ok);
      const deletedCount = (result.deleted?.publishJobs || 0) + (result.deleted?.publishedPosts || 0);
      const platformDeleteCount = targets.filter(item => item.deleteFromPlatform).length;
      const firstProviderFailure = failedProviderDeletes[0];
      const firstProviderFailureText = firstProviderFailure
        ? `${formatPlatform(firstProviderFailure.platform)}: ${firstProviderFailure.message || firstProviderFailure.code || 'provider delete failed'}`
        : '';
      setMessage(
        failedProviderDeletes.length > 0
          ? `${deletedCount} CreatorOps records deleted. ${failedProviderDeletes.length} platform delete ${failedProviderDeletes.length === 1 ? 'failed' : 'attempts failed'} and were kept for review. ${firstProviderFailureText}`
          : `${deletedCount} CreatorOps records deleted${platformDeleteCount > 0 ? ' after selected platform deletes where supported' : ' from this website only'}.`
      );
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusyKey('');
    }
  };

  const hasVisibleWork = visiblePendingUploads.length > 0 || visibleGroups.length > 0;

  return (
    <AppShell>
      <div className="space-y-5 pb-6">
        <header className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 md:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mint">Post operations</p>
              <h1 className="mt-2 text-3xl font-bold text-[var(--text)]">Post Dispatch</h1>
              <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
                Track the whole publish path from browser resumable upload to cloud media, provider processing, retries, expiry, and final published posts.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusStat icon={UploadCloud} label="Uploading" value={stats.uploading} tone="text-mint" />
              <StatusStat icon={Activity} label="Processing" value={stats.processing} tone="text-mint" />
              <StatusStat icon={AlertTriangle} label="Review" value={stats.review} tone="text-gold" />
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
          </div>
        </header>

        <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-center">
          <div className="flex gap-2 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
            {dispatchFilters.map(filter => {
              const active = activeFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveFilter(filter.id)}
                  className={`focus-ring inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold transition ${
                    active ? 'bg-[var(--text)] text-[var(--bg)]' : 'text-[var(--muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)]'
                  }`}
                >
                  {filter.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-[var(--bg)]/15 text-[var(--bg)]' : 'bg-[var(--surface2)] text-[var(--muted)]'}`}>
                    {filterCounts[filter.id] || 0}
                  </span>
                </button>
              );
            })}
          </div>
          <label className="focus-within:ring-ring flex h-11 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm">
            <Search size={16} className="shrink-0 text-[var(--muted)]" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search platform, account, caption, stage"
              className="min-w-0 flex-1 bg-transparent text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
            />
          </label>
        </section>

        <div className="flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-xs text-[var(--muted)] md:flex-row md:items-center md:justify-between">
          <span>{stats.platformJobs} platform jobs · {pendingUploads.length} upload intake {pendingUploads.length === 1 ? 'record' : 'records'}</span>
          <span className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-mint/30 bg-mint/10 px-2 py-1 font-semibold text-mint">
              <Activity size={12} />
              {liveTransport === 'socket' ? 'Live socket' : liveTransport === 'polling' ? 'Live polling' : 'Connecting'}
            </span>
            <span>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Waiting for first sync'}</span>
          </span>
        </div>

        {(message || pendingUploadError) && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--text)]">
            {message || pendingUploadError}
          </div>
        )}

        {visiblePendingUploads.length > 0 && (
          <section className="space-y-3">
            <SectionHeader
              icon={UploadCloud}
              title="Cloud Upload Intake"
              detail="Media appears here before publish jobs exist. Resume, pause, or cancel cloud upload intake from here."
            />
            {visiblePendingUploads.map(pending => (
              <PendingUploadCard
                key={pending.id}
                pending={pending}
                busyKey={busyKey}
                canManage={canManage}
                onResume={resumePendingUpload}
                onPause={pausePendingUpload}
                onCancel={cancelPendingUpload}
              />
            ))}
          </section>
        )}

        {visibleGroups.length > 0 && (
          <section className="space-y-3">
            <SectionHeader
              icon={Cloud}
              title="Platform Dispatches"
              detail={`Temporary cloud media expires after ${temporaryMediaRetentionLabel} once a group is no longer queued, publishing, or paused.`}
            />
            {visibleGroups.map(group => (
              <DispatchGroup
                key={group.id}
                group={group}
                canManage={canManage}
                busyKey={busyKey}
                retentionLabel={temporaryMediaRetentionLabel}
                onJobAction={runJobAction}
                onGroupAction={runGroupAction}
                onDeleteGroup={group => setDeleteTarget({ kind: 'group', group })}
                onDeleteJob={job => setDeleteTarget({ kind: 'job', job })}
              />
            ))}
          </section>
        )}

        {!hasVisibleWork && (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-center">
            <Layers3 size={26} className="text-[var(--muted)]" />
            <p className="mt-3 text-sm font-semibold text-[var(--text)]">No dispatches here</p>
            <p className="mt-1 max-w-md text-sm text-[var(--muted)]">
              Try another filter, clear search, or start a new publish. Upload intake will show here before platform jobs are created.
            </p>
          </div>
        )}

        {deleteTarget && (
          <DeleteDispatchModal
            target={deleteTarget}
            busyKey={busyKey}
            onClose={() => setDeleteTarget(null)}
            onConfirm={deleteDispatchTarget}
          />
        )}
      </div>
    </AppShell>
  );
}

function SectionHeader({ icon: Icon, title, detail }) {
  return (
    <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
      <div className="flex items-center gap-2">
        <Icon size={18} className="text-mint" />
        <h2 className="text-sm font-semibold text-[var(--text)]">{title}</h2>
      </div>
      <p className="text-xs text-[var(--muted)]">{detail}</p>
    </div>
  );
}

function DeleteDispatchModal({ target, busyKey, onClose, onConfirm }) {
  const isGroup = target.kind === 'group';
  const jobs = isGroup ? target.group.jobs : [target.job];
  const [selectedJobIds, setSelectedJobIds] = useState(() => jobs.map(job => String(job._id)));
  const [deleteModes, setDeleteModes] = useState(() => buildInitialDeleteModes(jobs));
  const busyId = isGroup ? `delete:group:${target.group.id}` : `delete:job:${target.job._id}`;
  const busy = busyKey === busyId;

  useEffect(() => {
    setSelectedJobIds(jobs.map(job => String(job._id)));
    setDeleteModes(buildInitialDeleteModes(jobs));
  }, [target]);

  const selectedJobs = jobs.filter(job => selectedJobIds.includes(String(job._id)));
  const hasPublishing = selectedJobs.some(job => job.status === 'publishing');
  const canConfirm = selectedJobs.length > 0 && !busy && !hasPublishing;
  const title = isGroup ? `Delete post ${compactId(target.group.id)}` : `Delete ${formatPlatform(target.job.platform)}`;
  const selectedPlatformDeleteCount = selectedJobs.filter(job => deleteModes[String(job._id)] === 'platform').length;

  const toggleJob = jobId => {
    const id = String(jobId);
    setSelectedJobIds(current =>
      current.includes(id) ? current.filter(value => value !== id) : [...current, id]
    );
  };

  const setJobMode = (jobId, mode) => {
    setDeleteModes(current => ({ ...current, [String(jobId)]: mode }));
  };

  const setSupportedJobsToPlatform = () => {
    setDeleteModes(current => ({
      ...current,
      ...Object.fromEntries(jobs.map(job => [String(job._id), getPlatformDeleteSupport(job).supported ? 'platform' : 'local']))
    }));
  };

  const confirmDelete = () => {
    onConfirm({
      target,
      targets: selectedJobs.map(job => ({
        jobId: job._id,
        deleteFromPlatform: deleteModes[String(job._id)] === 'platform'
      }))
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <section className="w-full max-w-2xl overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
        <div className="border-b border-[var(--border)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose">Delete dispatch</p>
              <h2 className="mt-1 text-xl font-bold text-[var(--text)]">{title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"
              aria-label="Close delete dialog"
            >
              <XCircle size={16} />
            </button>
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Choose exactly what each platform row should do. A row can be deleted only here, or deleted here after the provider delete API succeeds.
          </p>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface2)] p-3">
            {isGroup && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[var(--text)]">Platforms in this post</h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedJobIds(jobs.map(job => String(job._id)))}
                    className="focus-ring rounded-md border border-[var(--border)] px-2 py-1 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedJobIds([])}
                    className="focus-ring rounded-md border border-[var(--border)] px-2 py-1 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
                  >
                    None
                  </button>
                </div>
              </div>
            )}
            <div className={`${isGroup ? 'mt-3' : ''} flex flex-wrap gap-2`}>
              <button
                type="button"
                onClick={() => setDeleteModes(buildInitialDeleteModes(jobs))}
                className="focus-ring rounded-md border border-[var(--border)] px-2 py-1 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
              >
                All here only
              </button>
              <button
                type="button"
                onClick={setSupportedJobsToPlatform}
                className="focus-ring rounded-md border border-[var(--border)] px-2 py-1 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
              >
                Supported platform too
              </button>
            </div>
            <div className="mt-3 grid gap-2">
              {jobs.map(job => {
                const account = getJobAccount(job);
                const checked = selectedJobIds.includes(String(job._id));
                const support = getPlatformDeleteSupport(job);
                const mode = deleteModes[String(job._id)] || 'local';
                return (
                  <div key={job._id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleJob(job._id)}
                        className="mt-1 h-4 w-4 accent-[var(--mint)]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-[var(--text)]">{formatPlatform(job.platform)}</span>
                          {job.providerPostId ? (
                            <span className="rounded-full border border-mint/30 px-2 py-0.5 text-[10px] font-semibold text-mint">platform post</span>
                          ) : (
                            <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)]">website only</span>
                          )}
                        </div>
                        <div className="mt-1 truncate text-xs text-[var(--muted)]">
                          {account.accountHandle || account.accountName || 'account'} · {job.status}
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => setJobMode(job._id, 'local')}
                            disabled={!checked}
                            className={`focus-ring rounded-lg border px-3 py-2 text-left text-xs transition disabled:opacity-50 ${
                              mode === 'local'
                                ? 'border-mint bg-mint/10 text-[var(--text)]'
                                : 'border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface2)]'
                            }`}
                          >
                            <span className="block font-semibold">Delete from here only</span>
                            <span className="mt-1 block text-[11px] text-[var(--muted)]">Removes this website record and local history.</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setJobMode(job._id, 'platform')}
                            disabled={!checked || !support.supported}
                            className={`focus-ring rounded-lg border px-3 py-2 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-50 ${
                              mode === 'platform'
                                ? 'border-mint bg-mint/10 text-[var(--text)]'
                                : 'border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface2)]'
                            }`}
                            title={support.reason}
                          >
                            <span className="block font-semibold">Delete here + platform</span>
                            <span className="mt-1 block text-[11px] text-[var(--muted)]">{support.reason}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {hasPublishing && (
            <div className="rounded-lg border border-gold/30 bg-gold/10 p-3 text-sm text-gold">
              Active publishing jobs must be paused or cancelled before deletion so the worker cannot finish a provider upload after the local record is gone.
            </div>
          )}

          {selectedPlatformDeleteCount > 0 && (
            <div className="rounded-lg border border-gold/30 bg-gold/10 p-3 text-sm text-gold">
              {selectedPlatformDeleteCount} selected {selectedPlatformDeleteCount === 1 ? 'platform' : 'platforms'} will call provider delete APIs first. If a provider delete fails, CreatorOps keeps that record for review.
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-[var(--border)] p-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="focus-ring inline-flex h-10 items-center justify-center rounded-lg border border-[var(--border)] px-4 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)] disabled:opacity-60"
          >
            Keep
          </button>
          <button
            type="button"
            onClick={confirmDelete}
            disabled={!canConfirm}
            className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-rose/40 bg-rose/10 px-4 text-sm font-semibold text-rose hover:bg-rose/20 disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            Delete {selectedJobs.length} {selectedJobs.length === 1 ? 'platform' : 'platforms'}
          </button>
        </div>
      </section>
    </div>
  );
}

function StatusStat({ icon: Icon, label, value, tone }) {
  return (
    <div className="flex h-10 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-3">
      <Icon size={15} className={tone} />
      <span className="text-xs font-medium text-[var(--muted)]">{label}</span>
      <span className="text-sm font-bold text-[var(--text)]">{value}</span>
    </div>
  );
}

function PendingUploadCard({ pending, busyKey, canManage, onResume, onPause, onCancel }) {
  const progress = getPendingProgress(pending);
  const meta = getJobStatusMeta(progress.status);
  const items = pendingMediaItems(pending);
  const targets = pending.selectedConnections || [];
  const firstCaption = pending.captions?.find(item => item.caption)?.caption || pending.baseCaption || '';
  const cancelBusy = busyKey === `cancel-upload:${pending.id}`;
  const pauseBusy = busyKey === `pause-upload:${pending.id}`;
  const resumeBusy = busyKey === `resume-upload:${pending.id}`;
  const acceptedTargetCount = new Set((pending.results || []).filter(result => result.jobId).map(result => result.targetKey)).size;
  const hasUnfinishedTargets = targets.length > acceptedTargetCount;
  const failedTargetResults = (pending.results || []).filter(result =>
    !result.jobId && (result.ok === false || ['blocked', 'failed'].includes(result.status))
  );
  const canResumeUpload = canManage && (
    ['paused_upload', 'interrupted_upload', 'failed_upload', 'waiting_upload'].includes(progress.status)
  );
  const handoffBusy = resumeBusy && progress.status === 'verifying_upload' && hasUnfinishedTargets;
  const canPauseUpload = canManage && !progress.hasCreatedJobs && ['waiting_upload', 'uploading_client', 'interrupted_upload'].includes(progress.status);
  const resumeLabel = progress.status === 'failed_upload' ? 'Retry' : 'Resume';
  const fullSizeUnverifiedCount = items.filter(item =>
    !item.mediaAssetId && item.sessionId && (isPendingItemAtCloudSize(item) || isPendingItemSentToCloudSize(item))
  ).length;
  const failedUploadReason = items.find(item => item.status === 'failed' && (item.failureReason || item.errorMessage))?.failureReason ||
    items.find(item => item.status === 'failed' && (item.failureReason || item.errorMessage))?.errorMessage ||
    '';
  const statusDescription = (() => {
    if (failedTargetResults.length > 0) return 'One or more platform dispatches failed before a job was created. Retry from Dispatch or cancel it.';
    if (progress.status === 'failed_upload') return failedUploadReason || 'Cloud upload or verification failed. Retry from Dispatch or cancel it.';
    if (pending.pauseReason === 'user') return 'Paused by you. Resume from Dispatch when ready.';
    if (progress.status === 'interrupted_upload') return 'Interrupted upload is saved. Resume from the last verified chunk here.';
    if (progress.status === 'verifying_upload' && fullSizeUnverifiedCount > 0) return 'Upload reached cloud storage. CreatorOps is verifying SHA-256 and linking the cloud media asset.';
    if (progress.status === 'verifying_upload' && hasUnfinishedTargets) return 'Cloud media is verified. CreatorOps is creating the remaining platform dispatches.';
    if (progress.status === 'verifying_upload') return 'Cloud media is verified. CreatorOps is preparing platform dispatch.';
    if (progress.status === 'uploading_client') return 'Uploading from this browser to CreatorOps cloud storage.';
    return 'Upload runs sequentially so every file can resume from its own verified offset.';
  })();

  return (
    <article className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-semibold ${meta.tone}`}>
              {progress.status === 'uploading_client' ? <Loader2 size={12} className="animate-spin" /> : <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />}
              {meta.label}
            </span>
            <span className="text-xs text-[var(--muted)]">{pending.mode === 'schedule' ? 'Scheduled publish' : 'Publish now'}</span>
            <span className="text-xs text-[var(--muted)]">{compactId(pending.postGroupId || pending.id)}</span>
          </div>
          <h3 className="mt-3 truncate text-base font-semibold text-[var(--text)]">
            {firstCaption || `${items.length} media ${items.length === 1 ? 'file' : 'files'} for ${targets.length} platform ${targets.length === 1 ? 'target' : 'targets'}`}
          </h3>
          <div className="mt-4">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
              <span>{progress.completedCount}/{progress.totalCount} uploaded to cloud</span>
              <span>
                {formatBytes(progress.uploadedBytes)} / {formatBytes(progress.totalBytes)}
                {progress.bytesPerSecond > 0 ? ` · ${formatThroughput(progress.bytesPerSecond)}` : ''}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--surface2)]">
              <div className="h-full rounded-full bg-mint transition-all" style={{ width: formatPercent(progress.percent) }} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {targets.map(connection => (
              <span key={connection.targetKey || `${connection.platform}-${connection.accountHandle}`} className="rounded-full border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)]">
                {formatPlatform(connection.platform)} {connection.accountHandle ? `· ${connection.accountHandle}` : ''}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 xl:items-end">
          <span className="text-xs text-[var(--muted)]">Updated {formatDateTime(pending.updatedAt || pending.createdAt)}</span>
          <div className="flex flex-wrap gap-2 xl:justify-end">
            {canResumeUpload && (
              <button
                type="button"
                onClick={() => onResume(pending)}
                disabled={resumeBusy}
                className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg bg-mint px-3 text-xs font-semibold text-[#05130d] disabled:opacity-60"
              >
                {resumeBusy ? <Loader2 size={14} className="animate-spin" /> : progress.status === 'failed_upload' ? <RotateCcw size={14} /> : <PlayCircle size={14} />}
                {resumeLabel}
              </button>
            )}
            {handoffBusy && (
              <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-300/30 bg-blue-300/10 px-3 text-xs font-semibold text-blue-200">
                <Loader2 size={14} className="animate-spin" />
                Dispatching
              </span>
            )}
            {canPauseUpload && (
              <button
                type="button"
                onClick={() => onPause(pending)}
                disabled={pauseBusy}
                className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg border border-gold/40 px-3 text-xs font-semibold text-gold hover:bg-gold/10 disabled:opacity-60"
              >
                {pauseBusy ? <Loader2 size={14} className="animate-spin" /> : <PauseCircle size={14} />}
                Pause
              </button>
            )}
            {canManage && (
              <button
                type="button"
                onClick={() => onCancel(pending)}
                disabled={cancelBusy}
                className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg border border-rose/40 px-3 text-xs font-semibold text-rose hover:bg-rose/10 disabled:opacity-60"
              >
                {cancelBusy ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                Cancel
              </button>
            )}
          </div>
          <p className="max-w-xs text-right text-xs text-[var(--muted)]">
            {statusDescription}
          </p>
        </div>
      </div>

      <div className="grid gap-2 border-t border-[var(--border)] p-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map(item => (
          <PendingMediaRow key={item.uploadKey || item.mediaAssetId || item.localId} item={item} />
        ))}
      </div>
    </article>
  );
}

function PendingMediaRow({ item }) {
  const bytesUploaded = getPendingItemDisplayBytes(item);
  const verifiedBytes = getPendingItemVerifiedBytes(item);
  const percent = item.size ? (bytesUploaded / Number(item.size)) * 100 : item.status === 'completed' ? 100 : 0;
  const meta = getPendingItemMeta(item);
  const speedText = formatThroughput(item.uploadSpeedBytesPerSecond);
  const failureText = item.failureReason || item.errorMessage || '';
  const detailText = speedText || (
    item.mediaAssetId
      ? 'cloud verified'
      : item.status === 'failed'
        ? failureText || 'needs retry'
      : item.status === 'completed' || (item.sessionId && (isPendingItemAtCloudSize(item) || isPendingItemSentToCloudSize(item)))
        ? 'verifying'
      : item.sessionId ? compactId(item.sessionId) : 'not started'
  );
  const verifiedText = item.status === 'uploading' && verifiedBytes < bytesUploaded
    ? `verified ${formatBytes(verifiedBytes)}`
    : '';

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface2)] p-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="min-w-0 truncate font-semibold text-[var(--text)]">{item.originalName || 'Media file'}</span>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 font-semibold ${meta.tone}`}>{meta.label}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface)]">
        <div className="h-full rounded-full bg-mint transition-all" style={{ width: formatPercent(percent) }} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-[var(--muted)]">
        <span>{formatBytes(bytesUploaded)} / {formatBytes(item.size)}</span>
        <span className="min-w-0 truncate text-right">{detailText}</span>
      </div>
      {verifiedText && (
        <p className="mt-1 text-[10px] text-[var(--muted)]">{verifiedText}</p>
      )}
    </div>
  );
}

function getPendingItemMeta(item) {
  if (item.mediaAssetId) return { label: 'Cloud', tone: 'border-mint/30 bg-mint/10 text-mint' };
  if (item.status === 'failed') return { label: 'Failed', tone: 'border-rose/30 bg-rose/10 text-rose' };
  if (item.status === 'completed' || (item.sessionId && (isPendingItemAtCloudSize(item) || isPendingItemSentToCloudSize(item)))) return { label: 'Verifying cloud', tone: 'border-blue-300/30 bg-blue-300/10 text-blue-200' };
  if (item.status === 'uploading') return { label: 'Cloud upload', tone: 'border-mint/30 bg-mint/10 text-mint' };
  if (item.status === 'paused') return { label: 'Paused', tone: 'border-gold/30 bg-gold/10 text-gold' };
  if (item.status === 'interrupted') return { label: 'Interrupted', tone: 'border-gold/30 bg-gold/10 text-gold' };
  return { label: 'Waiting', tone: 'border-sky-400/30 bg-sky-400/10 text-sky-300' };
}

function DispatchGroup({ group, canManage, busyKey, retentionLabel, onJobAction, onGroupAction, onDeleteGroup, onDeleteJob }) {
  const meta = getJobStatusMeta(group.status);
  const pauseJobs = getGroupActionJobs(group, 'pause');
  const resumeJobs = getGroupActionJobs(group, 'resume');
  const cancelJobs = getGroupActionJobs(group, 'cancel');
  const firstCaption = group.jobs.map(getJobCaption).find(Boolean);
  const firstMedia = group.jobs.map(getJobMedia).find(Boolean);

  return (
    <article className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <div className="grid gap-4 p-4 xl:grid-cols-[128px_minmax(0,1fr)_260px]">
        <MediaPreview media={firstMedia} emptyLabel={group.expiredCount > 0 ? 'Media expired' : 'Media cleared'} />

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-semibold ${meta.tone}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </span>
            <span className="text-xs text-[var(--muted)]">{compactId(group.id)}</span>
            <span className="text-xs text-[var(--muted)]">{formatDateTime(group.scheduledAt)}</span>
          </div>
          <h2 className="mt-3 line-clamp-2 text-base font-semibold text-[var(--text)]">{firstCaption || `Dispatch ${compactId(group.id)}`}</h2>

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
                  className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg border border-gold/40 px-3 text-xs font-semibold text-gold hover:bg-gold/10 disabled:opacity-60"
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
                  className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg bg-mint px-3 text-xs font-semibold text-[#05130d] disabled:opacity-60"
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
                  className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg border border-rose/40 px-3 text-xs font-semibold text-rose hover:bg-rose/10 disabled:opacity-60"
                >
                  <XCircle size={14} />
                  Cancel {cancelJobs.length}
                </button>
              )}
              <button
                type="button"
                onClick={() => onDeleteGroup(group)}
                disabled={busyKey === `delete:group:${group.id}`}
                className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg border border-rose/40 px-3 text-xs font-semibold text-rose hover:bg-rose/10 disabled:opacity-60"
              >
                {busyKey === `delete:group:${group.id}` ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete
              </button>
            </div>
          )}
          {canManage && !(pauseJobs.length > 0 || resumeJobs.length > 0 || cancelJobs.length > 0) && (
            <button
              type="button"
              onClick={() => onDeleteGroup(group)}
              disabled={busyKey === `delete:group:${group.id}`}
              className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg border border-rose/40 px-3 text-xs font-semibold text-rose hover:bg-rose/10 disabled:opacity-60"
            >
              {busyKey === `delete:group:${group.id}` ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Delete
            </button>
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
            onDeleteJob={onDeleteJob}
          />
        ))}
      </div>
    </article>
  );
}

function MediaPreview({ media, emptyLabel = 'No cloud media' }) {
  const wrapperClassName = 'aspect-video min-h-24 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface2)] xl:aspect-square xl:min-h-28';

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
        <video src={media.publicUrl} className="h-full w-full object-cover" controls muted playsInline preload="metadata" />
      ) : (
        <img src={media.publicUrl} alt={media.originalName || 'media'} className="h-full w-full object-cover" />
      )}
    </div>
  );
}

function PlatformPill({ job }) {
  const meta = getJobStatusMeta(job.temporaryMediaExpiredAt ? 'expired' : job.status);
  return (
    <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2 text-xs font-semibold ${meta.tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {formatPlatform(job.platform)}
    </span>
  );
}

function PlatformJobRow({ job, canManage, busyKey, retentionLabel, onJobAction, onDeleteJob }) {
  const meta = getJobStatusMeta(job.temporaryMediaExpiredAt ? 'expired' : job.status);
  const account = getJobAccount(job);
  const media = getJobMedia(job);
  const caption = getJobCaption(job);
  const providerProgress = getProviderUploadProgress(job);
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
  const stageLabel = getJobStageLabel(job);
  const stageText = job.mediaProcessing?.lastCompressionMessage || job.processingMessage || job.errorMessage || job.processingStage || job.status;
  const busy = action => busyKey === `${action}:${job._id}`;

  return (
    <div className="grid gap-3 border-t border-[var(--border)] px-4 py-3 first:border-t-0 xl:grid-cols-[minmax(170px,0.7fr)_minmax(0,1.35fr)_minmax(220px,auto)] xl:items-center">
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

      <div className="min-w-0">
        <p className="line-clamp-2 text-sm font-semibold text-[var(--text)]">{caption || 'No caption saved for this platform.'}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface2)] px-2 py-0.5 font-semibold text-[var(--text)]">
            {stageLabel}
          </span>
          <span className="min-w-0 flex-1 line-clamp-2 text-[var(--muted)]">{stageText}</span>
        </div>
        {providerProgress && (
          <div className="mt-2 max-w-2xl">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
              <span>
                {providerProgress.complete
                  ? `${formatPlatform(job.platform)} media upload complete`
                  : getProviderPhaseLabel(providerProgress.phase)}
              </span>
              {providerProgress.totalBytes > 0 ? (
                <span>
                  {formatBytes(providerProgress.bytesUploaded)} / {formatBytes(providerProgress.totalBytes)}
                  {providerProgress.bytesPerSecond > 0 ? ` · ${formatThroughput(providerProgress.bytesPerSecond)}` : ''}
                </span>
              ) : (
                <span>{formatPercent(providerProgress.percent)}</span>
              )}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--surface2)]">
              <div
                className={`h-full rounded-full transition-all ${providerProgress.complete ? 'bg-mint' : 'bg-gold'}`}
                style={{ width: formatPercent(providerProgress.percent) }}
              />
            </div>
          </div>
        )}
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
          <span className="inline-flex items-center gap-1">
            <Clock3 size={12} />
            {formatDateTime(job.scheduledAt)}
          </span>
          <span>{stageLabel}</span>
          {job.retryCount > 0 && <span>{job.retryCount} retries</span>}
          {job.mediaProcessing?.compressBeforeUpload && <span className="text-mint">compression enabled</span>}
          {controlAction && <span className="text-gold">{job.publishControl?.message || 'Control pending'}</span>}
          {temporaryMediaExpired && <span className="text-rose">Media expired after {retentionLabel}</span>}
          {!temporaryMediaExpired && temporaryMediaExpiresAt && (
            <span className="text-gold">Retry media until {temporaryMediaExpiresAt.toLocaleString()}</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 xl:justify-end">
        {media?.publicUrl && (
          <a
            href={media.publicUrl}
            target="_blank"
            rel="noreferrer"
            className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface2)]"
          >
            <Cloud size={14} />
            Media
          </a>
        )}
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
            className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg border border-gold/40 px-3 text-xs font-semibold text-gold hover:bg-gold/10 disabled:opacity-60"
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
            className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg bg-mint px-3 text-xs font-semibold text-[#05130d] disabled:opacity-60"
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
            className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg bg-gold px-3 text-xs font-semibold text-[#05130d] disabled:opacity-60"
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
            className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg border border-mint/40 px-3 text-xs font-semibold text-mint hover:bg-mint/10 disabled:opacity-60"
          >
            <TimerReset size={14} />
            Compress
          </button>
        )}
        {canCancel && (
          <button
            type="button"
            onClick={() => onJobAction({ job, action: 'cancel' })}
            disabled={busy('cancel')}
            className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg border border-rose/40 px-3 text-xs font-semibold text-rose hover:bg-rose/10 disabled:opacity-60"
          >
            <XCircle size={14} />
            Cancel
          </button>
        )}
        {canManage && (
          <button
            type="button"
            onClick={() => onDeleteJob(job)}
            disabled={busyKey === `delete:job:${job._id}`}
            className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg border border-rose/40 px-3 text-xs font-semibold text-rose hover:bg-rose/10 disabled:opacity-60"
          >
            {busyKey === `delete:job:${job._id}` ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
