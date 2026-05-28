import { api } from './api';

const DB_NAME = 'creatorops-resumable-uploads';
const DB_VERSION = 1;
const FILE_STORE = 'files';
const PUBLISH_STORE = 'pendingPublishes';
const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024;

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

export const putPendingPublish = pending =>
  runStore(PUBLISH_STORE, 'readwrite', store =>
    store.put({
      ...pending,
      updatedAt: new Date().toISOString()
    })
  );

export const getPendingPublishes = () =>
  runStore(PUBLISH_STORE, 'readonly', store => store.getAll()).then(records =>
    records.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
  );

export const deletePendingPublish = id => runStore(PUBLISH_STORE, 'readwrite', store => store.delete(id));

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

  let speedSampleBytes = Number(session.bytesReceived || 0);
  let speedSampleAt = Date.now();
  let speedBytesPerSecond = 0;
  const withUploadSpeed = nextSession => {
    const now = Date.now();
    const bytesReceived = Number(nextSession.bytesReceived || 0);
    const elapsedSeconds = (now - speedSampleAt) / 1000;
    if (elapsedSeconds > 0.25 && bytesReceived >= speedSampleBytes) {
      speedBytesPerSecond = Math.round((bytesReceived - speedSampleBytes) / elapsedSeconds);
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
      const payload = await api.raw(`/api/media/resumable/${session._id}/chunk`, chunk, {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Range': `bytes ${start}-${end}/${file.size}`
        }
      });
      session = payload.data.uploadSession;
      const nextSession = withUploadSpeed(session);
      onSession?.(nextSession);
      onProgress?.(nextSession);
    } catch (error) {
      if (isAbortError(error) && (controlRef?.current?.paused || controlRef?.current?.cancelled)) {
        continue;
      }

      if (error?.status === 409) {
        const payload = await api.get(`/api/media/resumable/${session._id}`);
        session = payload.data.uploadSession;
        const nextSession = withUploadSpeed(session);
        onSession?.(nextSession);
        onProgress?.(nextSession);
        if (session.status === 'uploading') continue;
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
