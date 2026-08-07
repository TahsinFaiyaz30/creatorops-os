'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Cloud,
  ExternalLink,
  FileCheck2,
  Globe,
  ImageOff,
  Layers3,
  Loader2,
  MonitorSmartphone,
  PauseCircle,
  PlayCircle,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Server,
  ShieldAlert,
  ShieldCheck,
  TimerReset,
  Trash2,
  UploadCloud,
  X,
  XCircle
} from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { TextGenerateEffect } from '../../components/ui/text-generate-effect';
import { BackgroundBeams } from '../../components/ui/background-beams';
import {
  Page, Section, Badge, Button, Input,
  EmptyState, Notice, GlareStat, GlareStatGrid, GLARE_TINTS
} from '../../components/ds';
import { useToastState } from '../../components/ui/toast';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { getUser, getUserId } from '../../lib/auth';
import { formatDuration } from '../../lib/duration';
import { formatPlatform } from '../../lib/platforms';
import { canPublish } from '../../lib/roles';
import {
  broadcastPendingPublishUpdate,
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

const EASE = [0.16, 1, 0.3, 1];

/* Populated refs come back as objects; the validate endpoint wants raw ids. */
const idOf = value => (value && typeof value === 'object' ? value._id : value) || '';

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
const DEFAULT_RETRY_RETENTION_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_STORAGE_HARD_DELETE_SECONDS = 30 * 24 * 60 * 60;

const getUploadHardDeleteSeconds = settings =>
  settings?.temporaryUploadHardDeleteSeconds ??
  settings?.temporaryMediaStorageHardDeleteSeconds ??
  DEFAULT_STORAGE_HARD_DELETE_SECONDS;

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

const getJobStorageHardDeleteAt = job => {
  const timestamps = (job.mediaAssetIds || [])
    .map(asset => (asset && typeof asset === 'object' && asset.storageHardDeleteAt ? new Date(asset.storageHardDeleteAt).getTime() : 0))
    .filter(timestamp => Number.isFinite(timestamp) && timestamp > 0);
  if (timestamps.length === 0) return null;
  return new Date(Math.min(...timestamps));
};

const isPopulatedRef = value => value && typeof value === 'object' && !Array.isArray(value);

const hasRenderableMediaAssets = mediaAssets =>
  Array.isArray(mediaAssets) && mediaAssets.some(asset => isPopulatedRef(asset) && asset.publicUrl);

const mergeRealtimePublishJob = (existing, incoming) => {
  if (!existing) return incoming;

  return {
    ...existing,
    ...incoming,
    platformConnectionId: isPopulatedRef(incoming.platformConnectionId)
      ? incoming.platformConnectionId
      : existing.platformConnectionId || incoming.platformConnectionId,
    mediaAssetIds: hasRenderableMediaAssets(incoming.mediaAssetIds)
      ? incoming.mediaAssetIds
      : existing.mediaAssetIds || incoming.mediaAssetIds,
    variantId: isPopulatedRef(incoming.variantId) ? incoming.variantId : existing.variantId || incoming.variantId,
    contentItemId: isPopulatedRef(incoming.contentItemId) ? incoming.contentItemId : existing.contentItemId || incoming.contentItemId,
    createdBy: isPopulatedRef(incoming.createdBy) ? incoming.createdBy : existing.createdBy || incoming.createdBy
  };
};

const sortPublishJobs = jobs =>
  [...jobs].sort((a, b) =>
    getTimestamp(b.scheduledAt || b.createdAt || b.updatedAt) - getTimestamp(a.scheduledAt || a.createdAt || a.updatedAt)
  );

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
  if (job.temporaryMediaExpiredAt && job.temporaryMediaExpiryReason === 'storage_hard_delete') return 'Storage hard-deleted media';
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
  item.storageHardDeleteAt = session.storageHardDeleteAt || item.storageHardDeleteAt || '';
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
  /* A stalled transfer is standing state — it stays inline, under the uploads
     it is about. Everything else here is an event, so it toasts. */
  const [pendingUploadError, setPendingUploadError] = useState('');
  const [message, setMessage] = useToastState('info');
  const [busyKey, setBusyKey] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [publishSettings, setPublishSettings] = useState({
    temporaryMediaRetentionSeconds: DEFAULT_RETRY_RETENTION_SECONDS,
    temporaryMediaStorageHardDeleteSeconds: DEFAULT_STORAGE_HARD_DELETE_SECONDS,
    temporaryUploadHardDeleteSeconds: DEFAULT_STORAGE_HARD_DELETE_SECONDS
  });
  const [lastUpdated, setLastUpdated] = useState(null);
  const [liveTransport, setLiveTransport] = useState('connecting');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const uploadControlsRef = useRef(new Map());
  const autoResumeIdsRef = useRef(new Set());
  const pendingPersistTimersRef = useRef(new Map());
  const pendingPersistPayloadsRef = useRef(new Map());
  const serverRefreshTimerRef = useRef(null);
  const requestServerStateRefreshRef = useRef(() => {});

  const sortPendingUploads = items =>
    [...items].sort((a, b) => getTimestamp(b.updatedAt || b.createdAt) - getTimestamp(a.updatedAt || a.createdAt));

  const upsertPendingUploadState = useCallback(pending => {
    setPendingUploads(current => {
      const existing = current.find(item => item.id === pending.id);
      const next = current.filter(item => item.id !== pending.id);
      next.push(mergePendingPublishRecords(existing || null, pending));
      return sortPendingUploads(next);
    });
    setLastUpdated(new Date());
  }, []);

  const removePendingUploadState = useCallback(pendingId => {
    setPendingUploads(current => current.filter(item => item.id !== pendingId));
  }, []);

  const flushPendingUploadPersist = useCallback(async pendingId => {
    const key = String(pendingId || '');
    const pending = pendingPersistPayloadsRef.current.get(key);
    if (!pending) return;
    pendingPersistPayloadsRef.current.delete(key);
    const timer = pendingPersistTimersRef.current.get(key);
    if (timer) window.clearTimeout(timer);
    pendingPersistTimersRef.current.delete(key);
    await putPendingPublish(pending);
  }, []);

  const persistPendingUpload = useCallback(async (pending, { immediate = true } = {}) => {
    if (!pending?.id) return;
    upsertPendingUploadState(pending);
    broadcastPendingPublishUpdate(pending);

    const key = String(pending.id);
    if (immediate) {
      pendingPersistPayloadsRef.current.delete(key);
      const timer = pendingPersistTimersRef.current.get(key);
      if (timer) window.clearTimeout(timer);
      pendingPersistTimersRef.current.delete(key);
      await putPendingPublish(pending);
      return;
    }

    pendingPersistPayloadsRef.current.set(key, pending);
    if (pendingPersistTimersRef.current.has(key)) return;
    const timer = window.setTimeout(() => {
      flushPendingUploadPersist(key).catch(() => {});
    }, 500);
    pendingPersistTimersRef.current.set(key, timer);
  }, [flushPendingUploadPersist, upsertPendingUploadState]);

  const applyRealtimePublishUpdate = useCallback(payload => {
    if (!payload) return;

    if (payload.deleted) {
      const deletedJobIds = new Set((payload.publishJobIds || []).map(String));
      setJobs(current => current.filter(job => !deletedJobIds.has(String(job._id))));
      setLastUpdated(new Date());
      return;
    }

    const jobId = payload._id ? String(payload._id) : '';
    if (!jobId) return;

    setJobs(current => {
      const existingIndex = current.findIndex(job => String(job._id) === jobId);
      if (existingIndex === -1) {
        requestServerStateRefreshRef.current();
        return sortPublishJobs([payload, ...current]);
      }

      const next = [...current];
      next[existingIndex] = mergeRealtimePublishJob(next[existingIndex], payload);
      return sortPublishJobs(next);
    });
    setLastUpdated(new Date());
  }, []);

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

  useEffect(() => () => {
    for (const timer of pendingPersistTimersRef.current.values()) {
      window.clearTimeout(timer);
    }
    pendingPersistTimersRef.current.clear();
    pendingPersistPayloadsRef.current.clear();
    if (serverRefreshTimerRef.current) {
      window.clearTimeout(serverRefreshTimerRef.current);
      serverRefreshTimerRef.current = null;
    }
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

  useEffect(() => {
    requestServerStateRefreshRef.current = () => {
      if (serverRefreshTimerRef.current) window.clearTimeout(serverRefreshTimerRef.current);
      serverRefreshTimerRef.current = window.setTimeout(() => {
        serverRefreshTimerRef.current = null;
        loadServerState().catch(() => {});
      }, 250);
    };
  }, [loadServerState]);

  const loadPendingUploads = useCallback(async currentUser => {
    try {
      const owner = currentUser || user;
      const ownerId = getUserId(owner);
      const pendingItems = await getPendingPublishes();
      const ownedPendingItems = pendingItems.filter(item => !ownerId || !item.userId || item.userId === ownerId);
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
  }, [user?.id, user?._id]);

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
    const handlePublishJobUpdate = payload => applyRealtimePublishUpdate(payload);
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
        for (const pending of pendingItems) {
          upsertPendingUploadState(pending);
        }
      }
    };
    const handleConnect = () => setLiveTransport('socket');
    const handleDisconnect = () => setLiveTransport('polling');
    if (socket.connected) handleConnect();
    socket.on('publishing:job_updated', handlePublishJobUpdate);
    socket.on('media:upload_session_updated', handleMediaUploadSession);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleDisconnect);
    return () => {
      socket.off('publishing:job_updated', handlePublishJobUpdate);
      socket.off('media:upload_session_updated', handleMediaUploadSession);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleDisconnect);
    };
  }, [applyRealtimePublishUpdate, loadPendingUploads, loadServerState]);

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
        removePendingUploadState(pendingId);
        return;
      }
      if (event.type === 'pending_publish_updated' && pendingId) {
        const latestPending = event.pending || (await getPendingPublishes().catch(() => [])).find(item => String(item.id) === pendingId);
        if (!latestPending) {
          stopActiveControlForPending(pendingId, { cancelled: true });
        } else if (latestPending.pauseReason === 'user') {
          stopActiveControlForPending(pendingId, { paused: true });
        }
        if (latestPending) upsertPendingUploadState(latestPending);
        return;
      }
    });
    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') loadPendingUploads().catch(() => {});
    };
    document.addEventListener('visibilitychange', visibilityHandler);
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', visibilityHandler);
    };
  }, [loadPendingUploads, removePendingUploadState, upsertPendingUploadState]);

  useEffect(() => {
    if (liveTransport === 'socket') return undefined;

    const refreshLiveServerState = () => {
      if (document.visibilityState !== 'visible') return;
      loadServerState().catch(() => {});
    };
    const intervalId = window.setInterval(refreshLiveServerState, 1000);
    refreshLiveServerState();
    return () => {
      window.clearInterval(intervalId);
    };
  }, [liveTransport, loadServerState]);

  useEffect(() => {
    const focusHandler = () => {
      loadServerState().catch(() => {});
      loadPendingUploads().catch(() => {});
    };
    window.addEventListener('focus', focusHandler);
    return () => {
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
  const temporaryMediaRetentionLabel = formatDuration(publishSettings.temporaryMediaRetentionSeconds ?? DEFAULT_RETRY_RETENTION_SECONDS);
  const temporaryMediaHardDeleteLabel = formatDuration(
    getUploadHardDeleteSeconds(publishSettings)
  );
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
      await persistPendingUpload({
        ...pending,
        mediaItems,
        pauseReason: 'user'
      });
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
            persistPendingUpload(pending, { immediate: false }).catch(() => {});
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

  /*
   * POST /api/publish/validate was the last endpoint no client code called.
   * A failed job could only be retried blind — same payload, same failure, one
   * more burnt retry. Pre-flight runs the connector's real validation (token
   * health, approval state, media policy, visibility, caption limits) and says
   * what will happen before you spend the retry.
   */
  const [preflight, setPreflight] = useState({});

  const runPreflight = async job => {
    const id = String(job._id);
    setPreflight(current => ({ ...current, [id]: { loading: true } }));
    try {
      const payload = await api.post('/api/publish/validate', {
        platformConnectionId: idOf(job.platformConnectionId),
        variantId: idOf(job.variantId) || null,
        contentItemId: idOf(job.contentItemId) || null,
        mediaAssetIds: (job.mediaAssetIds || []).map(idOf).filter(Boolean),
        caption: getJobCaption(job),
        visibility: job.visibility || 'public',
        targetPlatform: job.platform,
        postGroupId: job.postGroupId || ''
      });
      const validation = payload.data.validation || {};
      setPreflight(current => ({
        ...current,
        [id]: {
          ok: Boolean(validation.ok),
          code: validation.code || '',
          message: validation.message || (validation.ok ? 'This target will accept the retry.' : 'Validation failed.'),
          at: Date.now()
        }
      }));
    } catch (err) {
      setPreflight(current => ({
        ...current,
        [id]: { ok: false, code: 'REJECTED', message: err.message, at: Date.now() }
      }));
    }
  };

  const railStages = [
    { key: 'browser', label: 'This browser', icon: MonitorSmartphone, value: stats.uploading, hint: 'Resumable chunks' },
    { key: 'cloud', label: 'Cloud media', icon: Cloud, value: stats.queued, hint: 'Verified & queued' },
    { key: 'provider', label: 'Platform', icon: Server, value: stats.processing, hint: 'Provider ingest' },
    { key: 'live', label: 'Live', icon: Globe, value: stats.published, hint: 'Post URL returned' }
  ];

  const liveLabel = liveTransport === 'socket' ? 'Live socket' : liveTransport === 'polling' ? 'Live polling' : 'Connecting';

  return (
    <AppShell>
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <BackgroundBeams className="opacity-25 dark:opacity-50" />
        <div className="absolute inset-0 bg-blueprint [mask-image:radial-gradient(ellipse_at_top,black_10%,transparent_70%)]" />
      </div>

      <Page>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
              Distribute
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
              Post Dispatch
            </h1>
            <div className="max-w-3xl">
              <TextGenerateEffect
                words="Every publish, from the first byte leaving this browser to the live post URL. Uploads resume from their own verified offset, so closing the tab never costs you the transfer."
                className="font-normal"
                duration={0.5}
              />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button as="a" href="/compose" variant="primary" size="sm">
              <Send className="h-3.5 w-3.5" />
              Compose
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => load().catch(err => setMessage(err.message))}
              title="Refresh"
              aria-label="Refresh dispatches"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <GlareStatGrid>
          <GlareStat label="Uploading"   value={stats.uploading}    icon={UploadCloud}   tint={GLARE_TINTS[0]} hint="Browser → cloud" />
          <GlareStat label="Queued"      value={stats.queued}       icon={Clock3}        tint={GLARE_TINTS[1]} hint="Waiting on worker" />
          <GlareStat label="Processing"  value={stats.processing}   icon={Activity}      tint={GLARE_TINTS[2]} hint="Provider ingest" />
          <GlareStat label="Needs you"   value={stats.review}       icon={AlertTriangle} tint={GLARE_TINTS[3]} hint="Failed or blocked" />
          <GlareStat label="Published"   value={stats.published}    icon={CheckCircle2}  tint={GLARE_TINTS[4]} hint="Fully released" />
        </GlareStatGrid>

        <PipelineRail
          stages={railStages}
          liveLabel={liveLabel}
          transport={liveTransport}
          lastUpdated={lastUpdated}
          platformJobs={stats.platformJobs}
          intakeCount={pendingUploads.length}
          retentionLabel={temporaryMediaRetentionLabel}
          hardDeleteLabel={temporaryMediaHardDeleteLabel}
        />

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-center">
          <div className="flex gap-1 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-1 backdrop-blur-xl">
            {dispatchFilters.map(filter => {
              const active = activeFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveFilter(filter.id)}
                  aria-pressed={active}
                  className={`focus-ring relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors ${
                    active ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {active ? (
                    <motion.span
                      layoutId="dispatch-filter-pill"
                      className="absolute inset-0 rounded-lg bg-[var(--accent-soft)] ring-1 ring-inset ring-[var(--accent-line)]"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  ) : null}
                  <span className="relative">{filter.label}</span>
                  <span
                    className={`relative rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                      active ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'bg-[var(--surface2)] text-[var(--muted)]'
                    }`}
                  >
                    {filterCounts[filter.id] || 0}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
            <Input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Platform, account, caption, stage…"
              aria-label="Search dispatches"
              className="pl-8"
            />
          </div>
        </div>

        {pendingUploadError ? <Notice tone="warning">{pendingUploadError}</Notice> : null}

        {visiblePendingUploads.length > 0 && (
          <Section
            title="Cloud upload intake"
            description="Media lands here before any publish job exists. Resume, pause or cancel the transfer from this device."
          >
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
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
              </AnimatePresence>
            </div>
          </Section>
        )}

        {visibleGroups.length > 0 && (
          <Section
            title="Platform dispatches"
            description={`Retry media expires ${temporaryMediaRetentionLabel} after a group stops being queued, publishing or paused. Storage hard-deletes temporary uploads ${temporaryMediaHardDeleteLabel} from upload start regardless.`}
          >
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {visibleGroups.map(group => (
                  <DispatchGroup
                    key={group.id}
                    group={group}
                    canManage={canManage}
                    busyKey={busyKey}
                    retentionLabel={temporaryMediaRetentionLabel}
                    hardDeleteLabel={temporaryMediaHardDeleteLabel}
                    preflight={preflight}
                    onPreflight={runPreflight}
                    onJobAction={runJobAction}
                    onGroupAction={runGroupAction}
                    onDeleteGroup={group => setDeleteTarget({ kind: 'group', group })}
                    onDeleteJob={job => setDeleteTarget({ kind: 'job', job })}
                  />
                ))}
              </AnimatePresence>
            </div>
          </Section>
        )}

        {!hasVisibleWork && (
          <EmptyState
            icon={Layers3}
            title={activeFilter === 'all' && !query ? 'Nothing in flight' : 'No dispatches match'}
            description={
              activeFilter === 'all' && !query
                ? 'Start a publish from Compose and it appears here the moment the first chunk leaves this browser — upload intake shows up before any platform job exists.'
                : 'Try another filter or clear the search.'
            }
            action={
              activeFilter === 'all' && !query ? (
                <Button as="a" href="/compose" variant="primary" size="sm">
                  <Send className="h-3.5 w-3.5" />
                  Compose a post
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => { setActiveFilter('all'); setQuery(''); }}>
                  Clear filters
                </Button>
              )
            }
          />
        )}

        <AnimatePresence>
          {deleteTarget ? (
            <DeleteDispatchModal
              target={deleteTarget}
              busyKey={busyKey}
              onClose={() => setDeleteTarget(null)}
              onConfirm={deleteDispatchTarget}
            />
          ) : null}
        </AnimatePresence>
      </Page>
    </AppShell>
  );
}

/* ── Publish path rail ────────────────────────────────────────────────────── */

function PipelineRail({ stages, liveLabel, transport, lastUpdated, platformJobs, intakeCount, retentionLabel, hardDeleteLabel }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-4 shadow-[var(--shadow)] backdrop-blur-xl sm:p-5"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(130%_130%_at_0%_0%,var(--accent-soft),transparent_58%)]"
      />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Publish path
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-2)]">
            Chunked upload → SHA-256 verify → provider ingest → live post
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-line)] bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-semibold text-[var(--accent)]">
            <span className="relative flex h-1.5 w-1.5">
              {transport !== 'connecting' ? (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-70" />
              ) : null}
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            </span>
            {liveLabel}
          </span>
          <span className="text-[10px] text-[var(--muted)]">
            {lastUpdated ? `Synced ${lastUpdated.toLocaleTimeString()}` : 'Waiting for first sync'}
          </span>
        </div>
      </div>

      <div className="relative mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stages.map((stage, index) => (
          <StageNode key={stage.key} stage={stage} index={index} last={index === stages.length - 1} />
        ))}
      </div>

      <div className="relative mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--border)] pt-3 text-[10px] text-[var(--muted)]">
        <span className="inline-flex items-center gap-1">
          <Layers3 className="h-3 w-3" />
          {platformJobs} platform {platformJobs === 1 ? 'job' : 'jobs'}
        </span>
        <span className="inline-flex items-center gap-1">
          <UploadCloud className="h-3 w-3" />
          {intakeCount} intake {intakeCount === 1 ? 'record' : 'records'}
        </span>
        <span className="inline-flex items-center gap-1">
          <TimerReset className="h-3 w-3" />
          Retry media {retentionLabel}
        </span>
        <span className="inline-flex items-center gap-1">
          <Trash2 className="h-3 w-3" />
          Hard delete {hardDeleteLabel}
        </span>
      </div>
    </motion.div>
  );
}

function StageNode({ stage, index, last }) {
  const active = stage.value > 0;
  const Icon = stage.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE, delay: 0.06 * index }}
      className={`relative rounded-xl border px-3 py-2.5 transition-colors ${
        active
          ? 'border-[var(--accent-line)] bg-[var(--accent-soft)]'
          : 'border-[var(--border)] bg-[var(--surface2)]/60'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
            active ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'bg-[var(--surface3)] text-[var(--muted)]'
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold text-[var(--text)]">{stage.label}</p>
          <p className="truncate text-[9px] uppercase tracking-wider text-[var(--muted)]">{stage.hint}</p>
        </div>
        <span
          className={`ml-auto text-lg font-bold tabular-nums ${
            active ? 'text-[var(--accent)]' : 'text-[var(--muted)]'
          }`}
        >
          {stage.value}
        </span>
      </div>

      {!last ? (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-2.5 top-1/2 hidden -translate-y-1/2 lg:block"
        >
          <ChevronRight className={`h-4 w-4 ${active ? 'text-[var(--accent)]' : 'text-[var(--border-strong)]'}`} />
        </span>
      ) : null}
    </motion.div>
  );
}

/* ── Shared bits ──────────────────────────────────────────────────────────── */

function Meter({ percent, tone = 'bg-[var(--accent)]', className = '' }) {
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-[var(--surface3)] ${className}`}>
      <motion.div
        className={`h-full rounded-full ${tone}`}
        initial={{ width: 0 }}
        animate={{ width: formatPercent(percent) }}
        transition={{ duration: 0.6, ease: EASE }}
      />
    </div>
  );
}

function StatusChip({ meta, spinning = false }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.tone}`}>
      {spinning ? (
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
      ) : (
        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      )}
      {meta.label}
    </span>
  );
}

function CardShell({ children, className = '' }) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.2 } }}
      transition={{ duration: 0.45, ease: EASE }}
      className={`relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/75 shadow-[var(--shadow)] backdrop-blur-xl ${className}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_70%_at_0%_0%,var(--accent-soft),transparent_55%)]"
      />
      <div className="relative">{children}</div>
    </motion.article>
  );
}

/* ── Delete dialog ────────────────────────────────────────────────────────── */

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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <motion.section
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(80%_100%_at_50%_0%,rgb(var(--danger-rgb)/0.16),transparent_70%)]"
        />

        <div className="relative border-b border-[var(--border)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-danger">Delete dispatch</p>
              <h2 className="mt-1 text-lg font-bold tracking-tight text-[var(--text)]">{title}</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close delete dialog">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
            Choose what each platform row should do. A row can be removed from CreatorOps only, or removed here after
            the provider delete API succeeds.
          </p>
        </div>

        <div className="relative max-h-[64vh] space-y-3 overflow-y-auto p-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface2)]/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {isGroup ? (
                <h3 className="text-xs font-semibold text-[var(--text)]">Platforms in this post</h3>
              ) : (
                <span />
              )}
              <div className="flex flex-wrap gap-1.5">
                {isGroup ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setSelectedJobIds(jobs.map(job => String(job._id)))}>
                      All
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setSelectedJobIds([])}>
                      None
                    </Button>
                  </>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => setDeleteModes(buildInitialDeleteModes(jobs))}>
                  Here only
                </Button>
                <Button size="sm" variant="ghost" onClick={setSupportedJobsToPlatform}>
                  Platform too
                </Button>
              </div>
            </div>

            <div className="mt-3 grid gap-2">
              {jobs.map(job => {
                const account = getJobAccount(job);
                const checked = selectedJobIds.includes(String(job._id));
                const support = getPlatformDeleteSupport(job);
                const mode = deleteModes[String(job._id)] || 'local';
                return (
                  <div
                    key={job._id}
                    className={`rounded-xl border p-3 transition-colors ${
                      checked ? 'border-[var(--accent-line)] bg-[var(--surface)]' : 'border-[var(--border)] bg-[var(--surface)]/60'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleJob(job._id)}
                        aria-label={`Include ${formatPlatform(job.platform)}`}
                        className="focus-ring mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-[var(--text)]">
                            {formatPlatform(job.platform)}
                          </span>
                          <Badge tone={job.providerPostId ? 'accent' : 'neutral'}>
                            {job.providerPostId ? 'platform post' : 'CreatorOps only'}
                          </Badge>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">
                          {account.accountHandle || account.accountName || 'account'} · {job.status}
                        </p>

                        <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => setJobMode(job._id, 'local')}
                            disabled={!checked}
                            className={`focus-ring rounded-lg border px-2.5 py-2 text-left transition-colors disabled:opacity-50 ${
                              mode === 'local'
                                ? 'border-[var(--accent-line)] bg-[var(--accent-soft)]'
                                : 'border-[var(--border)] hover:border-[var(--border-strong)]'
                            }`}
                          >
                            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text)]">
                              {mode === 'local' ? <Check className="h-3 w-3 text-[var(--accent)]" /> : null}
                              Delete here only
                            </span>
                            <span className="mt-0.5 block text-[10px] leading-relaxed text-[var(--muted)]">
                              Removes the CreatorOps record and local history.
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setJobMode(job._id, 'platform')}
                            disabled={!checked || !support.supported}
                            title={support.reason}
                            className={`focus-ring rounded-lg border px-2.5 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                              mode === 'platform'
                                ? 'border-[var(--accent-line)] bg-[var(--accent-soft)]'
                                : 'border-[var(--border)] hover:border-[var(--border-strong)]'
                            }`}
                          >
                            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text)]">
                              {mode === 'platform' ? <Check className="h-3 w-3 text-[var(--accent)]" /> : null}
                              Delete here + platform
                            </span>
                            <span className="mt-0.5 block text-[10px] leading-relaxed text-[var(--muted)]">
                              {support.reason}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {hasPublishing ? (
            <Notice tone="warning">
              Active publishing jobs must be paused or cancelled first, so the worker cannot finish a provider upload
              after the local record is gone.
            </Notice>
          ) : null}

          {selectedPlatformDeleteCount > 0 ? (
            <Notice tone="warning">
              {selectedPlatformDeleteCount} selected {selectedPlatformDeleteCount === 1 ? 'platform' : 'platforms'} will
              call provider delete APIs first. If a provider delete fails, CreatorOps keeps that record for review.
            </Notice>
          ) : null}
        </div>

        <div className="relative flex flex-col gap-2 border-t border-[var(--border)] p-4 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Keep
          </Button>
          <Button variant="danger" onClick={confirmDelete} disabled={!canConfirm}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete {selectedJobs.length} {selectedJobs.length === 1 ? 'platform' : 'platforms'}
          </Button>
        </div>
      </motion.section>
    </motion.div>
  );
}

