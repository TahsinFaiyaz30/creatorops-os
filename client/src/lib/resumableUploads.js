import { API_URL, api } from './api';
import { getToken } from './auth';

const DB_NAME = 'creatorops-resumable-uploads';
const DB_VERSION = 1;
const FILE_STORE = 'files';
const PUBLISH_STORE = 'pendingPublishes';
const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024;
const UPLOAD_EVENTS_CHANNEL = 'creatorops-upload-events';
const UPLOAD_WORKER_OWNER_KEY = 'creatorops-upload-worker-owner';
const UPLOAD_WORKER_LOCK_PREFIX = 'creatorops-upload-worker';
const UPLOAD_WORKER_LOCK_LEASE_MS = 30000;
const UPLOAD_WORKER_LOCK_HEARTBEAT_MS = 5000;

let uploadEventsChannel = null;
let uploadWorkerOwnerId = null;

const getUploadEventsChannel = () => {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!uploadEventsChannel) uploadEventsChannel = new BroadcastChannel(UPLOAD_EVENTS_CHANNEL);
  return uploadEventsChannel;
};

const broadcastUploadStateChange = payload => {
  const channel = getUploadEventsChannel();
  if (!channel) return;
  channel.postMessage({
    ...payload,
    emittedAt: new Date().toISOString()
  });
};

export const broadcastPendingPublishUpdate = pending => {
  if (!pending?.id) return;
  broadcastUploadStateChange({
    type: 'pending_publish_updated',
    pendingId: pending.id,
    pending
  });
};

export const subscribeUploadStateChanges = handler => {
  const channel = getUploadEventsChannel();
  if (!channel) return () => {};
  const listener = event => handler(event.data || {});
  channel.addEventListener('message', listener);
  return () => channel.removeEventListener('message', listener);
};

const createRandomId = prefix => {
  const randomValue = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 12);
  return `${prefix}-${randomValue}`;
};

const getUploadWorkerOwnerId = () => {
  if (uploadWorkerOwnerId) return uploadWorkerOwnerId;
  if (typeof sessionStorage !== 'undefined') {
    uploadWorkerOwnerId = sessionStorage.getItem(UPLOAD_WORKER_OWNER_KEY);
    if (!uploadWorkerOwnerId) {
      uploadWorkerOwnerId = createRandomId('tab');
      sessionStorage.setItem(UPLOAD_WORKER_OWNER_KEY, uploadWorkerOwnerId);
    }
    return uploadWorkerOwnerId;
  }
  uploadWorkerOwnerId = createRandomId('worker');
  return uploadWorkerOwnerId;
};

const getUploadWorkerLockKey = pendingId => `${UPLOAD_WORKER_LOCK_PREFIX}:${String(pendingId || '')}`;

const readLocalUploadWorkerLock = key => {
  if (typeof localStorage === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch (_error) {
    return null;
  }
};

const writeLocalUploadWorkerLock = (key, record) => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(record));
};

const clearLocalUploadWorkerLock = (key, token) => {
  if (typeof localStorage === 'undefined') return;
  const current = readLocalUploadWorkerLock(key);
  if (current?.token === token) localStorage.removeItem(key);
};

const acquireLocalUploadWorkerLock = pendingId => {
  if (typeof localStorage === 'undefined') {
    return {
      acquired: true,
      release: () => {}
    };
  }

  const key = getUploadWorkerLockKey(pendingId);
  const ownerId = getUploadWorkerOwnerId();
  const token = createRandomId(ownerId);
  const now = Date.now();
  const existing = readLocalUploadWorkerLock(key);

  if (existing?.expiresAt > now) {
    return { acquired: false, release: () => {} };
  }

  writeLocalUploadWorkerLock(key, {
    ownerId,
    token,
    pendingId,
    acquiredAt: new Date().toISOString(),
    expiresAt: now + UPLOAD_WORKER_LOCK_LEASE_MS
  });

  const confirmed = readLocalUploadWorkerLock(key);
  if (confirmed?.token !== token) return { acquired: false, release: () => {} };

  const heartbeat = window.setInterval(() => {
    const current = readLocalUploadWorkerLock(key);
    if (current?.token !== token) return;
    writeLocalUploadWorkerLock(key, {
      ...current,
      expiresAt: Date.now() + UPLOAD_WORKER_LOCK_LEASE_MS
    });
  }, UPLOAD_WORKER_LOCK_HEARTBEAT_MS);

  return {
    acquired: true,
    release: () => {
      window.clearInterval(heartbeat);
      clearLocalUploadWorkerLock(key, token);
    }
  };
};

