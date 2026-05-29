'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { getToken, getUser } from '../../lib/auth';
import { canPublish } from '../../lib/roles';
import {
  broadcastPendingPublishUpdate,
  deletePendingPublish,
  deleteUploadFile,
  getPendingPublishes,
  getUploadFile,
  getUploadSession,
  pauseUploadSession,
  putPendingPublish,
  runWithUploadWorkerLock,
  subscribeUploadStateChanges,
  uploadFileResumable
} from '../../lib/resumableUploads';

const pendingMediaItems = pending => Array.isArray(pending?.mediaItems) ? pending.mediaItems : [];

const getConnectionTargetKey = connection =>
  connection.targetKey || `${connection.platformConnectionId || connection._id || 'connection'}:${connection.platform || 'platform'}`;

const acceptedTargetCountForPending = pending =>
  new Set((pending.results || []).filter(result => result.jobId).map(result => result.targetKey)).size;

const targetCountForPending = pending => (pending.selectedConnections || []).length;

const isPendingFullyHandedOff = pending => {
  const targetCount = targetCountForPending(pending);
  return targetCount > 0 && acceptedTargetCountForPending(pending) >= targetCount;
};

const hasTargetFailure = pending =>
  (pending.results || []).some(result => !result.jobId && (result.ok === false || ['blocked', 'failed'].includes(result.status)));

const shouldResumePending = pending => {
  if (!pending || pending.pauseReason === 'user') return false;
  if (isPendingFullyHandedOff(pending)) return false;
  if (hasTargetFailure(pending)) return false;
  if (targetCountForPending(pending) <= 0) return false;
  return pendingMediaItems(pending).some(item => !item.mediaAssetId) || acceptedTargetCountForPending(pending) < targetCountForPending(pending);
};

const getSessionMediaAssetId = session => session?.mediaAsset?._id || session?.mediaAsset?.id || '';

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

const isShaMismatchUploadError = error => String(error?.message || '').toLowerCase().includes('sha-256');
const isUploadPausedError = error => error?.code === 'UPLOAD_PAUSED' || String(error?.message || '').toLowerCase() === 'upload paused.';
const isMissingUploadFileError = error => error?.code === 'UPLOAD_FILE_UNAVAILABLE';
const isUploadSessionFailedError = error => error?.code === 'UPLOAD_SESSION_FAILED';

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

