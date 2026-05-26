import PlatformConnection from '../models/PlatformConnection.js';
import PublishJob from '../models/PublishJob.js';
import PublishedPost from '../models/PublishedPost.js';
import SocialComment from '../models/SocialComment.js';
import SocialMetricSnapshot from '../models/SocialMetricSnapshot.js';
import SocialReply from '../models/SocialReply.js';
import { PLATFORM_LABELS } from '../constants/platforms.js';
import { isContentCreatorRole } from '../constants/roles.js';
import { getConnector } from '../platforms/connectorRegistry.js';
import { emitRealtimeEvent } from '../sockets/socket.js';
import { createWorkflowEvent } from './event.service.js';

const createHttpError = (message, statusCode, code = '') => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
};

const requireCreatorAdmin = user => {
  if (!isContentCreatorRole(user.role)) {
    throw createHttpError('Forbidden: Content Creator role is required for replies.', 403);
  }
};

const metricKeys = ['likes', 'reactions', 'comments', 'shares', 'views', 'saves'];

const emptyMetrics = () => ({ likes: 0, reactions: 0, comments: 0, shares: 0, views: 0, saves: 0 });

const addMetrics = (target, source = {}) => {
  for (const key of metricKeys) {
    target[key] += Number(source[key] || 0);
  }
  return target;
};

const getDocumentId = document => String(document?._id || document?.id || '');

const unique = values => [...new Set(values.filter(Boolean))];

const getGroupIdForJob = job => job.postGroupId || getDocumentId(job);

const getGroupIdForPost = post => post.postGroupId || (post.publishJobId ? String(post.publishJobId) : getDocumentId(post));

const platformRulesName = platform => PLATFORM_LABELS[platform] || platform;

const countAccountReplies = comments =>
  comments.reduce((total, comment) => total + (comment.accountReplies?.length || 0), 0);

const isYouTubePlatform = platform => ['youtube', 'youtube_shorts'].includes(platform);

const getCommentReplyTargetId = comment => {
  if (isYouTubePlatform(comment.platform) && comment.parentProviderCommentId) {
    return comment.parentProviderCommentId;
  }
  return comment.providerCommentId;
};

const getReplyReplyTargetId = ({ comment, parentReply }) => {
  if (isYouTubePlatform(parentReply.platform)) {
    return comment.parentProviderCommentId || comment.providerCommentId;
  }
  return parentReply.providerReplyId;
};

const getLatestMetricMap = async ({ workspaceId, postIds }) => {
  if (!postIds.length) return new Map();
  const snapshots = await SocialMetricSnapshot.find({
    workspaceId,
    publishedPostId: { $in: postIds }
  }).sort({ collectedAt: -1 });
  const map = new Map();
  for (const snapshot of snapshots) {
    const key = String(snapshot.publishedPostId);
    if (!map.has(key)) map.set(key, snapshot);
  }
  return map;
};

