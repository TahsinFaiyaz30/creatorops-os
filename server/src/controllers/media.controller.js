import {
  cancelResumableMediaUpload,
  deleteMediaAsset,
  getMediaAssetById,
  getResumableMediaUpload,
  listMediaAssets,
  pauseResumableMediaUpload,
  resumeResumableMediaUpload,
  startResumableMediaUpload,
  uploadResumableMediaChunk,
  updateMediaAsset
} from '../services/media.service.js';

export const startResumableUpload = async (req, res, next) => {
  try {
    const uploadSession = await startResumableMediaUpload({ user: req.user, input: req.body });
    res.status(201).json({ data: { uploadSession } });
  } catch (error) {
    next(error);
  }
};

export const getResumableUpload = async (req, res, next) => {
  try {
    const uploadSession = await getResumableMediaUpload({ user: req.user, sessionId: req.params.sessionId });
    res.json({ data: { uploadSession } });
  } catch (error) {
    next(error);
  }
};

export const uploadResumableChunk = async (req, res, next) => {
  try {
    const uploadSession = await uploadResumableMediaChunk({
      user: req.user,
      sessionId: req.params.sessionId,
      contentRange: req.get('content-range'),
      chunk: req.body
    });
    res.json({ data: { uploadSession } });
  } catch (error) {
    next(error);
  }
};

export const pauseResumableUpload = async (req, res, next) => {
  try {
    const uploadSession = await pauseResumableMediaUpload({ user: req.user, sessionId: req.params.sessionId });
    res.json({ data: { uploadSession } });
  } catch (error) {
    next(error);
  }
};

export const resumeResumableUpload = async (req, res, next) => {
  try {
    const uploadSession = await resumeResumableMediaUpload({ user: req.user, sessionId: req.params.sessionId });
    res.json({ data: { uploadSession } });
  } catch (error) {
    next(error);
  }
};

export const cancelResumableUpload = async (req, res, next) => {
  try {
    const uploadSession = await cancelResumableMediaUpload({ user: req.user, sessionId: req.params.sessionId });
    res.json({ data: { uploadSession } });
  } catch (error) {
    next(error);
  }
};

export const listMedia = async (req, res, next) => {
  try {
    const mediaAssets = await listMediaAssets({ user: req.user });
    res.json({ data: { mediaAssets } });
  } catch (error) {
    next(error);
  }
};

export const getMedia = async (req, res, next) => {
  try {
    const mediaAsset = await getMediaAssetById({ user: req.user, mediaAssetId: req.params.id });
    res.json({ data: { mediaAsset } });
  } catch (error) {
    next(error);
  }
};

export const updateMedia = async (req, res, next) => {
  try {
    const mediaAsset = await updateMediaAsset({
      user: req.user,
      mediaAssetId: req.params.id,
      input: req.body
    });
    res.json({ data: { mediaAsset } });
  } catch (error) {
    next(error);
  }
};

export const removeMedia = async (req, res, next) => {
  try {
    const mediaAsset = await deleteMediaAsset({ user: req.user, mediaAssetId: req.params.id });
    res.json({ data: { mediaAsset } });
  } catch (error) {
    next(error);
  }
};