const compactPublishJobResult = ({ connection, publishJob, error }) => {
  const targetKey = getConnectionTargetKey(connection);
  if (error) {
    return {
      ok: false,
      targetKey,
      platform: connection.platform,
      accountHandle: connection.accountHandle,
      status: 'blocked',
      detail: error.message
    };
  }

  return {
    ok: !['blocked', 'failed'].includes(publishJob?.status),
    targetKey,
    platform: connection.platform,
    accountHandle: connection.accountHandle,
    status: publishJob?.status || 'queued',
    jobId: publishJob?._id,
    detail: publishJob?.errorMessage || publishJob?.processingMessage || `Job ${publishJob?.status || 'queued'}.`
  };
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

export default function PendingPublishWorker({ user = null }) {
  const [sessionUser, setSessionUser] = useState(user || null);
  const activeUser = user || sessionUser;
  const activeUserId = activeUser?._id || '';
  const canRun = Boolean(activeUserId && canPublish(activeUser) && getToken());
  const activeUserRef = useRef(activeUser);
  const controlsRef = useRef(new Map());
  const activeIdsRef = useRef(new Set());
  const scanTimerRef = useRef(null);
  const retryTimerRef = useRef(null);
  const persistTimersRef = useRef(new Map());
  const persistPayloadsRef = useRef(new Map());
  const continuePendingRef = useRef(null);
  const scanPendingUploadsRef = useRef(async () => {});

  useEffect(() => {
    activeUserRef.current = activeUser;
  }, [activeUser]);

  useEffect(() => {
    if (user) {
      setSessionUser(user);
    }
  }, [user]);

  useEffect(() => {
    if (user) return undefined;

    const syncSession = () => {
      setSessionUser(getToken() ? getUser() : null);
    };

    syncSession();
    window.addEventListener('creatorops:session-changed', syncSession);
    window.addEventListener('storage', syncSession);
    return () => {
      window.removeEventListener('creatorops:session-changed', syncSession);
      window.removeEventListener('storage', syncSession);
    };
  }, [user]);

  const flushPendingPersist = useCallback(async pendingId => {
    const key = String(pendingId || '');
    const pending = persistPayloadsRef.current.get(key);
    if (!pending) return;
    persistPayloadsRef.current.delete(key);
    const timer = persistTimersRef.current.get(key);
    if (timer) window.clearTimeout(timer);
    persistTimersRef.current.delete(key);
    await putPendingPublish(pending, { broadcast: false });
  }, []);

  const persistPending = useCallback(async (pending, { immediate = true } = {}) => {
    if (!pending?.id) return;
    broadcastPendingPublishUpdate(pending);

    const key = String(pending.id);
    if (immediate) {
      persistPayloadsRef.current.delete(key);
      const timer = persistTimersRef.current.get(key);
      if (timer) window.clearTimeout(timer);
      persistTimersRef.current.delete(key);
      await putPendingPublish(pending, { broadcast: false });
      return;
    }

    persistPayloadsRef.current.set(key, pending);
    if (persistTimersRef.current.has(key)) return;
    const timer = window.setTimeout(() => {
      flushPendingPersist(key).catch(() => {});
    }, 500);
    persistTimersRef.current.set(key, timer);
  }, [flushPendingPersist]);

  const cleanupPendingUploadRecord = useCallback(async pending => {
    await Promise.allSettled(pendingMediaItems(pending).filter(item => item.uploadKey).map(item => deleteUploadFile(item.uploadKey)));
    await deletePendingPublish(pending.id);
  }, []);

  const uploadMediaForPending = useCallback(async ({ pending, controlRef }) => {
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
          await persistPending(pending);
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
      await persistPending(pending);

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
            persistPending(pending).catch(() => {});
          },
          onProgress: session => {
            applyUploadSessionToPendingItem(item, session, { forceSpeedZero: false });
            item.uploadSpeedBytesPerSecond = session.uploadSpeedBytesPerSecond || 0;
            persistPending(pending, { immediate: false }).catch(() => {});
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
      await persistPending(pending);
    }

    return mediaAssetIds;
  }, [persistPending]);

  const createPublishJobsForPending = useCallback(async ({ pending, mediaAssetIds }) => {
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
        return compactPublishJobResult({ connection, publishJob: payload.data.publishJob });
      } catch (error) {
        return compactPublishJobResult({ connection, error });
      }
    }));

    for (const result of createdResults) {
      results = upsertTargetResult(results, result);
    }

    pending.results = results;
    await persistPending(pending);
    return results;
  }, [persistPending]);

  const scheduleScan = useCallback((delay = 0) => {
    if (scanTimerRef.current) window.clearTimeout(scanTimerRef.current);
    scanTimerRef.current = window.setTimeout(() => {
      scanTimerRef.current = null;
      scanPendingUploadsRef.current().catch(() => {});
    }, delay);
  }, []);

  const continuePending = useCallback(async (pending, { skipLock = false } = {}) => {
    if (!pending?.id || activeIdsRef.current.has(String(pending.id))) return;

    if (!skipLock) {
      const lockResult = await runWithUploadWorkerLock(pending.id, () =>
        continuePending(pending, { skipLock: true })
      );
      if (!lockResult.acquired) {
        scheduleScan(1000);
        return;
      }
      return lockResult.value;
    }

    if (pending.pauseReason === 'user') return;

    const pendingId = String(pending.id);
    activeIdsRef.current.add(pendingId);
    const controlRef = {
      current: {
        paused: false,
        cancelled: false,
        interrupted: false,
        abortController: null,
        currentSessionId: '',
        stopOnPause: true
      }
    };
    controlsRef.current.set(pendingId, controlRef);
    let shouldScanAfterFinish = true;

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
      await persistPending(pending);

      const mediaAssetIds = await uploadMediaForPending({ pending, controlRef });
      const results = await createPublishJobsForPending({ pending, mediaAssetIds });
      const acceptedCount = new Set(results.filter(result => result.jobId).map(result => result.targetKey)).size;
      const targetCount = targetCountForPending(pending);

      if (targetCount > 0 && acceptedCount >= targetCount) {
        await cleanupPendingUploadRecord(pending);
      } else {
        await persistPending(pending);
      }
    } catch (error) {
      if (isUploadPausedError(error) || controlRef.current.paused) {
        pending.pauseReason = 'user';
        pending.mediaItems = pendingMediaItems(pending).map(item =>
          item.mediaAssetId || item.status === 'completed'
            ? item
            : {
                ...item,
                status: 'paused'
              }
        );
        await persistPending(pending).catch(() => {});
        return;
      }

      if (controlRef.current.cancelled || String(error.message || '').toLowerCase().includes('cancelled')) {
        await cleanupPendingUploadRecord(pending).catch(() => {});
        return;
      }

      if ((isShaMismatchUploadError(error) || isMissingUploadFileError(error) || isUploadSessionFailedError(error)) && error.uploadItem) {
        error.uploadItem.sessionId = isShaMismatchUploadError(error) ? '' : error.uploadItem.sessionId;
        error.uploadItem.bytesUploaded = isShaMismatchUploadError(error) ? 0 : error.uploadItem.bytesUploaded;
        error.uploadItem.bytesSent = isShaMismatchUploadError(error) ? 0 : error.uploadItem.bytesSent;
        error.uploadItem.status = 'failed';
        error.uploadItem.mediaAssetId = '';
        error.uploadItem.uploadSpeedBytesPerSecond = 0;
        error.uploadItem.failureReason = error.message;
        pending.pauseReason = 'user';
        await persistPending(pending).catch(() => {});
        return;
      }

      markPendingInterrupted(pending);
      await persistPending(pending).catch(() => {});
      shouldScanAfterFinish = false;
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = window.setTimeout(() => {
        retryTimerRef.current = null;
        scheduleScan();
      }, 5000);
    } finally {
      controlsRef.current.delete(pendingId);
      activeIdsRef.current.delete(pendingId);
      if (shouldScanAfterFinish) scheduleScan(250);
    }
  }, [cleanupPendingUploadRecord, createPublishJobsForPending, persistPending, scheduleScan, uploadMediaForPending]);

  useEffect(() => {
    continuePendingRef.current = continuePending;
  }, [continuePending]);

  const scanPendingUploads = useCallback(async () => {
    const currentUser = activeUserRef.current;
    if (!currentUser?._id || !canPublish(currentUser) || !getToken()) return;

    const pendingItems = await getPendingPublishes().catch(() => []);
    const ownedItems = pendingItems.filter(item => !item.userId || item.userId === currentUser._id);
    const staleCompleted = ownedItems.filter(isPendingFullyHandedOff);
    if (staleCompleted.length > 0) {
      await Promise.allSettled(staleCompleted.flatMap(pending => [
        ...pendingMediaItems(pending).filter(item => item.uploadKey).map(item => deleteUploadFile(item.uploadKey)),
        deletePendingPublish(pending.id)
      ]));
    }

    const pending = ownedItems.find(item => shouldResumePending(item) && !activeIdsRef.current.has(String(item.id)));
    if (pending) {
      continuePendingRef.current?.({ ...pending });
    }
  }, []);

  useEffect(() => {
    scanPendingUploadsRef.current = scanPendingUploads;
  }, [scanPendingUploads]);

  useEffect(() => {
    if (!canRun) return undefined;

    scheduleScan();

    const handleUploadEvent = event => {
      const pendingId = event.pendingId ? String(event.pendingId) : '';
      if (event.type === 'pending_publish_deleted' && pendingId) {
        const controlRef = controlsRef.current.get(pendingId);
        if (controlRef?.current) {
          controlRef.current.cancelled = true;
          controlRef.current.paused = false;
          controlRef.current.abortController?.abort();
        }
        return;
      }

      if (event.type === 'pending_publish_updated' && event.pending?.pauseReason === 'user') {
        const controlRef = controlsRef.current.get(String(event.pending.id || pendingId));
        if (controlRef?.current) {
          controlRef.current.paused = true;
          controlRef.current.abortController?.abort();
          if (controlRef.current.currentSessionId) {
            pauseUploadSession(controlRef.current.currentSessionId).catch(() => {});
          }
        }
        return;
      }

      if (event.type === 'pending_publish_updated' || event.type === 'pending_publish_worker_released') {
        scheduleScan(250);
      }
    };

    const unsubscribe = subscribeUploadStateChanges(handleUploadEvent);
    const focusHandler = () => scheduleScan();
    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') scheduleScan();
    };

    window.addEventListener('focus', focusHandler);
    document.addEventListener('visibilitychange', visibilityHandler);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', focusHandler);
      document.removeEventListener('visibilitychange', visibilityHandler);
      if (scanTimerRef.current) window.clearTimeout(scanTimerRef.current);
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
      for (const timer of persistTimersRef.current.values()) {
        window.clearTimeout(timer);
      }
      persistTimersRef.current.clear();
      persistPayloadsRef.current.clear();
      for (const controlRef of controlsRef.current.values()) {
        controlRef.current.interrupted = true;
        controlRef.current.abortController?.abort();
      }
      controlsRef.current.clear();
      activeIdsRef.current.clear();
    };
  }, [activeUserId, canRun, scheduleScan]);

  return null;
}
