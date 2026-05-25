import fs from 'fs/promises';
import path from 'path';

import env from '../config/env.js';
import MediaAsset from '../models/MediaAsset.js';

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

export const createMediaAssetFromUpload = async ({ user, file }) => {
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

  const asset = await MediaAsset.create({
    workspaceId: user.workspaceId,
    uploadedBy: user._id,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    localPath: file.path,
    publicUrl: `${env.publicBaseUrl}${relativePath}`,
    mediaType,
    status: 'ready'
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