const buildUnifiedPostGroup = ({ groupId, jobs = [], posts = [], metricMap = new Map(), comments = [] }) => {
  const sortedJobs = [...jobs].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const sortedPosts = [...posts].sort((a, b) => new Date(a.publishedAt || a.createdAt) - new Date(b.publishedAt || b.createdAt));
  const primary = sortedPosts[0] || sortedJobs[0] || {};
  const platforms = unique([...sortedJobs.map(job => job.platform), ...sortedPosts.map(post => post.platform)]);
  const platformBreakdown = platforms.map(platform => {
    const job = sortedJobs.find(item => item.platform === platform);
    const post = sortedPosts.find(item => item.platform === platform);
    const snapshot = post ? metricMap.get(getDocumentId(post)) : null;
    const metrics = snapshot ? metricKeys.reduce((acc, key) => ({ ...acc, [key]: snapshot[key] || 0 }), emptyMetrics()) : emptyMetrics();
    const platformComments = comments.filter(comment => comment.platform === platform);
    const topLevelComments = platformComments.filter(comment => !comment.isProviderReply);
    const providerReplies = platformComments.filter(comment => comment.isProviderReply);
    const accountReplyCount = countAccountReplies(platformComments);
    const analyticsStatus = post
      ? post.lastAnalyticsErrorMessage
        ? 'error'
        : post.lastAnalyticsSyncAt
          ? 'synced'
          : 'not_synced'
      : 'unavailable';
    const commentsStatus = post
      ? post.lastCommentsErrorMessage
        ? 'error'
        : post.lastCommentsSyncAt
          ? 'synced'
          : 'not_synced'
      : 'unavailable';
    const commentsUnavailableMessage = post
      ? post.lastCommentsErrorMessage ||
        (post.lastCommentsSyncAt
          ? platformComments.length > 0
            ? ''
            : `${platformRulesName(platform)} returned 0 comments during the last sync.`
          : `Comments have not been synced for ${platformRulesName(platform)} yet.`)
      : job?.errorMessage || 'No real published post exists for this platform yet.';

    return {
      platform,
      jobId: job?._id || null,
      postId: post?._id || null,
      status: post?.status || job?.status || 'not_published',
      accountSnapshot: post?.accountSnapshot || job?.accountSnapshot || {},
      caption: post?.caption || job?.caption || '',
      providerPostId: post?.providerPostId || job?.providerPostId || '',
      providerPostUrl: post?.providerPostUrl || job?.providerPostUrl || '',
      errorCode: job?.errorCode || post?.errorCode || '',
      errorMessage: job?.errorMessage || post?.errorMessage || '',
      latestSyncedAt: snapshot?.collectedAt || null,
      lastAnalyticsSyncAt: post?.lastAnalyticsSyncAt || null,
      lastAnalyticsErrorCode: post?.lastAnalyticsErrorCode || '',
      lastAnalyticsErrorMessage: post?.lastAnalyticsErrorMessage || '',
      analyticsStatus,
      lastCommentsSyncAt: post?.lastCommentsSyncAt || null,
      lastCommentsErrorCode: post?.lastCommentsErrorCode || '',
      lastCommentsErrorMessage: post?.lastCommentsErrorMessage || '',
      lastCommentCount: post?.lastCommentCount || 0,
      commentsStatus,
      commentsUnavailableMessage,
      metrics,
      commentCount: topLevelComments.length,
      replyRecordCount: providerReplies.length + accountReplyCount,
      unavailableMessage: post
        ? snapshot
          ? ''
          : 'No metrics synced yet for this platform.'
        : job?.errorMessage || 'No real published post exists for this platform yet.'
    };
  });

  const totals = platformBreakdown.reduce((acc, item) => addMetrics(acc, item.metrics), emptyMetrics());
  const firstMediaJob = sortedJobs.find(job => job.mediaAssetIds?.length);
  const firstMediaPost = sortedPosts.find(post => post.mediaAssetIds?.length);

  return {
    id: groupId,
    title:
      primary.contentItemId?.title ||
      primary.accountSnapshot?.accountName ||
      primary.platformConnectionId?.accountName ||
      'Unified post',
    caption: primary.caption || '',
    createdAt: primary.createdAt || null,
    publishedAt: sortedPosts.find(post => post.publishedAt)?.publishedAt || null,
    platforms,
    totals,
    platformBreakdown,
    jobs: sortedJobs,
    publishedPosts: sortedPosts,
    mediaAssets: firstMediaPost?.mediaAssetIds?.length ? firstMediaPost.mediaAssetIds : firstMediaJob?.mediaAssetIds || [],
    comments
  };
};

export const listPublishedPosts = async ({ user }) =>
  PublishedPost.find({ workspaceId: user.workspaceId })
    .sort({ publishedAt: -1, createdAt: -1 })
    .populate('platformConnectionId', 'platform accountName accountHandle accountType status')
    .populate('mediaAssetIds')
    .populate('variantId', 'platform caption status')
    .populate('contentItemId', 'title rawIdea status');

const getGroupQuery = groupId => {
  const conditions = [{ postGroupId: groupId }];
  if (/^[a-f\d]{24}$/i.test(groupId)) {
    conditions.push({ _id: groupId }, { publishJobId: groupId });
  }
  return { $or: conditions };
};

