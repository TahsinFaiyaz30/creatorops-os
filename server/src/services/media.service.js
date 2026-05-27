import crypto from 'crypto';
import path from 'path';

import MediaAsset from '../models/MediaAsset.js';
import MediaUploadSession from '../models/MediaUploadSession.js';
import { inspectVideoMetadata } from './mediaMetadata.service.js';
import {
  abortResumableObjectUpload,
  completeResumableObjectUpload,
  createMediaObjectKey,
  createResumableObjectUpload,
  createStoredObjectReadStream,
  deleteStoredObject,
  getStoredObjectBuffer,
  getMediaStorageProvider,
  getStoredObjectUrl,
  uploadResumableObjectPart
} from './mediaStorage.service.js';
import { getTemporaryMediaRetentionSeconds } from './systemSettings.service.js';

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const MIN_S3_MULTIPART_PART_BYTES = 5 * 1024 * 1024;

export const detectMediaType = mimeType => {
  if (mimeType?.startsWith('image/')) return 'image';
  if (mimeType?.startsWith('video/')) return 'video';
  return '';
};

const normalizeSha256 = value => String(value || '').trim().toLowerCase();

const createSafeUploadFilename = originalName => {
  const ext = path.extname(originalName || '');
  const safeBase = path
    .basename(originalName || 'upload', ext)
    .replace(/[^a-z0-9_-]/gi, '-')
    .slice(0, 50);
  return `${Date.now()}-${safeBase || 'upload'}${ext}`;
};

const calculateStreamSha256 = async stream => {
  const hash = crypto.createHash('sha256');
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest('hex');
};

const calculateStoredObjectSha256 = async session => {
  const stream = await createStoredObjectReadStream({
    objectKey: session.objectKey
  });
  return calculateStreamSha256(stream);
};

const parseJsonField = value => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
};

const getSessionWithStorage = async ({ user, sessionId }) => {
  const session = await MediaUploadSession.findOne({
    _id: sessionId,
    workspaceId: user.workspaceId,
    uploadedBy: user._id
  }).select('+objectKey +multipartUploadId +multipartParts');

  if (!session) throw createHttpError('Upload session not found.', 404);
  return session;
};

const hydrateAssetPublicUrl = async asset => {
  if (!asset) return asset;
  if (asset.storageProvider === 's3' && asset.objectKey) {
    asset.publicUrl = await getStoredObjectUrl({
      storageProvider: asset.storageProvider,
      objectKey: asset.objectKey
    });
  }
  return asset;
};

export const hydrateMediaAssetPublicUrls = async assets => {
  const normalizedAssets = Array.isArray(assets) ? assets : [assets].filter(Boolean);
  await Promise.all(normalizedAssets.map(hydrateAssetPublicUrl));
  return assets;
};

const createMediaAssetFromCompletedUpload = async ({ user, session, sha256 }) => {
  const mediaType = detectMediaType(session.mimeType);
  if (!mediaType) {
    await deleteStoredObject({
      objectKey: session.objectKey
    });
    throw createHttpError('Only image and video uploads are supported.', 400);
  }

  const cropMetadata = parseJsonField(session.cropMetadata);
  const storageIntent = session.storageIntent === 'temporary_publish' ? 'temporary_publish' : 'library';
  const retentionSeconds = storageIntent === 'temporary_publish' ? await getTemporaryMediaRetentionSeconds() : 0;
  const publicUrl = await getStoredObjectUrl({
    storageProvider: session.storageProvider,
    objectKey: session.objectKey
  });
  let videoMetadata = {};

  if (mediaType === 'video') {
    videoMetadata = await inspectVideoMetadata(publicUrl);
  }

  return MediaAsset.create({
    workspaceId: user.workspaceId,
    uploadedBy: user._id,
    originalName: session.originalName,
    mimeType: session.mimeType,
    size: session.size,
    sha256: normalizeSha256(sha256),
    storageProvider: session.storageProvider,
    objectKey: session.objectKey,
    publicUrl,
    mediaType,
    ...videoMetadata,
    status: 'ready',
    ...(cropMetadata ? { cropMetadata } : {}),
    storageIntent,
    cleanupGroupId: storageIntent === 'temporary_publish' ? String(session.cleanupGroupId || '').trim() : '',
    cleanupAt: storageIntent === 'temporary_publish' ? new Date(Date.now() + retentionSeconds * 1000) : null
  });
};

