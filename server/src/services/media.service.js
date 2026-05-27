import crypto from 'crypto';
import { createReadStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';

import env from '../config/env.js';
import MediaAsset from '../models/MediaAsset.js';
import MediaUploadSession from '../models/MediaUploadSession.js';
import { inspectVideoMetadata } from './mediaMetadata.service.js';
import { getTemporaryMediaRetentionSeconds } from './systemSettings.service.js';

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

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

const createResumableFilename = ({ sessionId, originalName }) => {
  const ext = path.extname(originalName || '');
  const safeBase = path
    .basename(originalName || 'upload', ext)
    .replace(/[^a-z0-9_-]/gi, '-')
    .slice(0, 50);
  return `resumable-${sessionId}-${safeBase || 'upload'}${ext}`;
};

export const calculateFileSha256 = filePath =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });

const parseJsonField = value => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
};

const createMediaAssetFromStoredFile = async ({ user, filePath, publicUrl, originalName, mimeType, size, input = {}, sha256 = '' }) => {
  const mediaType = detectMediaType(mimeType);
  if (!mediaType) {
    await fs.rm(filePath, { force: true });
    throw createHttpError('Only image and video uploads are supported.', 400);
  }

  const cropMetadata = parseJsonField(input.cropMetadata);
  const storageIntent = input.storageIntent === 'temporary_publish' ? 'temporary_publish' : 'library';
  const cleanupGroupId = storageIntent === 'temporary_publish' ? String(input.cleanupGroupId || '').trim() : '';
  const retentionSeconds = storageIntent === 'temporary_publish' ? await getTemporaryMediaRetentionSeconds() : 0;
  const videoMetadata = mediaType === 'video' ? await inspectVideoMetadata(filePath) : {};

  return MediaAsset.create({
    workspaceId: user.workspaceId,
    uploadedBy: user._id,
    originalName,
    mimeType,
    size,
    sha256: normalizeSha256(sha256),
    localPath: filePath,
    publicUrl,
    mediaType,
    ...videoMetadata,
    status: 'ready',
    ...(cropMetadata ? { cropMetadata } : {}),
    storageIntent,
    cleanupGroupId,
    cleanupAt: storageIntent === 'temporary_publish' ? new Date(Date.now() + retentionSeconds * 1000) : null
  });
};

const serializeUploadSession = async session => {
  const populated = session.mediaAssetId && typeof session.mediaAssetId === 'object'
    ? session
    : await session.populate('mediaAssetId');

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

const getUploadSession = async ({ user, sessionId, includeLocalPath = false }) => {
  let query = MediaUploadSession.findOne({
    _id: sessionId,
    workspaceId: user.workspaceId,
    uploadedBy: user._id
  });

  if (includeLocalPath) query = query.select('+localPath');

  const session = await query;
  if (!session) throw createHttpError('Upload session not found.', 404);
  return session;
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
  }).select('+localPath');

  if (existing) {
    if (['cancelled', 'failed'].includes(existing.status)) {
      await fs.rm(existing.localPath, { force: true });
      await existing.deleteOne();
    } else {
      if (existing.status === 'paused') {
        existing.status = 'uploading';
        await existing.save();
      }
      return serializeUploadSession(existing);
    }
  }

  const workspaceSegment = String(user.workspaceId);
  const destination = path.join(UPLOAD_ROOT, workspaceSegment);
  await fs.mkdir(destination, { recursive: true });

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
    localPath: path.join(destination, createSafeUploadFilename(originalName)),
    storageIntent: input.storageIntent === 'temporary_publish' ? 'temporary_publish' : 'library',
    cleanupGroupId: input.storageIntent === 'temporary_publish' ? String(input.cleanupGroupId || '').trim() : '',
    cropMetadata: parseJsonField(input.cropMetadata),
    status: 'uploading'
  });

  await session.save();
  const filename = createResumableFilename({ sessionId: session._id, originalName });
  session.localPath = path.join(destination, filename);
  session.publicUrl = `${env.publicBaseUrl}/uploads/${workspaceSegment}/${filename}`;
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