export const runWithUploadWorkerLock = async (pendingId, task) => {
  if (!pendingId) {
    return {
      acquired: true,
      value: await task()
    };
  }

  const ownerId = getUploadWorkerOwnerId();
  const lockName = getUploadWorkerLockKey(pendingId);
  const runTask = async () => {
    broadcastUploadStateChange({ type: 'pending_publish_worker_acquired', pendingId, ownerId });
    try {
      return {
        acquired: true,
        value: await task()
      };
    } finally {
      broadcastUploadStateChange({ type: 'pending_publish_worker_released', pendingId, ownerId });
    }
  };

  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request(lockName, { mode: 'exclusive', ifAvailable: true }, lock =>
      lock ? runTask() : { acquired: false }
    );
  }

  const localLock = acquireLocalUploadWorkerLock(pendingId);
  if (!localLock.acquired) return { acquired: false };

  try {
    return await runTask();
  } finally {
    localLock.release();
  }
};

const openUploadDb = () =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('This browser does not support resumable upload recovery storage.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FILE_STORE)) db.createObjectStore(FILE_STORE, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(PUBLISH_STORE)) db.createObjectStore(PUBLISH_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const runStore = async (storeName, mode, operation) => {
  const db = await openUploadDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = operation(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
};

export const putUploadFile = (key, file) => runStore(FILE_STORE, 'readwrite', store => store.put({ key, file, updatedAt: new Date().toISOString() }));

export const getUploadFile = key => runStore(FILE_STORE, 'readonly', store => store.get(key)).then(record => record?.file || null);

export const deleteUploadFile = key => runStore(FILE_STORE, 'readwrite', store => store.delete(key));

const parseResponseBody = responseText => {
  try {
    return JSON.parse(responseText || '{}');
  } catch (_error) {
    return null;
  }
};

const uploadRawWithProgress = (path, body, { signal, headers = {}, onUploadProgress } = {}) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;

    const settle = (handler, value) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener?.('abort', abortHandler);
      handler(value);
    };

    const abortHandler = () => {
      xhr.abort();
      const error = new DOMException('Aborted', 'AbortError');
      settle(reject, error);
    };

    xhr.open('POST', `${API_URL}${path}`);
    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }

    xhr.upload.onprogress = event => {
      if (!event.lengthComputable) return;
      onUploadProgress?.({
        loaded: event.loaded,
        total: event.total
      });
    };
    xhr.onload = () => {
      const payload = parseResponseBody(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300) {
        settle(resolve, payload);
        return;
      }

      const error = new Error(payload?.message || `Request failed with ${xhr.status}`);
      error.status = xhr.status;
      settle(reject, error);
    };
    xhr.onerror = () => settle(reject, new Error('Network error while uploading media chunk.'));
    xhr.ontimeout = () => settle(reject, new Error('Media chunk upload timed out.'));
    xhr.onabort = () => {
      const error = new DOMException('Aborted', 'AbortError');
      settle(reject, error);
    };

    if (signal?.aborted) {
      abortHandler();
      return;
    }
    signal?.addEventListener?.('abort', abortHandler, { once: true });
    xhr.send(body);
  });

const pendingMediaItems = pending => Array.isArray(pending?.mediaItems) ? pending.mediaItems : [];

const getPendingMediaItemKey = item =>
  String(item?.uploadKey || item?.localId || item?.mediaAssetId || item?.sessionId || item?.originalName || '');

const shouldResetUploadItem = item =>
  !item?.mediaAssetId &&
  !item?.sessionId &&
  Number(item?.bytesUploaded || 0) === 0 &&
  ['waiting', 'failed'].includes(item?.status || '');