const getJobsForGroups = async ({ user }) =>
  PublishJob.find({ workspaceId: user.workspaceId })
    .sort({ createdAt: -1 })
    .populate('platformConnectionId', 'platform accountName accountHandle accountType status')
    .populate('mediaAssetIds')
    .populate('variantId', 'platform caption status')
    .populate('contentItemId', 'title rawIdea status');

const getPostsForGroups = async ({ user }) =>
  PublishedPost.find({ workspaceId: user.workspaceId })
    .sort({ publishedAt: -1, createdAt: -1 })
    .populate('platformConnectionId', 'platform accountName accountHandle accountType status')
    .populate('mediaAssetIds')
    .populate('variantId', 'platform caption status')
    .populate('contentItemId', 'title rawIdea status');

export const listUnifiedPostGroups = async ({ user }) => {
  const [jobs, posts] = await Promise.all([getJobsForGroups({ user }), getPostsForGroups({ user })]);
  const metricMap = await getLatestMetricMap({ workspaceId: user.workspaceId, postIds: posts.map(post => post._id) });
  const groupIds = unique([...jobs.map(getGroupIdForJob), ...posts.map(getGroupIdForPost)]);

  return groupIds
    .map(groupId =>
      buildUnifiedPostGroup({
        groupId,
        jobs: jobs.filter(job => getGroupIdForJob(job) === groupId),
        posts: posts.filter(post => getGroupIdForPost(post) === groupId),
        metricMap
      })
    )
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
};

export const getUnifiedPostGroup = async ({ user, groupId, platform = '' }) => {
  const groupQuery = getGroupQuery(groupId);
  const [jobs, posts] = await Promise.all([
    PublishJob.find({ workspaceId: user.workspaceId, ...groupQuery })
      .sort({ createdAt: 1 })
      .populate('platformConnectionId', 'platform accountName accountHandle accountType status')
      .populate('mediaAssetIds')
      .populate('variantId', 'platform caption status')
      .populate('contentItemId', 'title rawIdea status'),
    PublishedPost.find({ workspaceId: user.workspaceId, ...groupQuery })
      .sort({ publishedAt: 1, createdAt: 1 })
      .populate('platformConnectionId', 'platform accountName accountHandle accountType status')
      .populate('mediaAssetIds')
      .populate('variantId', 'platform caption status')
      .populate('contentItemId', 'title rawIdea status')
  ]);

  if (!jobs.length && !posts.length) {
    throw createHttpError('Unified post group not found.', 404);
  }

  const filteredPosts = platform ? posts.filter(post => post.platform === platform) : posts;
  const filteredJobs = platform ? jobs.filter(job => job.platform === platform) : jobs;
  const postIds = filteredPosts.map(post => post._id);
  const [metricMap, comments] = await Promise.all([
    getLatestMetricMap({ workspaceId: user.workspaceId, postIds }),
    postIds.length
      ? SocialComment.find({ workspaceId: user.workspaceId, publishedPostId: { $in: postIds } }).sort({
          providerCreatedAt: -1,
          createdAt: -1
        })
      : []
  ]);
  const replies = comments.length
    ? await SocialReply.find({
        workspaceId: user.workspaceId,
        socialCommentId: { $in: comments.map(comment => comment._id) }
      })
        .sort({ createdAt: 1 })
        .populate('repliedBy', 'name email role')
    : [];
  const creatorOpsProviderReplyIds = new Set(
    replies.map(reply => reply.providerReplyId).filter(Boolean).map(String)
  );
  const visibleComments = comments.filter(comment => {
    if (!comment.isProviderReply) return true;
    return !creatorOpsProviderReplyIds.has(String(comment.providerCommentId || ''));
  });
  const repliesByCommentId = replies.reduce((acc, reply) => {
    const key = String(reply.socialCommentId);
    acc[key] = acc[key] || [];
    acc[key].push(reply);
    return acc;
  }, {});
  const commentsWithAccountReplies = visibleComments.map(comment => {
    const obj = typeof comment.toObject === 'function' ? comment.toObject() : comment;
    return {
      ...obj,
      accountReplies: repliesByCommentId[String(comment._id)] || []
    };
  });

  return buildUnifiedPostGroup({
    groupId,
    jobs: filteredJobs,
    posts: filteredPosts,
    metricMap,
    comments: commentsWithAccountReplies
  });
};