/* ── Upload intake ────────────────────────────────────────────────────────── */

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
    if (failedTargetResults.length > 0) return 'One or more platform dispatches failed before a job was created. Retry or cancel from here.';
    if (progress.status === 'failed_upload') return failedUploadReason || 'Cloud upload or verification failed. Retry or cancel from here.';
    if (pending.pauseReason === 'user') return 'Paused by you. Resume when ready — the transfer picks up at the last verified chunk.';
    if (progress.status === 'interrupted_upload') return 'Interrupted transfer is saved. Resume from the last verified chunk.';
    if (progress.status === 'verifying_upload' && fullSizeUnverifiedCount > 0) return 'Bytes reached cloud storage. CreatorOps is verifying SHA-256 and linking the media asset.';
    if (progress.status === 'verifying_upload' && hasUnfinishedTargets) return 'Cloud media verified. Creating the remaining platform dispatches.';
    if (progress.status === 'verifying_upload') return 'Cloud media verified. Preparing platform dispatch.';
    if (progress.status === 'uploading_client') return 'Uploading from this browser to CreatorOps cloud storage.';
    return 'Files upload one at a time so each can resume from its own verified offset.';
  })();

  return (
    <CardShell>
      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip meta={meta} spinning={progress.status === 'uploading_client'} />
            <Badge tone="neutral">{pending.mode === 'schedule' ? 'Scheduled' : 'Publish now'}</Badge>
            <span className="font-mono text-[10px] text-[var(--muted)]">
              {compactId(pending.postGroupId || pending.id)}
            </span>
          </div>

          <h3 className="mt-2.5 line-clamp-2 text-sm font-bold leading-snug tracking-tight text-[var(--text)]">
            {firstCaption || `${items.length} media ${items.length === 1 ? 'file' : 'files'} → ${targets.length} ${targets.length === 1 ? 'target' : 'targets'}`}
          </h3>

          <div className="mt-3">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[var(--muted)]">
              <span className="font-semibold text-[var(--text-2)]">
                {progress.completedCount}/{progress.totalCount} in cloud
              </span>
              <span className="tabular-nums">
                {formatBytes(progress.uploadedBytes)} / {formatBytes(progress.totalBytes)}
                {progress.bytesPerSecond > 0 ? ` · ${formatThroughput(progress.bytesPerSecond)}` : ''}
              </span>
            </div>
            <Meter percent={progress.percent} />
          </div>

          {targets.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {targets.map(connection => (
                <span
                  key={connection.targetKey || `${connection.platform}-${connection.accountHandle}`}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface2)] px-2 py-0.5 text-[10px] text-[var(--text-2)]"
                >
                  <Radio className="h-2.5 w-2.5 text-[var(--accent)]" />
                  {formatPlatform(connection.platform)}
                  {connection.accountHandle ? (
                    <span className="text-[var(--muted)]">· {connection.accountHandle}</span>
                  ) : null}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 xl:items-end">
          <span className="text-[10px] text-[var(--muted)]">
            Updated {formatDateTime(pending.updatedAt || pending.createdAt)}
          </span>
          <div className="flex flex-wrap gap-1.5 xl:justify-end">
            {canResumeUpload ? (
              <Button size="sm" variant="primary" onClick={() => onResume(pending)} disabled={resumeBusy}>
                {resumeBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : progress.status === 'failed_upload' ? (
                  <RotateCcw className="h-3.5 w-3.5" />
                ) : (
                  <PlayCircle className="h-3.5 w-3.5" />
                )}
                {resumeLabel}
              </Button>
            ) : null}
            {handoffBusy ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent-line)] bg-[var(--accent-soft)] px-2.5 py-1.5 text-xs font-semibold text-[var(--accent)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Dispatching
              </span>
            ) : null}
            {canPauseUpload ? (
              <Button size="sm" variant="secondary" onClick={() => onPause(pending)} disabled={pauseBusy}>
                {pauseBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PauseCircle className="h-3.5 w-3.5" />}
                Pause
              </Button>
            ) : null}
            {canManage ? (
              <Button size="sm" variant="danger" onClick={() => onCancel(pending)} disabled={cancelBusy}>
                {cancelBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                Cancel
              </Button>
            ) : null}
          </div>
          <p className="max-w-[15rem] text-[10px] leading-relaxed text-[var(--muted)] xl:text-right">
            {statusDescription}
          </p>
        </div>
      </div>

      <div className="grid gap-2 border-t border-[var(--border)] bg-[var(--surface2)]/30 p-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map(item => (
          <PendingMediaRow key={item.uploadKey || item.mediaAssetId || item.localId} item={item} />
        ))}
      </div>
    </CardShell>
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
  const storageHardDeleteAt = item.storageHardDeleteAt ? new Date(item.storageHardDeleteAt) : null;
  const storageHardDeleteText = storageHardDeleteAt && !Number.isNaN(storageHardDeleteAt.getTime())
    ? `Hard delete ${storageHardDeleteAt.toLocaleString()}`
    : '';

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[11px] font-semibold text-[var(--text)]">
          {item.originalName || 'Media file'}
        </span>
        <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${meta.tone}`}>
          {meta.label}
        </span>
      </div>
      <Meter percent={percent} className="mt-2" />
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-[var(--muted)]">
        <span className="tabular-nums">{formatBytes(bytesUploaded)} / {formatBytes(item.size)}</span>
        <span className="min-w-0 truncate text-right">{detailText}</span>
      </div>
      {verifiedText ? <p className="mt-1 text-[10px] text-[var(--muted)]">{verifiedText}</p> : null}
      {storageHardDeleteText ? <p className="mt-1 text-[10px] text-warning">{storageHardDeleteText}</p> : null}
    </div>
  );
}

function getPendingItemMeta(item) {
  if (item.mediaAssetId) return { label: 'Cloud', tone: 'border-mint/30 bg-mint/10 text-mint' };
  if (item.status === 'failed') return { label: 'Failed', tone: 'border-rose/30 bg-rose/10 text-rose' };
  if (item.status === 'completed' || (item.sessionId && (isPendingItemAtCloudSize(item) || isPendingItemSentToCloudSize(item)))) return { label: 'Verifying', tone: 'border-cyan/30 bg-cyan/10 text-cyan' };
  if (item.status === 'uploading') return { label: 'Uploading', tone: 'border-mint/30 bg-mint/10 text-mint' };
  if (item.status === 'paused') return { label: 'Paused', tone: 'border-gold/30 bg-gold/10 text-gold' };
  if (item.status === 'interrupted') return { label: 'Interrupted', tone: 'border-gold/30 bg-gold/10 text-gold' };
  return { label: 'Waiting', tone: 'border-cyan/30 bg-cyan/10 text-cyan' };
}

/* ── Dispatch group ───────────────────────────────────────────────────────── */

function DispatchGroup({
  group, canManage, busyKey, retentionLabel, hardDeleteLabel,
  preflight, onPreflight, onJobAction, onGroupAction, onDeleteGroup, onDeleteJob
}) {
  const meta = getJobStatusMeta(group.status);
  const pauseJobs = getGroupActionJobs(group, 'pause');
  const resumeJobs = getGroupActionJobs(group, 'resume');
  const cancelJobs = getGroupActionJobs(group, 'cancel');
  const firstCaption = group.jobs.map(getJobCaption).find(Boolean);
  const firstMedia = group.jobs.map(getJobMedia).find(Boolean);
  const hasBulkActions = pauseJobs.length > 0 || resumeJobs.length > 0 || cancelJobs.length > 0;
  const [open, setOpen] = useState(true);

  return (
    <CardShell>
      <div className="grid gap-4 p-4 sm:grid-cols-[auto_minmax(0,1fr)] xl:grid-cols-[132px_minmax(0,1fr)_236px]">
        <MediaPreview media={firstMedia} emptyLabel={group.expiredCount > 0 ? 'Media expired' : 'Media cleared'} />

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip meta={meta} />
            <span className="font-mono text-[10px] text-[var(--muted)]">{compactId(group.id)}</span>
            <span className="inline-flex items-center gap-1 text-[10px] text-[var(--muted)]">
              <Clock3 className="h-2.5 w-2.5" />
              {formatDateTime(group.scheduledAt)}
            </span>
          </div>

          <h3 className="mt-2.5 line-clamp-2 text-sm font-bold leading-snug tracking-tight text-[var(--text)]">
            {firstCaption || `Dispatch ${compactId(group.id)}`}
          </h3>

          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[10px] text-[var(--muted)]">
                <span>{group.terminalCount}/{group.expectedTargetCount} finished</span>
                <span className="font-semibold text-[var(--text-2)]">
                  {group.publishedCount}/{group.expectedTargetCount} published
                </span>
              </div>
              <Meter percent={group.successPercent} />
            </div>
            <div className="flex flex-wrap gap-1.5 md:justify-end">
              {group.jobs.map(job => <PlatformPill key={job._id} job={job} />)}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2 xl:col-span-1 xl:items-end">
          <span className="text-[10px] text-[var(--muted)]">Updated {formatDateTime(group.latestUpdatedAt)}</span>
          {canManage ? (
            <div className="flex flex-wrap gap-1.5 xl:justify-end">
              {pauseJobs.length > 0 ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onGroupAction({ group, action: 'pause' })}
                  disabled={busyKey === `pause:group:${group.id}`}
                >
                  <PauseCircle className="h-3.5 w-3.5" />
                  Pause {pauseJobs.length}
                </Button>
              ) : null}
              {resumeJobs.length > 0 ? (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => onGroupAction({ group, action: 'resume' })}
                  disabled={busyKey === `resume:group:${group.id}`}
                >
                  <PlayCircle className="h-3.5 w-3.5" />
                  Resume {resumeJobs.length}
                </Button>
              ) : null}
              {cancelJobs.length > 0 ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onGroupAction({ group, action: 'cancel' })}
                  disabled={busyKey === `cancel:group:${group.id}`}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Cancel {cancelJobs.length}
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="danger"
                onClick={() => onDeleteGroup(group)}
                disabled={busyKey === `delete:group:${group.id}`}
              >
                {busyKey === `delete:group:${group.id}` ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Delete
              </Button>
            </div>
          ) : null}
          {!canManage && !hasBulkActions ? (
            <span className="text-[10px] text-[var(--muted)]">Read-only for your role</span>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        className="focus-ring flex w-full items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--surface2)]/40 px-4 py-2 text-left transition-colors hover:bg-[var(--surface2)]/70"
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          {group.jobs.length} platform {group.jobs.length === 1 ? 'target' : 'targets'}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-[var(--muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            {group.jobs.map(job => (
              <PlatformJobRow
                key={job._id}
                job={job}
                canManage={canManage}
                busyKey={busyKey}
                retentionLabel={retentionLabel}
                hardDeleteLabel={hardDeleteLabel}
                preflight={preflight[String(job._id)]}
                onPreflight={onPreflight}
                onJobAction={onJobAction}
                onDeleteJob={onDeleteJob}
              />
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </CardShell>
  );
}

function MediaPreview({ media, emptyLabel = 'No cloud media' }) {
  /* Was `aspect-video` at every width inside a column that is only 132px at xl
     and full-width below it — which stretched the thumbnail to ~660px tall and
     pushed each dispatch card past 1000px. Fixed square thumb, full column at xl. */
  const wrapper = 'group relative aspect-square w-24 shrink-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface2)] sm:w-28 xl:w-full';
  /* Storage hard-delete and expiry both leave a live publicUrl pointing at an
     object that is already gone, which otherwise renders as a broken glyph. */
  const [broken, setBroken] = useState(false);

  useEffect(() => { setBroken(false); }, [media?.publicUrl]);

  if (!media?.publicUrl || broken) {
    return (
      <div className={`${wrapper} flex flex-col items-center justify-center gap-1 border-dashed px-2 text-center`}>
        <ImageOff className="h-4 w-4 text-[var(--muted)]" />
        <span className="text-[10px] leading-tight text-[var(--muted)]">
          {broken ? 'Media unavailable' : emptyLabel}
        </span>
      </div>
    );
  }

  return (
    <div className={wrapper}>
      {media.mediaType === 'video' ? (
        <video
          src={media.publicUrl}
          className="h-full w-full object-cover"
          controls
          muted
          playsInline
          preload="metadata"
          onError={() => setBroken(true)}
        />
      ) : (
        <img
          src={media.publicUrl}
          alt={media.originalName || 'media'}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={() => setBroken(true)}
        />
      )}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"
      />
    </div>
  );
}

function PlatformPill({ job }) {
  const meta = getJobStatusMeta(job.temporaryMediaExpiredAt ? 'expired' : job.status);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {formatPlatform(job.platform)}
    </span>
  );
}

function PlatformJobRow({
  job, canManage, busyKey, retentionLabel, hardDeleteLabel,
  preflight, onPreflight, onJobAction, onDeleteJob
}) {
  const meta = getJobStatusMeta(job.temporaryMediaExpiredAt ? 'expired' : job.status);
  const account = getJobAccount(job);
  const media = getJobMedia(job);
  const caption = getJobCaption(job);
  const providerProgress = getProviderUploadProgress(job);
  const temporaryMediaExpired = Boolean(job.temporaryMediaExpiredAt);
  const temporaryMediaExpiryReason = job.temporaryMediaExpiryReason || '';
  const temporaryMediaExpiresAt = job.temporaryMediaExpiresAt ? new Date(job.temporaryMediaExpiresAt) : null;
  const storageHardDeleteAt = getJobStorageHardDeleteAt(job);
  const temporaryMediaExpiredMessage = temporaryMediaExpiryReason === 'storage_hard_delete'
    ? `Storage hard-deleted media after ${hardDeleteLabel} from upload start; retry is disabled.`
    : temporaryMediaExpiryReason === 'storage_unavailable'
      ? 'Temporary cloud media is unavailable; retry is disabled.'
      : `Media expired after ${retentionLabel}; retry is disabled.`;
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
  /* The chip, the detail line and the provider phase all resolve from the same
     stage, so an in-flight upload printed "Uploading to platform" three times. */
  const showStageText = stageText && normalizeText(stageText) !== normalizeText(stageLabel);
  const providerPhaseLabel = providerProgress ? getProviderPhaseLabel(providerProgress.phase) : '';
  const busy = action => busyKey === `${action}:${job._id}`;

  return (
    <div className="grid gap-3 border-t border-[var(--border)] px-4 py-3 first:border-t-0 xl:grid-cols-[minmax(160px,0.7fr)_minmax(0,1.35fr)_minmax(210px,auto)] xl:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip meta={meta} spinning={job.status === 'publishing'} />
          <span className="truncate text-xs font-bold text-[var(--text)]">{formatPlatform(job.platform)}</span>
        </div>
        <p className="mt-1 truncate text-[10px] text-[var(--muted)]">
          {account.accountHandle || account.accountName || 'account'} · {job.visibility || 'public'}
        </p>
      </div>

      <div className="min-w-0">
        <p className="line-clamp-2 text-xs leading-relaxed text-[var(--text-2)]">
          {caption || 'No caption saved for this platform.'}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface2)] px-1.5 py-0.5 font-semibold text-[var(--text)]">
            {stageLabel}
          </span>
          {showStageText ? (
            <span className="min-w-0 flex-1 line-clamp-2 text-[var(--muted)]">{stageText}</span>
          ) : null}
        </div>

        {providerProgress ? (
          <div className="mt-2 max-w-2xl">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[var(--muted)]">
              <span>
                {providerProgress.complete
                  ? `${formatPlatform(job.platform)} media upload complete`
                  : normalizeText(providerPhaseLabel) === normalizeText(stageLabel)
                    ? 'Media transfer'
                    : providerPhaseLabel}
              </span>
              {providerProgress.totalBytes > 0 ? (
                <span className="tabular-nums">
                  {formatBytes(providerProgress.bytesUploaded)} / {formatBytes(providerProgress.totalBytes)}
                  {providerProgress.bytesPerSecond > 0 ? ` · ${formatThroughput(providerProgress.bytesPerSecond)}` : ''}
                </span>
              ) : (
                <span className="tabular-nums">{formatPercent(providerProgress.percent)}</span>
              )}
            </div>
            <Meter
              percent={providerProgress.percent}
              tone={providerProgress.complete ? 'bg-[var(--accent)]' : 'bg-warning'}
            />
          </div>
        ) : null}

        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[var(--muted)]">
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-2.5 w-2.5" />
            {formatDateTime(job.scheduledAt)}
          </span>
          {job.retryCount > 0 ? <span>{job.retryCount} retries</span> : null}
          {job.mediaProcessing?.compressBeforeUpload ? <span className="text-[var(--accent)]">compression on</span> : null}
          {controlAction ? <span className="text-warning">{job.publishControl?.message || 'Control pending'}</span> : null}
          {temporaryMediaExpired ? <span className="text-danger">{temporaryMediaExpiredMessage}</span> : null}
          {!temporaryMediaExpired && temporaryMediaExpiresAt ? (
            <span className="text-warning">Retry media until {temporaryMediaExpiresAt.toLocaleString()}</span>
          ) : null}
          {!temporaryMediaExpired && storageHardDeleteAt ? (
            <span className="text-warning">Storage hard delete {storageHardDeleteAt.toLocaleString()}</span>
          ) : null}
        </div>

        {/* Pre-flight verdict — POST /api/publish/validate */}
        <AnimatePresence initial={false}>
          {preflight ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="overflow-hidden"
            >
              <div
                className={`mt-2 rounded-lg border px-2.5 py-1.5 ${
                  preflight.loading
                    ? 'border-[var(--border)] bg-[var(--surface2)]'
                    : preflight.ok
                      ? 'border-success/30 bg-success/10'
                      : 'border-danger/30 bg-danger/10'
                }`}
              >
                <p
                  className={`flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider ${
                    preflight.loading ? 'text-[var(--muted)]' : preflight.ok ? 'text-success' : 'text-danger'
                  }`}
                >
                  {preflight.loading ? (
                    <>
                      <Loader2 className="h-2.5 w-2.5 animate-spin" /> Running pre-flight
                    </>
                  ) : preflight.ok ? (
                    <>
                      <ShieldCheck className="h-2.5 w-2.5" /> Pre-flight passed
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="h-2.5 w-2.5" /> {preflight.code || 'Pre-flight failed'}
                    </>
                  )}
                </p>
                {!preflight.loading && preflight.message ? (
                  <p
                    className={`mt-0.5 text-[10px] leading-relaxed ${
                      preflight.ok ? 'text-success/90' : 'text-danger/90'
                    }`}
                  >
                    {preflight.message}
                  </p>
                ) : null}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap gap-1.5 xl:justify-end">
        {media?.publicUrl ? (
          <Button as="a" size="sm" variant="ghost" href={media.publicUrl} target="_blank" rel="noreferrer">
            <Cloud className="h-3.5 w-3.5" />
            Media
          </Button>
        ) : null}
        {job.providerPostUrl ? (
          <Button as="a" size="sm" variant="secondary" href={job.providerPostUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            Open post
          </Button>
        ) : null}
        {canRetry ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onPreflight(job)}
            disabled={preflight?.loading}
            title="Validate this target against the platform before spending a retry"
          >
            <FileCheck2 className="h-3.5 w-3.5" />
            Pre-flight
          </Button>
        ) : null}
        {canPause ? (
          <Button size="sm" variant="secondary" onClick={() => onJobAction({ job, action: 'pause' })} disabled={busy('pause')}>
            <PauseCircle className="h-3.5 w-3.5" />
            Pause
          </Button>
        ) : null}
        {canResume ? (
          <Button size="sm" variant="primary" onClick={() => onJobAction({ job, action: 'resume' })} disabled={busy('resume')}>
            <PlayCircle className="h-3.5 w-3.5" />
            Resume
          </Button>
        ) : null}
        {canRetry ? (
          <Button size="sm" variant="primary" onClick={() => onJobAction({ job, action: 'retry' })} disabled={busy('retry')}>
            <RotateCcw className="h-3.5 w-3.5" />
            Retry
          </Button>
        ) : null}
        {canRetryWithCompression ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onJobAction({ job, action: 'retry', options: { mediaProcessing: { compressOnOversize: true, compressBeforeUpload: true } } })}
            disabled={busy('retry')}
          >
            <TimerReset className="h-3.5 w-3.5" />
            Compress
          </Button>
        ) : null}
        {canCancel ? (
          <Button size="sm" variant="ghost" onClick={() => onJobAction({ job, action: 'cancel' })} disabled={busy('cancel')}>
            <XCircle className="h-3.5 w-3.5" />
            Cancel
          </Button>
        ) : null}
        {canManage ? (
          <Button
            size="sm"
            variant="danger"
            onClick={() => onDeleteJob(job)}
            disabled={busyKey === `delete:job:${job._id}`}
            aria-label={`Delete ${formatPlatform(job.platform)} dispatch`}
            title="Delete this platform row"
          >
            {busyKey === `delete:job:${job._id}` ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