const mergePendingMediaItem = (existingItem = {}, incomingItem = {}) => {
  if (!existingItem || shouldResetUploadItem(incomingItem)) return { ...incomingItem };
  if (existingItem.mediaAssetId && !incomingItem.mediaAssetId) {
    return {
      ...incomingItem,
      mediaAssetId: existingItem.mediaAssetId,
      bytesUploaded: Number(incomingItem.size || existingItem.size || existingItem.bytesUploaded || 0),
      bytesSent: Number(incomingItem.size || existingItem.size || existingItem.bytesUploaded || 0),
      uploadSpeedBytesPerSecond: 0,
      status: 'completed'
    };
  }

  const size = Number(incomingItem.size || existingItem.size || 0);
  const existingBytes = Number(existingItem.bytesUploaded || 0);
  const incomingBytes = Number(incomingItem.bytesUploaded || 0);
  const bytesUploaded = Math.max(existingBytes, incomingBytes, incomingItem.mediaAssetId ? size : 0);
  const existingBytesSent = Number(existingItem.bytesSent || existingBytes);
  const incomingBytesSent = Number(incomingItem.bytesSent || incomingBytes);
  const incomingStatus = incomingItem.status || existingItem.status || 'waiting';
  const staleActiveStatus =
    ['failed', 'paused'].includes(existingItem.status) &&
    ['waiting', 'interrupted', 'uploading'].includes(incomingStatus) &&
    incomingBytes <= existingBytes &&
    !incomingItem.mediaAssetId;
  const status = staleActiveStatus ? existingItem.status : incomingStatus;
  const bytesSent = incomingItem.mediaAssetId
    ? size
    : status === 'uploading'
      ? Math.max(existingBytesSent, incomingBytesSent, bytesUploaded)
      : bytesUploaded;
  const incomingHasFailureReason =
    Object.prototype.hasOwnProperty.call(incomingItem, 'failureReason') ||
    Object.prototype.hasOwnProperty.call(incomingItem, 'errorMessage');
  const failureReason = incomingItem.mediaAssetId
    ? ''
    : incomingHasFailureReason
      ? incomingItem.failureReason || incomingItem.errorMessage || ''
      : existingItem.failureReason || existingItem.errorMessage || '';

  return {
    ...existingItem,
    ...incomingItem,
    bytesUploaded,
    bytesSent,
    uploadSpeedBytesPerSecond: Number(incomingItem.uploadSpeedBytesPerSecond || 0),
    status,
    failureReason,
    ...(incomingItem.mediaAssetId ? { status: 'completed', uploadSpeedBytesPerSecond: 0, bytesSent: size, failureReason: '' } : {})
  };
};

export const mergePendingPublishRecords = (existing = null, incoming = {}) => {
  if (!existing) {
    return {
      ...incoming,
      updatedAt: new Date().toISOString()
    };
  }

  const existingItems = new Map(pendingMediaItems(existing).map(item => [getPendingMediaItemKey(item), item]));
  const mergedItems = pendingMediaItems(incoming).map(item => {
    const key = getPendingMediaItemKey(item);
    return mergePendingMediaItem(existingItems.get(key), item);
  });
  const incomingHasPauseReason = Object.prototype.hasOwnProperty.call(incoming, 'pauseReason');
  const staleActiveProgressWrite =
    existing.pauseReason === 'user' &&
    incoming.pauseReason === '' &&
    pendingMediaItems(incoming).some(item => item.status === 'uploading');

  return {
    ...existing,
    ...incoming,
    mediaItems: mergedItems,
    results: incoming.results || existing.results || [],
    pauseReason: staleActiveProgressWrite ? 'user' : incomingHasPauseReason ? incoming.pauseReason || '' : existing.pauseReason || '',
    updatedAt: new Date().toISOString()
  };
};