export const syncUnifiedPostGroup = async ({ user, groupId }) => {
  const groupQuery = getGroupQuery(groupId);
  const posts = await PublishedPost.find({ workspaceId: user.workspaceId, ...groupQuery });

  if (!posts.length) {
    return {
      results: [],
      message: 'No real published platform posts exist in this group yet. Blocked or failed jobs cannot sync metrics.'
    };
  }

  const results = [];
  for (const post of posts) {
    try {
      const result = await syncPublishedPost({ user, postId: post._id });
      results.push({
        platform: post.platform,
        postId: post._id,
        ok: Boolean(result.analytics?.ok || result.comments?.ok),
        analytics: result.analytics,
        comments: result.comments
      });
    } catch (error) {
      results.push({
        platform: post.platform,
        postId: post._id,
        ok: false,
        code: error.code || 'SYNC_FAILED',
        message: error.message
      });
    }
  }

  return {
    results,
    group: await getUnifiedPostGroup({ user, groupId })
  };
};

export const getPublishedPost = async ({ user, postId }) => {
  const post = await PublishedPost.findOne({ _id: postId, workspaceId: user.workspaceId })
    .populate('platformConnectionId', 'platform accountName accountHandle accountType status')
    .populate('mediaAssetIds')
    .populate('variantId', 'platform caption status')
    .populate('contentItemId', 'title rawIdea status');
  if (!post) throw createHttpError('Published post not found.', 404);
  return post;
};

const getConnectionWithSecrets = async post =>
  PlatformConnection.findOne({
    _id: post.platformConnectionId,
    workspaceId: post.workspaceId
  }).select('+encryptedAccessToken +encryptedRefreshToken +encryptedApiSecret +encryptedAppPassword');

export const syncPublishedPost = async ({ user, postId }) => {
  const post = await getPublishedPost({ user, postId });
  if (!post.providerPostId) {
    throw createHttpError('This post does not have a providerPostId from a real platform API.', 400, 'CAPABILITY_UNAVAILABLE');
  }

  const connection = await getConnectionWithSecrets(post);
  const connector = getConnector(post.platform);
  if (!connection || !connector) throw createHttpError('Platform connection is unavailable.', 404);

  const analyticsResult = await connector.fetchAnalytics(connection, post.providerPostId);
  const commentsResult = await connector.fetchComments(connection, post.providerPostId);
  const response = {
    analytics: analyticsResult,
    comments: commentsResult
  };

  if (analyticsResult.ok) {
    post.lastAnalyticsSyncAt = new Date();
    post.lastAnalyticsErrorCode = '';
    post.lastAnalyticsErrorMessage = '';
    const snapshot = await SocialMetricSnapshot.create({
      workspaceId: user.workspaceId,
      publishedPostId: post._id,
      platformConnectionId: connection._id,
      platform: post.platform,
      providerPostId: post.providerPostId,
      likes: analyticsResult.data.likes || 0,
      reactions: analyticsResult.data.reactions || 0,
      comments: analyticsResult.data.comments || 0,
      shares: analyticsResult.data.shares || 0,
      views: analyticsResult.data.views || 0,
      saves: analyticsResult.data.saves || 0
    });
    emitRealtimeEvent('social:metrics_updated', snapshot);
    await createWorkflowEvent({
      workspaceId: user.workspaceId,
      actorId: user._id,
      eventType: 'social.metrics_updated',
      message: 'Real platform metrics were synced.',
      entityType: 'PublishedPost',
      entityId: post._id,
      metadata: { publishedPostId: post._id, platform: post.platform }
    });
  } else {
    post.lastAnalyticsErrorCode = analyticsResult.code || 'SYNC_FAILED';
    post.lastAnalyticsErrorMessage = analyticsResult.message || 'Analytics sync failed.';
  }

  if (commentsResult.ok) {
    const comments = [];
    for (const comment of commentsResult.data || []) {
      const saved = await SocialComment.findOneAndUpdate(
        {
          workspaceId: user.workspaceId,
          providerCommentId: comment.providerCommentId,
          platformConnectionId: connection._id
        },
        {
          $set: {
            ...comment,
            workspaceId: user.workspaceId,
            publishedPostId: post._id,
            platformConnectionId: connection._id,
            platform: post.platform,
            source: 'real'
          }
        },
        { upsert: true, new: true }
      );
      comments.push(saved);
    }
    post.lastCommentsSyncAt = new Date();
    post.lastCommentsErrorCode = '';
    post.lastCommentsErrorMessage = '';
    post.lastCommentCount = comments.length;
    emitRealtimeEvent('social:comments_synced', { publishedPostId: post._id, count: comments.length });
    await createWorkflowEvent({
      workspaceId: user.workspaceId,
      actorId: user._id,
      eventType: 'social.comments_synced',
      message: 'Real platform comments were synced.',
      entityType: 'PublishedPost',
      entityId: post._id,
      metadata: { publishedPostId: post._id, platform: post.platform, count: comments.length }
    });
  } else {
    post.lastCommentsErrorCode = commentsResult.code || 'SYNC_FAILED';
    post.lastCommentsErrorMessage = commentsResult.message || 'Comments sync failed.';
  }

  await post.save();

  return response;
};

