import Campaign from '../models/Campaign.js';
import ContentItem from '../models/ContentItem.js';
import PlatformVariant from '../models/PlatformVariant.js';
import PublishedPost from '../models/PublishedPost.js';
import PublishJob from '../models/PublishJob.js';
import SocialComment from '../models/SocialComment.js';
import SocialMetricSnapshot from '../models/SocialMetricSnapshot.js';
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
  const publishMatch = {
    workspaceId: user.workspaceId,
    campaignId: campaign._id
  };

  const [
    totalVariants,
    variantsByStatus,
    platformBreakdown,
    totalPublishJobs,
    publishJobsByStatus,
    publishedPostCount,
    accountRows,
    latestWorkflowEvents,
    publishedPosts,
    metricRows,
    latestComments
  ] = await Promise.all([
    PlatformVariant.countDocuments(variantMatch),
    countByField({ Model: PlatformVariant, match: variantMatch, field: 'status' }),
    countByField({ Model: PlatformVariant, match: variantMatch, field: 'platform' }),
    PublishJob.countDocuments(publishMatch),
    countByField({ Model: PublishJob, match: publishMatch, field: 'status' }),
    PublishedPost.countDocuments(publishMatch),
    PublishJob.aggregate([
      { $match: publishMatch },
      {
        $group: {
          _id: {
            platform: '$accountSnapshot.platform',
            accountName: '$accountSnapshot.accountName',
            accountHandle: '$accountSnapshot.accountHandle'
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
    PublishedPost.find({
      ...publishMatch,
      status: 'published'
    }).select('platform providerPostUrl providerPostId accountSnapshot publishedAt'),
    SocialMetricSnapshot.aggregate([
      {
        $lookup: {
          from: 'publishedposts',
          localField: 'publishedPostId',
          foreignField: '_id',
          as: 'post'
        }
      },
      { $unwind: '$post' },
      { $match: { workspaceId: user.workspaceId, 'post.campaignId': campaign._id } },
      {
        $group: {
          _id: null,
          likes: { $sum: '$likes' },
          reactions: { $sum: '$reactions' },
          comments: { $sum: '$comments' },
          shares: { $sum: '$shares' },
          views: { $sum: '$views' },
          saves: { $sum: '$saves' },
          snapshots: { $sum: 1 }
        }
      }
    ]),
    SocialComment.find({ workspaceId: user.workspaceId, publishedPostId: { $exists: true } })
      .sort({ createdAt: -1 })
      .limit(10)
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
    publishJobsByStatus,
    totalPublishJobs,
    publishedPostCount,
    platformBreakdown,
    accountBreakdown,
    latestWorkflowEvents,
    publishedJobResultMessages: publishedPosts.map(post => ({
      platform: post.platform,
      resultMessage: post.providerPostUrl
        ? `Published through official API: ${post.providerPostUrl}`
        : 'Published through official API; provider URL was not returned.',
      account: post.accountSnapshot,
      createdAt: post.publishedAt
    })),
    providerPostUrls: publishedPosts
      .filter(post => post.providerPostUrl)
      .map(post => ({ platform: post.platform, url: post.providerPostUrl, providerPostId: post.providerPostId })),
    syncedMetrics: metricRows[0] || {
      likes: 0,
      reactions: 0,
      comments: 0,
      shares: 0,
      views: 0,
      saves: 0,
      snapshots: 0
    },
    latestComments,
    analyticsUnavailableMessage:
      metricRows.length === 0
        ? 'Analytics unavailable until synced from connected platforms with official API permissions.'
        : ''
  };
};
