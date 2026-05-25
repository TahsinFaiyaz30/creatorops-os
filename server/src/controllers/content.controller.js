import {
  createContentItem,
  getContentVersions,
  listContentByCampaign,
  updateContentItem,
  updateContentStatus
} from '../services/content.service.js';

export const createContentHandler = async (req, res, next) => {
  try {
    const contentItem = await createContentItem(req.user, req.body);
    res.status(201).json({ data: { contentItem } });
  } catch (error) {
    next(error);
  }
};

export const listContentByCampaignHandler = async (req, res, next) => {
  try {
    const contentItems = await listContentByCampaign(req.user, req.params.campaignId);
    res.json({ data: { contentItems } });
  } catch (error) {
    next(error);
  }
};

export const updateContentHandler = async (req, res, next) => {
  try {
    const result = await updateContentItem(req.user, req.params.id, req.body);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const updateContentStatusHandler = async (req, res, next) => {
  try {
    const contentItem = await updateContentStatus(req.user, req.params.id, req.body);
    res.json({ data: { contentItem } });
  } catch (error) {
    next(error);
  }
};

export const getContentVersionsHandler = async (req, res, next) => {
  try {
    const versions = await getContentVersions(req.user, req.params.id);
    res.json({ data: { versions } });
  } catch (error) {
    next(error);
  }
};