const serializeUploadSession = async session => {
  const populated = session.mediaAssetId && typeof session.mediaAssetId === 'object'
    ? session
    : await session.populate({ path: 'mediaAssetId', select: '+objectKey' });

  if (populated.mediaAssetId) {
    await hydrateAssetPublicUrl(populated.mediaAssetId);
  }

  return {
    _id: populated._id,
    uploadKey: populated.uploadKey,
    originalName: populated.originalName,
    mimeType: populated.mimeType,
    size: populated.size,
    mediaType: populated.mediaType,
    expectedSha256: populated.expectedSha256,
    actualSha256: populated.actualSha256,
    bytesReceived: populated.bytesReceived,
    status: populated.status,
    failureReason: populated.failureReason,
    mediaAsset: populated.mediaAssetId || null
  };
};

const getUploadSession = async ({ user, sessionId }) => {
  const session = await MediaUploadSession.findOne({
    _id: sessionId,
    workspaceId: user.workspaceId,
    uploadedBy: user._id
  });

  if (!session) throw createHttpError('Upload session not found.', 404);
  return session;
};

const discardUploadSession = async session => {
  await abortResumableObjectUpload(session);
  await deleteStoredObject({
    objectKey: session.objectKey
  });
  await session.deleteOne();
};

export const startResumableMediaUpload = async ({ user, input = {} }) => {
  const originalName = String(input.originalName || '').trim();
  const mimeType = String(input.mimeType || '').trim();
  const mediaType = detectMediaType(mimeType);
  const size = Number(input.size || 0);
  const expectedSha256 = normalizeSha256(input.sha256);
  const uploadKey = String(input.uploadKey || expectedSha256 || '').trim();

  if (!originalName) throw createHttpError('originalName is required.', 400);
  if (!mediaType) throw createHttpError('Only image and video uploads are supported.', 400);
  if (!Number.isFinite(size) || size <= 0) throw createHttpError('size must be a positive number.', 400);
  if (!SHA256_PATTERN.test(expectedSha256)) throw createHttpError('A valid SHA-256 hash is required before upload.', 400);
  if (!uploadKey) throw createHttpError('uploadKey is required.', 400);

  const existing = await MediaUploadSession.findOne({
    workspaceId: user.workspaceId,
    uploadedBy: user._id,
    uploadKey
  }).select('+objectKey +multipartUploadId +multipartParts');

  if (existing) {
    if (['cancelled', 'failed'].includes(existing.status)) {
      await discardUploadSession(existing);
    } else {
      if (existing.status === 'paused') {
        existing.status = 'uploading';
        await existing.save();
      }
      return serializeUploadSession(existing);
    }
  }

  const storageIntent = input.storageIntent === 'temporary_publish' ? 'temporary_publish' : 'library';
  const session = new MediaUploadSession({
    workspaceId: user.workspaceId,
    uploadedBy: user._id,
    uploadKey,
    originalName,
    mimeType,
    size,
    mediaType,
    expectedSha256,
    bytesReceived: 0,
    storageProvider: getMediaStorageProvider(),
    storageIntent,
    cleanupGroupId: storageIntent === 'temporary_publish' ? String(input.cleanupGroupId || '').trim() : '',
    cropMetadata: parseJsonField(input.cropMetadata),
    status: 'uploading'
  });

  const objectKey = createMediaObjectKey({
    workspaceId: user.workspaceId,
    storageIntent,
    kind: 'originals',
    id: session._id,
    filename: createSafeUploadFilename(originalName)
  });
  const upload = await createResumableObjectUpload({
    objectKey,
    mimeType,
    metadata: {
      workspaceId: user.workspaceId,
      uploadSessionId: session._id,
      originalName: encodeURIComponent(originalName),
      sha256: expectedSha256
    }
  });

  session.storageProvider = upload.storageProvider;
  session.objectKey = upload.objectKey;
  session.multipartUploadId = upload.multipartUploadId;
  session.publicUrl = upload.publicUrl || '';
  await session.save();

  return serializeUploadSession(session);
};

