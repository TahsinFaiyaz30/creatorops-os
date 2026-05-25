import Campaign from '../models/Campaign.js';
import { createWorkflowEvent } from './event.service.js';

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const createCampaign = async (user, input) => {
  const name = String(input.name || '').trim();

  if (!name) {
    throw createHttpError('Campaign name is required.', 400);
  }

  const campaign = await Campaign.create({
    workspaceId: user.workspaceId,
    name,
    goal: input.goal || '',
    targetAudience: input.targetAudience || '',
    platforms: Array.isArray(input.platforms) ? input.platforms : [],
    status: input.status || 'active',
    createdBy: user._id
  });

  await createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType: 'campaign.created',
    message: `Campaign "${campaign.name}" created.`,
    entityType: 'Campaign',
    entityId: campaign._id,
    metadata: {
      campaignId: campaign._id,
      platforms: campaign.platforms
    }
  });

  return campaign;
};

export const listCampaigns = async user =>
  Campaign.find({
    workspaceId: user.workspaceId
  })
    .sort({ createdAt: -1 })
    .populate('createdBy', 'name email role');

export const getCampaignById = async (user, campaignId) => {
  const campaign = await Campaign.findOne({
    _id: campaignId,
    workspaceId: user.workspaceId
  }).populate('createdBy', 'name email role');

  if (!campaign) {
    throw createHttpError('Campaign not found.', 404);
  }

  return campaign;
};
