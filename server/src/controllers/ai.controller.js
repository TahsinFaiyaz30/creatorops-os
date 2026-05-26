import { customizeCaptions, generateAndSaveVariants, optimizeVariant } from '../services/ai.service.js';

export const repurposeContentHandler = async (req, res, next) => {
  try {
    const result = await generateAndSaveVariants({
      user: req.user,
      contentItemId: req.body.contentItemId,
      platforms: req.body.platforms
    });

    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const optimizeVariantHandler = async (req, res, next) => {
  try {
    const result = await optimizeVariant({
      user: req.user,
      variantId: req.body.variantId,
      changeNote: req.body.changeNote
    });

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const customizeCaptionsHandler = async (req, res, next) => {
  try {
    const result = await customizeCaptions({
      user: req.user,
      baseCaption: req.body.baseCaption,
      connectionIds: req.body.connectionIds,
      connectionTargets: req.body.connectionTargets,
      mediaAssetIds: req.body.mediaAssetIds
    });

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};
