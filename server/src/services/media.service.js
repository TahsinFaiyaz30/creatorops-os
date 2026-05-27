import fs from 'fs/promises';
import path from 'path';

import env from '../config/env.js';
import MediaAsset from '../models/MediaAsset.js';
import { inspectVideoMetadata } from './mediaMetadata.service.js';
import { getTemporaryMediaRetentionSeconds } from './systemSettings.service.js';

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');

export const detectMediaType = mimeType => {
  if (mimeType?.startsWith('image/')) return 'image';
  if (mimeType?.startsWith('video/')) return 'video';
  return '';
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

export const createMediaAssetFromUpload = async ({ user, file, input = {} }) => {
  if (!file) {
    throw createHttpError('Media file is required.', 400);
  }

  const mediaType = detectMediaType(file.mimetype);
  if (!mediaType) {
    await fs.rm(file.path, { force: true });
    throw createHttpError('Only image and video uploads are supported.', 400);
  }

  const workspaceSegment = String(user.workspaceId);
  const relativePath = `/uploads/${workspaceSegment}/${path.basename(file.filename)}`;
  const cropMetadata = parseJsonField(input.cropMetadata);
  const storageIntent = input.storageIntent === 'temporary_publish' ? 'temporary_publish' : 'library';
  const cleanupGroupId = storageIntent === 'temporary_publish' ? String(input.cleanupGroupId || '').trim() : '';
  const retentionSeconds = storageIntent === 'temporary_publish' ? await getTemporaryMediaRetentionSeconds() : 0;
  const videoMetadata = mediaType === 'video' ? await inspectVideoMetadata(file.path) : {};

  const asset = await MediaAsset.create({
    workspaceId: user.workspaceId,
    uploadedBy: user._id,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    localPath: file.path,
    publicUrl: `${env.publicBaseUrl}${relativePath}`,
    mediaType,
    ...videoMetadata,
    status: 'ready',
    ...(cropMetadata ? { cropMetadata } : {}),
    storageIntent,
    cleanupGroupId,
    cleanupAt: storageIntent === 'temporary_publish' ? new Date(Date.now() + retentionSeconds * 1000) : null
  });

  return asset;
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