const parseContentRange = header => {
  const match = String(header || '').match(/^bytes\s+(\d+)-(\d+)\/(\d+)$/i);
  if (!match) return null;
  return {
    start: Number(match[1]),
    end: Number(match[2]),
    total: Number(match[3])
  };
};

const failUploadSession = async ({ session, message, completedObject = false }) => {
  session.status = 'failed';
  session.failureReason = message;

  if (completedObject) {
    await deleteStoredObject({
      objectKey: session.objectKey
    });
  } else {
    await abortResumableObjectUpload(session);
  }

  await session.save();
};

const finalizeUploadSession = async ({ user, session }) => {
  if (session.bytesReceived !== session.size) {
    await failUploadSession({ session, message: 'Uploaded file size does not match the original file.' });
    throw createHttpError('Uploaded file size does not match the original file.', 422);
  }

  let completedObject = false;
  try {
    await completeResumableObjectUpload(session);
    completedObject = true;

    const actualSha256 = await calculateStoredObjectSha256(session);
    session.actualSha256 = actualSha256;

    if (actualSha256 !== session.expectedSha256) {
      await failUploadSession({ session, message: 'Uploaded file SHA-256 does not match the original file.', completedObject });
      throw createHttpError('Uploaded file SHA-256 does not match the original file.', 422);
    }

    const asset = await createMediaAssetFromCompletedUpload({
      user,
      session,
      sha256: actualSha256
    });

    session.status = 'completed';
    session.bytesReceived = session.size;
    session.mediaAssetId = asset._id;
    session.completedAt = new Date();
    session.failureReason = '';
    session.publicUrl = asset.publicUrl;
    await session.save();

    return serializeUploadSession(await session.populate({ path: 'mediaAssetId', select: '+objectKey' }));
  } catch (error) {
    if (session.status !== 'failed') {
      await failUploadSession({
        session,
        message: error.message || 'Upload finalization failed.',
        completedObject
      });
    }
    throw error;
  }
};

export const getResumableMediaUpload = async ({ user, sessionId }) => {
  const session = await getUploadSession({ user, sessionId });
  return serializeUploadSession(session);
};

export const uploadResumableMediaChunk = async ({ user, sessionId, contentRange, chunk }) => {
  const session = await getSessionWithStorage({ user, sessionId });

  if (session.status === 'completed') return serializeUploadSession(session);
  if (session.status === 'cancelled') throw createHttpError('Upload session was cancelled.', 409);
  if (session.status === 'failed') throw createHttpError(session.failureReason || 'Upload session failed.', 409);
  if (session.status === 'paused') throw createHttpError('Upload session is paused.', 409);

  const range = parseContentRange(contentRange);
  if (!range) throw createHttpError('Content-Range must be provided as bytes start-end/total.', 400);
  if (!Buffer.isBuffer(chunk) || chunk.length === 0) throw createHttpError('Upload chunk is required.', 400);
  if (range.total !== session.size) throw createHttpError('Chunk total does not match upload session size.', 400);
  if (range.end < range.start || range.end - range.start + 1 !== chunk.length) {
    throw createHttpError('Chunk size does not match Content-Range.', 400);
  }
  if (session.storageProvider === 's3' && range.end < session.size - 1 && chunk.length < MIN_S3_MULTIPART_PART_BYTES) {
    throw createHttpError('Cloudflare R2 multipart uploads require every non-final chunk to be at least 5 MB.', 400);
  }

  if (range.end < session.bytesReceived) {
    return serializeUploadSession(session);
  }

  if (range.start !== session.bytesReceived) {
    const error = createHttpError(`Chunk offset mismatch. Expected byte ${session.bytesReceived}.`, 409);
    error.expectedOffset = session.bytesReceived;
    throw error;
  }

  const partNumber = (session.multipartParts || []).length + 1;
  const uploadedPart = await uploadResumableObjectPart({ session, partNumber, chunk });
  session.multipartParts.push({
    partNumber,
    etag: uploadedPart.etag || '',
    size: uploadedPart.size,
    start: range.start,
    end: range.end
  });
  session.bytesReceived += chunk.length;

  if (session.bytesReceived > session.size) {
    await failUploadSession({ session, message: 'Upload received more bytes than expected.' });
    throw createHttpError('Upload received more bytes than expected.', 422);
  }

  await session.save();

  if (session.bytesReceived === session.size) {
    return finalizeUploadSession({ user, session });
  }

  return serializeUploadSession(session);
};