const failUploadSession = async ({ session, message }) => {
  session.status = 'failed';
  session.failureReason = message;
  await fs.rm(session.localPath, { force: true });
  await session.save();
};

const finalizeUploadSession = async ({ user, session }) => {
  const stat = await fs.stat(session.localPath).catch(() => null);
  if (!stat || stat.size !== session.size) {
    await failUploadSession({ session, message: 'Uploaded file size does not match the original file.' });
    throw createHttpError('Uploaded file size does not match the original file.', 422);
  }

  const actualSha256 = await calculateFileSha256(session.localPath);
  session.actualSha256 = actualSha256;

  if (actualSha256 !== session.expectedSha256) {
    await failUploadSession({ session, message: 'Uploaded file SHA-256 does not match the original file.' });
    throw createHttpError('Uploaded file SHA-256 does not match the original file.', 422);
  }

  const asset = await createMediaAssetFromStoredFile({
    user,
    filePath: session.localPath,
    publicUrl: session.publicUrl,
    originalName: session.originalName,
    mimeType: session.mimeType,
    size: session.size,
    input: {
      storageIntent: session.storageIntent,
      cleanupGroupId: session.cleanupGroupId,
      cropMetadata: session.cropMetadata
    },
    sha256: actualSha256
  });

  session.status = 'completed';
  session.bytesReceived = session.size;
  session.mediaAssetId = asset._id;
  session.completedAt = new Date();
  session.failureReason = '';
  await session.save();

  return serializeUploadSession(await session.populate('mediaAssetId'));
};

export const getResumableMediaUpload = async ({ user, sessionId }) => {
  const session = await getUploadSession({ user, sessionId });
  return serializeUploadSession(session);
};

export const uploadResumableMediaChunk = async ({ user, sessionId, contentRange, chunk }) => {
  const session = await getUploadSession({ user, sessionId, includeLocalPath: true });

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

  if (range.end < session.bytesReceived) {
    return serializeUploadSession(session);
  }

  if (range.start !== session.bytesReceived) {
    const error = createHttpError(`Chunk offset mismatch. Expected byte ${session.bytesReceived}.`, 409);
    error.expectedOffset = session.bytesReceived;
    throw error;
  }

  await fs.mkdir(path.dirname(session.localPath), { recursive: true });
  await fs.appendFile(session.localPath, chunk);
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
  const session = await getUploadSession({ user, sessionId, includeLocalPath: true });
  if (session.status !== 'completed') {
    await fs.rm(session.localPath, { force: true });
  }
  session.status = 'cancelled';
  session.cancelledAt = new Date();
  await session.save();
  return serializeUploadSession(session);
};

export const listMediaAssets = async ({ user }) =>
  MediaAsset.find({ workspaceId: user.workspaceId }).sort({ createdAt: -1 }).populate('uploadedBy', 'name email role');

export const getMediaAssetById = async ({ user, mediaAssetId, includeLocalPath = false }) => {
  let query = MediaAsset.findOne({
    _id: mediaAssetId,
    workspaceId: user.workspaceId
  });

  if (includeLocalPath) {
    query = query.select('+localPath');
  }

  const asset = await query;

  if (!asset) {
    throw createHttpError('Media asset not found.', 404);
  }

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
  const asset = await getMediaAssetById({ user, mediaAssetId, includeLocalPath: true });
  await fs.rm(asset.localPath, { force: true });
  await asset.deleteOne();
  return asset;
};

export const deleteTemporaryMediaAssets = async ({ workspaceId, mediaAssetIds = [] }) => {
  if (!Array.isArray(mediaAssetIds) || mediaAssetIds.length === 0) return { deletedCount: 0 };

  const assets = await MediaAsset.find({
    _id: { $in: mediaAssetIds },
    workspaceId,
    storageIntent: 'temporary_publish'
  }).select('+localPath');

  for (const asset of assets) {
    await fs.rm(asset.localPath, { force: true });
    await asset.deleteOne();
  }

  return { deletedCount: assets.length };
};
