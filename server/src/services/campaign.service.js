import Campaign from '../models/Campaign.js';
import ContentItem from '../models/ContentItem.js';
import PlatformVariant from '../models/PlatformVariant.js';
import PublishedPost from '../models/PublishedPost.js';
import PublishJob from '../models/PublishJob.js';
import SocialComment from '../models/SocialComment.js';
import SocialMetricSnapshot from '../models/SocialMetricSnapshot.js';
import WorkflowEvent from '../models/WorkflowEvent.js';
import TeamMembership from '../models/TeamMembership.js';
import { normalizePlatforms } from '../constants/platforms.js';
import { createWorkflowEvent } from './event.service.js';
import { createNotification } from './notification.service.js';
import { assertProjectAccess, projectScopeFilter } from './projectAccess.service.js';

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const idOf = value => String(value?._id || value || '');

/**
 * Only people who are actually in this team can be put on a project. Without
 * this a stale user id — someone who left, or was never here — silently becomes
 * a project member and starts receiving work they can no longer open.
 */
const resolveTeamMemberIds = async ({ workspaceId, userIds }) => {
  /*
   * Drop empties BEFORE stringifying: String(undefined) is "undefined", which is
   * truthy and reaches Mongo as a malformed ObjectId.
   */
  const requested = [
    ...new Set(
      (Array.isArray(userIds) ? userIds : [])
        .filter(Boolean)
        .map(String)
        .filter(value => /^[a-f\d]{24}$/i.test(value))
    )
  ];
  if (requested.length === 0) return [];

  const memberships = await TeamMembership.find({
    workspaceId,
    userId: { $in: requested },
    status: 'active'
  }).select('userId');

  return memberships.map(membership => membership.userId);
};

export const createCampaign = async (user, input, team = null) => {
  const name = String(input.name || '').trim();

  if (!name) {
    throw createHttpError('Campaign name is required.', 400);
  }

  const platforms = normalizePlatforms(input.platforms);

  if (Array.isArray(input.platforms) && input.platforms.length > 0 && platforms.length === 0) {
    throw createHttpError('Campaign must include at least one supported platform.', 400);
  }

  const memberIds = await resolveTeamMemberIds({ workspaceId: user.workspaceId, userIds: input.memberIds });
  const leadIds = await resolveTeamMemberIds({ workspaceId: user.workspaceId, userIds: [input.leadId] });

  const campaign = await Campaign.create({
    workspaceId: user.workspaceId,
    name,
    goal: input.goal || '',
    targetAudience: input.targetAudience || '',
    platforms,
    status: input.status || 'active',
    createdBy: user._id,
    leadId: leadIds[0] || null,
    memberIds,
    brief: String(input.brief || '').trim(),
    deadline: input.deadline ? new Date(input.deadline) : null,
    priority: ['low', 'normal', 'high'].includes(input.priority) ? input.priority : 'normal',
    visibility: input.visibility === 'team' ? 'team' : 'project_members'
  });

  await notifyProjectMembers({ user, campaign, memberIds, title: 'You were added to a project' });

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

const notifyProjectMembers = async ({ user, campaign, memberIds, title }) => {
  const recipients = (memberIds || []).filter(memberId => idOf(memberId) !== idOf(user._id));
  await Promise.all(
    recipients.map(memberId =>
      createNotification({
        workspaceId: campaign.workspaceId,
        userId: memberId,
        type: 'task_assigned',
        title,
        message: `${user.name} put you on "${campaign.name}".`,
        entityType: 'Campaign',
        entityId: campaign._id
      }).catch(() => {})
    )
  );
};

const POPULATE_PROJECT = [
  { path: 'createdBy', select: 'name email role profile.avatarUrl' },
  { path: 'leadId', select: 'name email profile.avatarUrl' },
  { path: 'memberIds', select: 'name email profile.avatarUrl' }
];

/* Scoped at the query, not filtered after: a member never reads a project row
   belonging to work they were deliberately kept out of. */
export const listCampaigns = async (user, team = null) =>
  Campaign.find(projectScopeFilter({ user, team }))
    .sort({ createdAt: -1 })
    .populate(POPULATE_PROJECT);

export const getCampaignById = async (user, campaignId, team = null) => {
  await assertProjectAccess({ user, team, projectId: campaignId });
  return Campaign.findOne({ _id: campaignId, workspaceId: user.workspaceId }).populate(POPULATE_PROJECT);
};

export const updateCampaign = async (user, campaignId, input, team = null) => {
  const campaign = await assertProjectAccess({ user, team, projectId: campaignId, requireManage: true });

  if (input.name !== undefined) {
    const name = String(input.name).trim();
    if (!name) throw createHttpError('Campaign name is required.', 400);
    campaign.name = name;
  }
  if (input.goal !== undefined) campaign.goal = String(input.goal);
  if (input.brief !== undefined) campaign.brief = String(input.brief);
  if (input.targetAudience !== undefined) campaign.targetAudience = String(input.targetAudience);
  if (input.platforms !== undefined) campaign.platforms = normalizePlatforms(input.platforms);
  if (input.status !== undefined && ['active', 'paused', 'archived'].includes(input.status)) {
    campaign.status = input.status;
  }
  if (input.priority !== undefined && ['low', 'normal', 'high'].includes(input.priority)) {
    campaign.priority = input.priority;
  }
  if (input.visibility !== undefined) {
    campaign.visibility = input.visibility === 'team' ? 'team' : 'project_members';
  }
  if (input.deadline !== undefined) campaign.deadline = input.deadline ? new Date(input.deadline) : null;

  if (input.leadId !== undefined) {
    const leadIds = await resolveTeamMemberIds({ workspaceId: user.workspaceId, userIds: [input.leadId] });
    campaign.leadId = leadIds[0] || null;
  }

  let addedMembers = [];
  if (input.memberIds !== undefined) {
    const before = new Set((campaign.memberIds || []).map(idOf));
    const memberIds = await resolveTeamMemberIds({ workspaceId: user.workspaceId, userIds: input.memberIds });
    addedMembers = memberIds.filter(memberId => !before.has(idOf(memberId)));
    campaign.memberIds = memberIds;
  }

  await campaign.save();
  if (addedMembers.length) {
    await notifyProjectMembers({ user, campaign, memberIds: addedMembers, title: 'You were added to a project' });
  }

  await createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType: 'campaign.updated',
    message: `Project "${campaign.name}" updated.`,
    entityType: 'Campaign',
    entityId: campaign._id,
    metadata: { campaignId: campaign._id, memberCount: (campaign.memberIds || []).length }
  });

  return Campaign.findById(campaign._id).populate(POPULATE_PROJECT);
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

export const getCampaignTracking = async (user, campaignId, team = null) => {
  const campaign = await getCampaignById(user, campaignId, team);
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