export const pauseResumableMediaUpload = async ({ user, sessionId }) => {
  const session = await getUploadSession({ user, sessionId });
  if (session.status === 'uploading') {
    session.status = 'paused';
    await session.save();
  }
  return serializeUploadSession(session);
};

export const resumeResumableMediaUpload = async ({ user, sessionId }) => {
  const session = await getUploadSession({ user, sessionId });
  if (session.status === 'paused') {
    session.status = 'uploading';
    await session.save();
  }
  return serializeUploadSession(session);
};

export const cancelResumableMediaUpload = async ({ user, sessionId }) => {
  const session = await getSessionWithStorage({ user, sessionId });
  if (session.status !== 'completed') {
    await abortResumableObjectUpload(session);
  }
  session.status = 'cancelled';
  session.cancelledAt = new Date();
  await session.save();
  return serializeUploadSession(session);
};

export const listMediaAssets = async ({ user }) => {
  const assets = await MediaAsset.find({ workspaceId: user.workspaceId })
    .select('+objectKey')
    .sort({ createdAt: -1 })
    .populate('uploadedBy', 'name email role');
  await Promise.all(assets.map(hydrateAssetPublicUrl));
  return assets;
};

export const getMediaAssetById = async ({ user, mediaAssetId }) => {
  const query = MediaAsset.findOne({
    _id: mediaAssetId,
    workspaceId: user.workspaceId
  }).select('+objectKey');

  const asset = await query;

  if (!asset) {
    throw createHttpError('Media asset not found.', 404);
  }

  await hydrateAssetPublicUrl(asset);
  return asset;
};

export const updateMediaAsset = async ({ user, mediaAssetId, input }) => {
  const asset = await getMediaAssetById({ user, mediaAssetId });
  if (input.cropMetadata) {
    asset.cropMetadata = {
      ...asset.cropMetadata,
      ...input.cropMetadata
    };
  }
  await asset.save();
  return asset;
};

export const deleteMediaAsset = async ({ user, mediaAssetId }) => {
  const asset = await getMediaAssetById({ user, mediaAssetId });
  await deleteStoredObject({
    objectKey: asset.objectKey
  });
  await asset.deleteOne();
  return asset;
};

export const deleteTemporaryMediaAssets = async ({ workspaceId, mediaAssetIds = [] }) => {
  if (!Array.isArray(mediaAssetIds) || mediaAssetIds.length === 0) return { deletedCount: 0 };

  const assets = await MediaAsset.find({
    _id: { $in: mediaAssetIds },
    workspaceId,
    storageIntent: 'temporary_publish'
  }).select('+objectKey');

  for (const asset of assets) {
    await deleteStoredObject({
      objectKey: asset.objectKey
    });
    await asset.deleteOne();
  }

  return { deletedCount: assets.length };
};

const toPlainAsset = asset => {
  if (typeof asset.toObject === 'function') {
    return asset.toObject({ transform: false, versionKey: false });
  }
  return { ...asset };
};

export const prepareMediaAssetsForPublishing = async ({ mediaAssets = [] }) => {
  const preparedAssets = [];

  for (const asset of mediaAssets) {
    const raw = toPlainAsset(asset);
    raw.publicUrl = asset.objectKey
      ? await getStoredObjectUrl({ storageProvider: asset.storageProvider, objectKey: asset.objectKey })
      : asset.publicUrl || '';
    raw.objectKey = asset.objectKey;
    raw.createReadStream = options => createStoredObjectReadStream({ objectKey: asset.objectKey, ...options });
    raw.readBuffer = options => getStoredObjectBuffer({ objectKey: asset.objectKey, ...options });

    preparedAssets.push(raw);
  }

  return {
    mediaAssets: preparedAssets,
    cleanup: async () => {}
  };
};