export const putPendingPublish = (pending, { broadcast = true } = {}) =>
  new Promise(async (resolve, reject) => {
    let db;
    let savedRecord;
    try {
      db = await openUploadDb();
      const transaction = db.transaction(PUBLISH_STORE, 'readwrite');
      const store = transaction.objectStore(PUBLISH_STORE);
      const getRequest = store.get(pending.id);

      getRequest.onsuccess = () => {
        savedRecord = mergePendingPublishRecords(getRequest.result || null, pending);
        store.put(savedRecord);
      };
      getRequest.onerror = () => reject(getRequest.error);
      transaction.oncomplete = () => {
        db.close();
        if (broadcast) broadcastPendingPublishUpdate(savedRecord || pending);
        resolve(savedRecord || pending);
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    } catch (error) {
      db?.close?.();
      reject(error);
    }
  });

export const getPendingPublishes = () =>
  runStore(PUBLISH_STORE, 'readonly', store => store.getAll()).then(records =>
    records.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
  );

export const deletePendingPublish = id =>
  runStore(PUBLISH_STORE, 'readwrite', store => store.delete(id)).then(result => {
    broadcastUploadStateChange({ type: 'pending_publish_deleted', pendingId: id });
    return result;
  });

export const createUploadKey = ({ userId, postGroupId, localId, file, sha256 }) =>
  [userId || 'user', postGroupId || 'post', localId || file.name, file.name, file.size, file.lastModified || 0, sha256].join(':');

export const sha256File = async file => {
  if (!globalThis.crypto?.subtle) {
    throw new Error('This browser cannot calculate SHA-256 for upload verification.');
  }

  const buffer = await file.arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const isAbortError = error => error?.name === 'AbortError';

const completedUploadMissingAssetError = () => {
  const error = new Error('Completed upload is missing its verified media asset.');
  error.code = 'UPLOAD_SESSION_FAILED';
  return error;
};

const uploadSessionFailedError = message => {
  const error = new Error(message || 'Cloud upload verification failed.');
  error.code = 'UPLOAD_SESSION_FAILED';
  return error;
};

export const pauseUploadSession = sessionId => api.post(`/api/media/resumable/${sessionId}/pause`, {});

export const getUploadSession = sessionId => api.get(`/api/media/resumable/${sessionId}`);

export const resumeUploadSession = sessionId => api.post(`/api/media/resumable/${sessionId}/resume`, {});

export const cancelUploadSession = sessionId => api.delete(`/api/media/resumable/${sessionId}`);

export const uploadFileResumable = async ({
  file,
  uploadKey,
  sha256,
  sessionId = '',
  storageIntent = 'library',
  cleanupGroupId = '',
  cropMetadata = null,
  chunkSize = DEFAULT_CHUNK_SIZE,
  controlRef,
  onProgress,
  onSession
}) => {
  if (!file) throw new Error('A local file is required for resumable upload.');

  const startPayload = sessionId
    ? await resumeUploadSession(sessionId).catch(() => getUploadSession(sessionId))
    : await api.post('/api/media/resumable/start', {
        uploadKey,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        sha256,
        storageIntent,
        cleanupGroupId,
        cropMetadata
      });

  let session = startPayload.data.uploadSession;
  onSession?.(session);
  onProgress?.(session);

  if (session.status === 'completed') {
    if (!session.mediaAsset?._id) throw completedUploadMissingAssetError();
    return session.mediaAsset;
  }
  if (session.status === 'paused' && !controlRef?.current?.paused) {
    const resumedPayload = await resumeUploadSession(session._id);
    session = resumedPayload.data.uploadSession;
    onSession?.(session);
    onProgress?.(session);
  }
  if (session.status === 'paused') {
    const error = new Error('Upload paused.');
    error.code = 'UPLOAD_PAUSED';
    throw error;
  }

  let speedSampleBytes = Number(session.bytesReceived || 0);
  let speedSampleAt = Date.now();
  let speedBytesPerSecond = 0;
  let lastOptimisticProgressAt = 0;
  const withUploadSpeed = nextSession => {
    const now = Date.now();
    const bytesReceived = Number(nextSession.bytesSent ?? nextSession.bytesReceived ?? 0);
    const elapsedSeconds = (now - speedSampleAt) / 1000;
    if (elapsedSeconds > 0.25 && bytesReceived >= speedSampleBytes) {
      const measuredBytesPerSecond = Math.round((bytesReceived - speedSampleBytes) / elapsedSeconds);
      speedBytesPerSecond = speedBytesPerSecond > 0
        ? Math.round(speedBytesPerSecond * 0.65 + measuredBytesPerSecond * 0.35)
        : measuredBytesPerSecond;
      speedSampleBytes = bytesReceived;
      speedSampleAt = now;
    }
    return {
      ...nextSession,
      uploadSpeedBytesPerSecond: nextSession.status === 'completed' ? 0 : speedBytesPerSecond
    };
  };

  while (session.bytesReceived < file.size) {
    if (controlRef?.current?.cancelled) {
      await cancelUploadSession(session._id).catch(() => {});
      throw new Error('Upload cancelled.');
    }

    if (controlRef?.current?.paused) {
      await pauseUploadSession(session._id).catch(() => {});
      onProgress?.(withUploadSpeed({ ...session, status: 'paused' }));
      if (controlRef.current.stopOnPause) {
        const error = new Error('Upload paused.');
        error.code = 'UPLOAD_PAUSED';
        throw error;
      }
      while (controlRef?.current?.paused && !controlRef?.current?.cancelled) {
        await sleep(350);
      }
      if (controlRef?.current?.cancelled) continue;
      const resumePayload = await resumeUploadSession(session._id);
      session = resumePayload.data.uploadSession;
      const nextSession = withUploadSpeed(session);
      onSession?.(nextSession);
      onProgress?.(nextSession);
      continue;
    }

    const start = session.bytesReceived;
    const endExclusive = Math.min(start + chunkSize, file.size);
    const end = endExclusive - 1;
    const chunk = file.slice(start, endExclusive);
    const controller = new AbortController();
    if (controlRef?.current) {
      controlRef.current.abortController = controller;
      controlRef.current.currentSessionId = session._id;
    }

    try {
      const payload = await uploadRawWithProgress(`/api/media/resumable/${session._id}/chunk`, chunk, {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Range': `bytes ${start}-${end}/${file.size}`
        },
        onUploadProgress: event => {
          const now = Date.now();
          const sentBytes = Math.min(file.size, start + Number(event.loaded || 0));
          if (sentBytes < endExclusive && now - lastOptimisticProgressAt < 250) return;
          lastOptimisticProgressAt = now;
          const nextSession = withUploadSpeed({
            ...session,
            status: 'uploading',
            verifiedBytesReceived: Number(session.bytesReceived || 0),
            bytesSent: sentBytes
          });
          onProgress?.(nextSession);
        }
      });
      session = payload.data.uploadSession;
      const nextSession = withUploadSpeed(session);
      onSession?.(nextSession);
      onProgress?.(nextSession);
    } catch (error) {
      if (isAbortError(error) && controlRef?.current?.interrupted) {
        const interruptedError = new Error('Upload interrupted.');
        interruptedError.code = 'UPLOAD_INTERRUPTED';
        throw interruptedError;
      }

      if (isAbortError(error) && (controlRef?.current?.paused || controlRef?.current?.cancelled)) {
        continue;
      }

      if (error?.status === 409) {
        const payload = await api.get(`/api/media/resumable/${session._id}`);
        const previousBytesReceived = Number(session.bytesReceived || 0);
        session = payload.data.uploadSession;
        const nextSession = withUploadSpeed(session);
        onSession?.(nextSession);
        onProgress?.(nextSession);
        if (session.status === 'uploading') {
          if (Number(session.bytesReceived || 0) <= previousBytesReceived) await sleep(800);
          continue;
        }
        if (session.status === 'completed') {
          if (!session.mediaAsset?._id) throw completedUploadMissingAssetError();
          return session.mediaAsset;
        }
        if (session.status === 'paused') {
          const pausedError = new Error('Upload paused.');
          pausedError.code = 'UPLOAD_PAUSED';
          throw pausedError;
        }
        if (session.status === 'failed') throw uploadSessionFailedError(session.failureReason || 'Upload failed.');
        if (session.status === 'cancelled') throw new Error('Upload cancelled.');
      }

      throw error;
    } finally {
      if (controlRef?.current?.abortController === controller) {
        controlRef.current.abortController = null;
      }
    }

    if (session.status === 'completed') {
      if (!session.mediaAsset?._id) throw completedUploadMissingAssetError();
      return session.mediaAsset;
    }
    if (session.status === 'failed') throw uploadSessionFailedError(session.failureReason || 'Upload failed.');
    if (session.status === 'cancelled') throw new Error('Upload cancelled.');
  }

  const finalPayload = await api.get(`/api/media/resumable/${session._id}`);
  session = finalPayload.data.uploadSession;
  const finalSession = withUploadSpeed(session);
  onSession?.(finalSession);
  onProgress?.(finalSession);
  if (session.status === 'failed') throw uploadSessionFailedError(session.failureReason || 'Cloud upload verification failed.');
  if (session.status !== 'completed') throw new Error('Upload did not complete verification.');
  if (!session.mediaAsset?._id) throw completedUploadMissingAssetError();
  return session.mediaAsset;
};