export const listMetrics = async ({ user, postId }) => {
  const post = await getPublishedPost({ user, postId });
  return SocialMetricSnapshot.find({ workspaceId: user.workspaceId, publishedPostId: post._id }).sort({ collectedAt: -1 });
};

export const listComments = async ({ user, postId }) => {
  const post = await getPublishedPost({ user, postId });
  return SocialComment.find({ workspaceId: user.workspaceId, publishedPostId: post._id }).sort({ providerCreatedAt: -1, createdAt: -1 });
};

export const replyToSocialComment = async ({ user, commentId, replyText }) => {
  requireCreatorAdmin(user);
  const trimmedReplyText = String(replyText || '').trim();
  if (!trimmedReplyText) throw createHttpError('replyText is required.', 400);
  const comment = await SocialComment.findOne({ _id: commentId, workspaceId: user.workspaceId });
  if (!comment) throw createHttpError('Social comment not found.', 404);
  const post = await PublishedPost.findOne({ _id: comment.publishedPostId, workspaceId: user.workspaceId });
  if (!post) throw createHttpError('Published post not found.', 404);
  const connection = await getConnectionWithSecrets(post);
  const connector = getConnector(comment.platform);
  if (!connector) throw createHttpError('Platform connector is unavailable.', 404);
  const providerTargetId = getCommentReplyTargetId(comment);
  if (!providerTargetId) throw createHttpError('The selected comment does not have a provider reply target id.', 400, 'CAPABILITY_UNAVAILABLE');
  const result = await connector.replyToComment(connection, providerTargetId, trimmedReplyText);
  if (!result.ok) throw createHttpError(result.message, 400, result.code);

  const reply = await SocialReply.create({
    workspaceId: user.workspaceId,
    socialCommentId: comment._id,
    platformConnectionId: connection._id,
    platform: comment.platform,
    providerReplyId: result.data.providerReplyId || '',
    parentProviderReplyId: providerTargetId,
    replyText: trimmedReplyText,
    repliedBy: user._id,
    accountSnapshot: post.accountSnapshot,
    source: 'real'
  });

  comment.isReplied = true;
  await comment.save();

  emitRealtimeEvent('social:reply_created', reply);
  await createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType: 'social.reply_created',
    message: 'A real platform comment reply was created.',
    entityType: 'SocialReply',
    entityId: reply._id,
    metadata: {
      socialCommentId: comment._id,
      providerCommentId: comment.providerCommentId,
      providerReplyTargetId: providerTargetId,
      parentProviderCommentId: comment.parentProviderCommentId || '',
      isProviderReply: comment.isProviderReply,
      platform: comment.platform
    }
  });

  return reply;
};

