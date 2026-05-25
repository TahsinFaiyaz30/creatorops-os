import {
  createMediaAssetFromUpload,
  deleteMediaAsset,
  getMediaAssetById,
  listMediaAssets,
  updateMediaAsset
} from '../services/media.service.js';

export const uploadMedia = async (req, res, next) => {
  try {
    const mediaAsset = await createMediaAssetFromUpload({ user: req.user, file: req.file });
    res.status(201).json({ data: { mediaAsset } });
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
