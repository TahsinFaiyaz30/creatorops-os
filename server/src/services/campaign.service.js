import Campaign from '../models/Campaign.js';
import ContentItem from '../models/ContentItem.js';
import PlatformVariant from '../models/PlatformVariant.js';
import ScheduleJob from '../models/ScheduleJob.js';
import WorkflowEvent from '../models/WorkflowEvent.js';
import { normalizePlatforms } from '../constants/platforms.js';
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

  const platforms = normalizePlatforms(input.platforms);

  if (Array.isArray(input.platforms) && input.platforms.length > 0 && platforms.length === 0) {
    throw createHttpError('Campaign must include at least one supported platform.', 400);
  }

  const campaign = await Campaign.create({
    workspaceId: user.workspaceId,
    name,
    goal: input.goal || '',
    targetAudience: input.targetAudience || '',
    platforms,
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

const countByField = async ({ Model, match, field }) => {
  const rows = await Model.aggregate([
    { $match: match },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } }
  ]);

  return rows.reduce((counts, row) => {
    counts[row._id || 'unknown'] = row.count;
    return counts;
  }, {});
};

export const getCampaignTracking = async (user, campaignId) => {
  const campaign = await getCampaignById(user, campaignId);
  const matchCampaign = { workspaceId: user.workspaceId, campaignId: campaign._id };
  const contentItems = await ContentItem.find(matchCampaign).select('_id title status');
  const contentItemIds = contentItems.map(item => item._id);

  const variantMatch = {
    workspaceId: user.workspaceId,
    campaignId: campaign._id
  };
  const scheduleMatch = {
    workspaceId: user.workspaceId,
    contentItemId: { $in: contentItemIds }
  };

  const [
    totalVariants,
    variantsByStatus,
    platformBreakdown,
    totalScheduleJobs,
    scheduleJobsByStatus,
    accountRows,
    latestWorkflowEvents,
    publishedJobs
  ] = await Promise.all([
    PlatformVariant.countDocuments(variantMatch),
    countByField({ Model: PlatformVariant, match: variantMatch, field: 'status' }),
    countByField({ Model: PlatformVariant, match: variantMatch, field: 'platform' }),
    ScheduleJob.countDocuments(scheduleMatch),
    countByField({ Model: ScheduleJob, match: scheduleMatch, field: 'status' }),
    ScheduleJob.aggregate([
      { $match: scheduleMatch },
      {
        $group: {
          _id: {
            platform: '$platformAccountSnapshot.platform',
            accountName: '$platformAccountSnapshot.accountName',
            accountHandle: '$platformAccountSnapshot.accountHandle'
          },
          count: { $sum: 1 }
        }
      }
    ]),
    WorkflowEvent.find({
      workspaceId: user.workspaceId,
      $or: [
        { 'metadata.campaignId': campaign._id },
        { 'metadata.contentItemId': { $in: contentItemIds } },
        { entityId: campaign._id }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(10),
    ScheduleJob.find({
      ...scheduleMatch,
      status: 'published'
    }).select('platform resultMessage platformAccountSnapshot createdAt')
  ]);

  const accountBreakdown = accountRows.reduce((counts, row) => {
    const handle = row._id?.accountHandle || 'unknown account';
    counts[handle] = {
      platform: row._id?.platform || 'unknown',
      accountName: row._id?.accountName || '',
      accountHandle: handle,
      count: row.count
    };
    return counts;
  }, {});

  return {
    campaignId: campaign._id,
    campaignName: campaign.name,
    totalContentItems: contentItems.length,
    totalVariants,
    variantsByStatus,
    scheduleJobsByStatus,
    totalScheduleJobs,
    platformBreakdown,
    accountBreakdown,
    latestWorkflowEvents,
    publishedJobResultMessages: publishedJobs.map(job => ({
      platform: job.platform,
      resultMessage: job.resultMessage,
      account: job.platformAccountSnapshot,
      createdAt: job.createdAt
    })),
    providerPostUrls: []
  };
};