export const replyToSocialReply = async ({ user, replyId, replyText }) => {
  requireCreatorAdmin(user);
  const trimmedReplyText = String(replyText || '').trim();
  if (!trimmedReplyText) throw createHttpError('replyText is required.', 400);

  const parentReply = await SocialReply.findOne({ _id: replyId, workspaceId: user.workspaceId });
  if (!parentReply) throw createHttpError('Social reply not found.', 404);
  if (!parentReply.providerReplyId) {
    throw createHttpError('This reply does not have a provider reply id yet. Sync comments from the platform and try again.', 400, 'CAPABILITY_UNAVAILABLE');
  }

  const comment = await SocialComment.findOne({
    _id: parentReply.socialCommentId,
    workspaceId: user.workspaceId
  });
  if (!comment) throw createHttpError('Social comment not found.', 404);

  const post = await PublishedPost.findOne({ _id: comment.publishedPostId, workspaceId: user.workspaceId });
  if (!post) throw createHttpError('Published post not found.', 404);

  const connection = await getConnectionWithSecrets(post);
  const connector = getConnector(parentReply.platform);
  if (!connector) throw createHttpError('Platform connector is unavailable.', 404);

  const providerTargetId = getReplyReplyTargetId({ comment, parentReply });
  if (!providerTargetId) throw createHttpError('The selected reply does not have a provider reply target id.', 400, 'CAPABILITY_UNAVAILABLE');
  const result = await connector.replyToComment(connection, providerTargetId, trimmedReplyText);
  if (!result.ok) throw createHttpError(result.message, 400, result.code);

  const reply = await SocialReply.create({
    workspaceId: user.workspaceId,
    socialCommentId: comment._id,
    parentSocialReplyId: parentReply._id,
    platformConnectionId: connection._id,
    platform: parentReply.platform,
    providerReplyId: result.data.providerReplyId || '',
    parentProviderReplyId: providerTargetId,
    replyText: trimmedReplyText,
    repliedBy: user._id,
    accountSnapshot: post.accountSnapshot,
    source: 'real'
  });

  emitRealtimeEvent('social:reply_created', reply);
  await createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType: 'social.reply_created',
    message: 'A real platform nested reply was created.',
    entityType: 'SocialReply',
    entityId: reply._id,
    metadata: {
      socialCommentId: comment._id,
      parentSocialReplyId: parentReply._id,
      providerReplyId: reply.providerReplyId,
      parentProviderReplyId: providerTargetId,
      platform: parentReply.platform
    }
  });

  return reply;
};

export const getAnalyticsSummary = async ({ user }) => {
  const posts = await PublishedPost.find({ workspaceId: user.workspaceId });
  const latestMetricMap = await getLatestMetricMap({ workspaceId: user.workspaceId, postIds: posts.map(post => post._id) });
  const latestSnapshots = [...latestMetricMap.values()];
  const comments = await SocialComment.find({ workspaceId: user.workspaceId }).sort({ createdAt: -1 }).limit(20);
  const totals = latestSnapshots.reduce(
    (acc, snapshot) => {
      acc.likes += snapshot.likes || 0;
      acc.reactions += snapshot.reactions || 0;
      acc.comments += snapshot.comments || 0;
      acc.shares += snapshot.shares || 0;
      acc.views += snapshot.views || 0;
      acc.saves += snapshot.saves || 0;
      return acc;
    },
    { likes: 0, reactions: 0, comments: 0, shares: 0, views: 0, saves: 0 }
  );

  return {
    totalPublishedPosts: posts.length,
    totalMetricSnapshots: latestSnapshots.length,
    totals,
    recentComments: comments,
    unavailableMessage:
      latestSnapshots.length === 0
        ? 'No analytics synced yet. Metrics are fetched only from official platform APIs when connected accounts and permissions allow it.'
        : ''
  };
};
