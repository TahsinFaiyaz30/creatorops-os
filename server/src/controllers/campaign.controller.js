import {
  createCampaign,
  getCampaignById,
  getCampaignTracking,
  listCampaigns
} from '../services/campaign.service.js';

export const createCampaignHandler = async (req, res, next) => {
  try {
    const campaign = await createCampaign(req.user, req.body);
    res.status(201).json({ data: { campaign } });
  } catch (error) {
    next(error);
  }
};

export const listCampaignsHandler = async (req, res, next) => {
  try {
    const campaigns = await listCampaigns(req.user);
    res.json({ data: { campaigns } });
  } catch (error) {
    next(error);
  }
};

export const getCampaignHandler = async (req, res, next) => {
  try {
    const campaign = await getCampaignById(req.user, req.params.id);
    res.json({ data: { campaign } });
  } catch (error) {
    next(error);
  }
};

export const getCampaignTrackingHandler = async (req, res, next) => {
  try {
    const tracking = await getCampaignTracking(req.user, req.params.id);
    res.json({ data: { tracking } });
  } catch (error) {
    next(error);
  }
};
