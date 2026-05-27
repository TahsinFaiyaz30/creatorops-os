import ContentItem from '../models/ContentItem.js';
import MediaAsset from '../models/MediaAsset.js';
import PlatformConnection from '../models/PlatformConnection.js';
import PlatformVariant from '../models/PlatformVariant.js';
import PublishedPost from '../models/PublishedPost.js';
import PublishJob from '../models/PublishJob.js';
import { normalizePlatform } from '../constants/platforms.js';
import { BRAND_REP_ROLE, CONTENT_CREATOR_ROLE, roleMatches } from '../constants/roles.js';
import { getConnector } from '../platforms/connectorRegistry.js';
import { emitRealtimeEvent } from '../sockets/socket.js';
import { createWorkflowEvent } from './event.service.js';
import { sanitizeConnection } from './platformConnection.service.js';
import { createVariantVersion } from './versioning.service.js';

const createPostGroupId = () => `post_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
const VISIBILITIES = ['public', 'private', 'friends_only'];
const VISIBILITY_OPTIONS_BY_PLATFORM = {
  youtube: ['public', 'private'],
  youtube_shorts: ['public', 'private']
};

const createHttpError = (message, statusCode, code = '') => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
};

const PUBLISH_ROLES = [CONTENT_CREATOR_ROLE, BRAND_REP_ROLE];

const requirePublishPermission = user => {
  if (!roleMatches(user, PUBLISH_ROLES)) {
    throw createHttpError('Forbidden: publishing is not allowed for these roles.', 403);
  }
};

const getConnectionWithSecrets = async ({ user, connectionId }) => {
  const connection = await PlatformConnection.findOne({
    _id: connectionId,
    workspaceId: user.workspaceId
  }).select('+encryptedAccessToken +encryptedRefreshToken +encryptedApiSecret +encryptedAppPassword');

  if (!connection) {
    throw createHttpError('Platform connection not found.', 404);
  }

  return connection;
};

const getScopedVariant = async ({ user, variantId }) => {
  if (!variantId) return null;
  const variant = await PlatformVariant.findOne({
    _id: variantId,
    workspaceId: user.workspaceId
  });
  if (!variant) throw createHttpError('Platform variant not found.', 404);
  return variant;
};

const getScopedContentItem = async ({ user, contentItemId }) => {
  if (!contentItemId) return null;
  const contentItem = await ContentItem.findOne({
    _id: contentItemId,
    workspaceId: user.workspaceId
  });
  if (!contentItem) throw createHttpError('Content item not found.', 404);
  return contentItem;
};

const getMediaAssets = async ({ user, mediaAssetIds = [], includeLocalPath = false }) => {
  if (!Array.isArray(mediaAssetIds) || mediaAssetIds.length === 0) return [];
  let query = MediaAsset.find({
    _id: { $in: mediaAssetIds },
    workspaceId: user.workspaceId
  });
  if (includeLocalPath) query = query.select('+localPath');
  const assets = await query;
  if (assets.length !== mediaAssetIds.length) {
    throw createHttpError('One or more media assets were not found in this workspace.', 404);
  }
  return assets;
};

const buildAccountSnapshot = (connection, platform = connection.platform) => ({
  platform,
  sourcePlatform: connection.platform,
  accountName: connection.accountName,
  accountHandle: connection.accountHandle,
  externalAccountId: connection.externalAccountId,
  accountType: connection.accountType
});

const normalizePublishInput = input => ({
  postGroupId: String(input.postGroupId || '').trim(),
  platformConnectionId: input.platformConnectionId,
  variantId: input.variantId || null,
  targetPlatform: input.targetPlatform ? normalizePlatform(input.targetPlatform) : '',
  campaignId: input.campaignId || null,
  contentItemId: input.contentItemId || null,
  mediaAssetIds: Array.isArray(input.mediaAssetIds) ? input.mediaAssetIds : [],
  caption: String(input.caption || '').trim(),
  visibility: VISIBILITIES.includes(input.visibility) ? input.visibility : 'public',
  scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : new Date()
});

const getVisibilityOptions = platform => VISIBILITY_OPTIONS_BY_PLATFORM[platform] || ['public'];

const isSharedYouTubeShortsTarget = ({ connection, platform }) =>
  connection.platform === 'youtube' && platform === 'youtube_shorts';

const getPublishPlatform = ({ input, connection, variant }) => {
  const platform = input.targetPlatform || variant?.platform || connection.platform;
  if (platform === connection.platform || isSharedYouTubeShortsTarget({ connection, platform })) {
    return platform;
  }
  throw createHttpError('Selected connection platform does not match the requested publish target.', 400);
};

const validateVisibility = ({ platform, mediaAssets, visibility }) => {
  const options = getVisibilityOptions(platform);
  const hasVideo = mediaAssets.some(asset => asset.mediaType === 'video');

  if (!VISIBILITIES.includes(visibility)) {
    return { ok: false, code: 'VALIDATION_FAILED', message: 'Invalid visibility value.' };
  }

  if (visibility === 'public') {
    return { ok: true };
  }

  if (!hasVideo) {
    return {
      ok: false,
      code: 'CAPABILITY_UNAVAILABLE',
      message: 'Non-public visibility is currently validated only for video posts.'
    };
  }

  if (!options.includes(visibility)) {
    return {
      ok: false,
      code: 'CAPABILITY_UNAVAILABLE',
      message: `${platform} does not support ${visibility} visibility in the current connector. Choose: ${options.join(', ')}.`
    };
  }

  return { ok: true };
};

const buildPayload = ({ input, connection, variant, mediaAssets, platform }) => ({
  caption: input.caption || variant?.caption || '',
  mediaAssets,
  variant,
  platform,
  account: sanitizeConnection(connection),
  ...(getVisibilityOptions(platform).length > 1 ? { visibility: input.visibility } : {})
});

export const validatePublishPayload = async ({ user, input }) => {
  requirePublishPermission(user);

  const normalized = normalizePublishInput(input);
  if (!normalized.platformConnectionId) {
    throw createHttpError('platformConnectionId is required.', 400);
  }

  const connection = await getConnectionWithSecrets({ user, connectionId: normalized.platformConnectionId });
  const variant = await getScopedVariant({ user, variantId: normalized.variantId });
  const finalPublishPlatform = getPublishPlatform({ input: normalized, connection, variant });
  const connector = getConnector(finalPublishPlatform);
  if (!connector) throw createHttpError('No connector is registered for this platform.', 400);
  if (variant) {
    if (variant.platform !== finalPublishPlatform) {
      throw createHttpError('Selected connection platform does not match the variant platform.', 400);
    }
    if (variant.status !== 'approved') {
      throw createHttpError('Only approved variants can be published or scheduled.', 400);
    }
  }

  const contentItem = await getScopedContentItem({
    user,
    contentItemId: normalized.contentItemId || variant?.contentItemId
  });
  const mediaAssets = await getMediaAssets({ user, mediaAssetIds: normalized.mediaAssetIds, includeLocalPath: true });
  const visibilityCheck = validateVisibility({
    platform: finalPublishPlatform,
    mediaAssets,
    visibility: normalized.visibility
  });
  if (!visibilityCheck.ok) {
    return {
      ok: false,
      code: visibilityCheck.code,
      message: visibilityCheck.message,
      data: {
        platform: finalPublishPlatform,
        visibility: normalized.visibility,
        supportedVisibility: getVisibilityOptions(finalPublishPlatform)
      },
      connection: sanitizeConnection(connection),
      variant,
      contentItem,
      mediaAssets
    };
  }
  const payload = buildPayload({ input: normalized, connection, variant, mediaAssets, platform: finalPublishPlatform });
  const result = connector.validatePublishPayload(payload, connection);

  return {
    ok: result.ok,
    code: result.code,
    message: result.message,
    data: { ...(result.data || {}), platform: finalPublishPlatform },
    connection: sanitizeConnection(connection),
    variant,
    contentItem,
    mediaAssets
  };
};

const persistValidationFailure = async ({ user, input, result }) => {
  await createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType: 'publish.validation_failed',
    message: result.message,
    entityType: 'PlatformConnection',
    entityId: input.platformConnectionId,
    metadata: {
      code: result.code,
      platformConnectionId: input.platformConnectionId,
      variantId: input.variantId || null
    }
  });
};

export const createPublishJob = async ({ user, input, publishNow = false }) => {
  requirePublishPermission(user);
  const normalized = normalizePublishInput(input);
  if (!normalized.postGroupId) normalized.postGroupId = createPostGroupId();
  const validation = await validatePublishPayload({ user, input: normalized });

  if (!validation.ok) {
    await persistValidationFailure({ user, input: normalized, result: validation });
    throw createHttpError(validation.message, 400, validation.code);
  }

  const connection = await getConnectionWithSecrets({ user, connectionId: normalized.platformConnectionId });
  const publishPlatform = validation.data?.platform || getPublishPlatform({ input: normalized, connection, variant: validation.variant });
  const variant = validation.variant;
  const contentItem = validation.contentItem;
  const scheduledAt = publishNow ? new Date() : normalized.scheduledAt;

  if (Number.isNaN(scheduledAt.getTime())) {
    throw createHttpError('scheduledAt must be a valid date.', 400);
  }

  const job = await PublishJob.create({
    workspaceId: user.workspaceId,
    postGroupId: normalized.postGroupId,
    campaignId: normalized.campaignId || variant?.campaignId || contentItem?.campaignId || null,
    contentItemId: contentItem?._id || null,
    variantId: variant?._id || null,
    mediaAssetIds: validation.mediaAssets.map(asset => asset._id),
    platformConnectionId: connection._id,
    platform: publishPlatform,
      accountSnapshot: buildAccountSnapshot(connection, publishPlatform),
      caption: normalized.caption || variant?.caption || '',
      visibility: normalized.visibility,
      scheduledAt,
      status: 'queued',
    createdBy: user._id
  });

  if (variant) {
    const previousStatus = variant.status;
    variant.status = 'scheduled';
    await variant.save();
    if (contentItem && contentItem.status !== 'published') {
      contentItem.status = 'scheduled';
      await contentItem.save();
    }
    await createVariantVersion({
      user,
      contentItem,
      variant,
      changeNote: publishNow ? 'Real publish job queued' : 'Real publish job scheduled',
      extraSnapshot: {
        publishJobId: job._id,
        platformConnectionId: connection._id,
        accountSnapshot: buildAccountSnapshot(connection),
        visibility: job.visibility,
        scheduledAt: job.scheduledAt,
        previousStatus,
        newStatus: variant.status
      }
    });
  }

  await createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType: 'publish.queued',
    message: publishNow ? 'Real publish job queued for immediate processing.' : 'Real publish job scheduled.',
    entityType: 'PublishJob',
    entityId: job._id,
    metadata: {
      publishJobId: job._id,
      platform: job.platform,
      platformConnectionId: connection._id,
      accountHandle: connection.accountHandle,
      scheduledAt: job.scheduledAt
    }
  });

  emitRealtimeEvent('publishing:job_updated', job);

  if (publishNow) {
    return processPublishJob({ jobId: job._id });
  }

  return getPublishJobById({ user, jobId: job._id });
};

export const getPublishJobById = async ({ user, jobId }) => {
  const job = await PublishJob.findOne({
    _id: jobId,
    workspaceId: user.workspaceId
  })
    .populate('platformConnectionId', 'platform accountName accountHandle externalAccountId accountType status capabilities')
    .populate('mediaAssetIds')
    .populate('variantId', 'platform caption hook cta hashtags status brandScore readinessScore')
    .populate('contentItemId', 'title rawIdea status')
    .populate('createdBy', 'name email role');

  if (!job) {
    throw createHttpError('Publish job not found.', 404);
  }

  return job;
};

export const listPublishJobs = async ({ user }) =>
  PublishJob.find({ workspaceId: user.workspaceId })
    .sort({ scheduledAt: -1, createdAt: -1 })
    .populate('platformConnectionId', 'platform accountName accountHandle externalAccountId accountType status capabilities')
    .populate('mediaAssetIds')
    .populate('variantId', 'platform caption hook cta hashtags status brandScore readinessScore')
    .populate('contentItemId', 'title rawIdea status')
    .populate('createdBy', 'name email role');

export const cancelPublishJob = async ({ user, jobId }) => {
  requirePublishPermission(user);
  const job = await PublishJob.findOne({ _id: jobId, workspaceId: user.workspaceId });
  if (!job) throw createHttpError('Publish job not found.', 404);
  if (!['queued', 'blocked', 'failed'].includes(job.status)) {
    throw createHttpError('Only queued, blocked, or failed publish jobs can be cancelled.', 400);
  }
  job.status = 'cancelled';
  await job.save();
  await createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType: 'publish.cancelled',
    message: 'Publish job cancelled.',
    entityType: 'PublishJob',
    entityId: job._id,
    metadata: { publishJobId: job._id }
  });
  emitRealtimeEvent('publishing:job_updated', job);
  return getPublishJobById({ user, jobId });
};

export const retryPublishJob = async ({ user, jobId }) => {
  requirePublishPermission(user);
  const job = await PublishJob.findOne({ _id: jobId, workspaceId: user.workspaceId });
  if (!job) throw createHttpError('Publish job not found.', 404);
  if (!['failed', 'blocked'].includes(job.status)) {
    throw createHttpError('Only failed or blocked publish jobs can be retried.', 400);
  }
  job.status = 'queued';
  job.retryCount += 1;
  job.errorCode = '';
  job.errorMessage = '';
  await job.save();
  await createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType: 'publish.retried',
    message: 'Publish job retried.',
    entityType: 'PublishJob',
    entityId: job._id,
    metadata: { publishJobId: job._id, retryCount: job.retryCount }
  });
  emitRealtimeEvent('publishing:job_updated', job);
  return getPublishJobById({ user, jobId });
};

export const processPublishJob = async ({ jobId }) => {
  const lockedJob = await PublishJob.findOneAndUpdate(
    {
      _id: jobId,
      status: 'queued'
    },
    {
      status: 'publishing',
      lastAttemptAt: new Date()
    },
    { new: true }
  );

  if (!lockedJob) {
    return PublishJob.findById(jobId);
  }

  emitRealtimeEvent('publishing:job_updated', lockedJob);

  await createWorkflowEvent({
    workspaceId: lockedJob.workspaceId,
    actorId: lockedJob.createdBy,
    eventType: 'publish.started',
    message: 'Real publish job started.',
    entityType: 'PublishJob',
    entityId: lockedJob._id,
    metadata: { publishJobId: lockedJob._id, platform: lockedJob.platform }
  });

  try {
    const connection = await PlatformConnection.findOne({
      _id: lockedJob.platformConnectionId,
      workspaceId: lockedJob.workspaceId
    }).select('+encryptedAccessToken +encryptedRefreshToken +encryptedApiSecret +encryptedAppPassword');
    const connector = getConnector(lockedJob.platform);
    if (!connection || !connector) {
      throw createHttpError('Publishing connection is unavailable.', 400, 'NOT_CONNECTED');
    }
    const mediaAssets = await MediaAsset.find({
      _id: { $in: lockedJob.mediaAssetIds },
      workspaceId: lockedJob.workspaceId
    }).select('+localPath');
    const payload = {
      caption: lockedJob.caption,
      mediaAssets,
      platform: lockedJob.platform,
      ...(getVisibilityOptions(lockedJob.platform).length > 1 ? { visibility: lockedJob.visibility } : {}),
      account: sanitizeConnection(connection)
    };
    const result = await connector.publish(payload, connection);

    if (!result.ok) {
      const blockedCodes = ['NOT_CONFIGURED', 'MISSING_PERMISSIONS', 'PAYMENT_REQUIRED', 'HTTP_402', 'PLATFORM_REVIEW_REQUIRED', 'CAPABILITY_UNAVAILABLE', 'NOT_IMPLEMENTED', 'NOT_CONNECTED'];
      lockedJob.status = blockedCodes.includes(result.code) ? 'blocked' : 'failed';
      lockedJob.errorCode = result.code;
      lockedJob.errorMessage = result.message;
      await lockedJob.save();
      await createWorkflowEvent({
        workspaceId: lockedJob.workspaceId,
        actorId: lockedJob.createdBy,
        eventType: lockedJob.status === 'blocked' ? 'publish.blocked' : 'publish.failed',
        message: result.message,
        entityType: 'PublishJob',
        entityId: lockedJob._id,
        metadata: { publishJobId: lockedJob._id, code: result.code, platform: lockedJob.platform }
      });
      emitRealtimeEvent('publishing:job_updated', lockedJob);
      return lockedJob;
    }

    lockedJob.status = 'published';
    lockedJob.providerPostId = result.data.providerPostId || '';
    lockedJob.providerPostUrl = result.data.providerPostUrl || '';
    lockedJob.providerRawResponse = result.data.rawResponse || result.data;
    lockedJob.errorCode = '';
    lockedJob.errorMessage = '';
    lockedJob.publishedAt = new Date();
    await lockedJob.save();

    const publishedPost = await PublishedPost.create({
      workspaceId: lockedJob.workspaceId,
      campaignId: lockedJob.campaignId,
      contentItemId: lockedJob.contentItemId,
      variantId: lockedJob.variantId,
      publishJobId: lockedJob._id,
      postGroupId: lockedJob.postGroupId,
      mediaAssetIds: lockedJob.mediaAssetIds,
      platformConnectionId: lockedJob.platformConnectionId,
      platform: lockedJob.platform,
      accountSnapshot: lockedJob.accountSnapshot,
      caption: lockedJob.caption,
      visibility: lockedJob.visibility,
      status: 'published',
      providerPostId: lockedJob.providerPostId,
      providerPostUrl: lockedJob.providerPostUrl,
      providerRawResponse: lockedJob.providerRawResponse,
      publishedAt: lockedJob.publishedAt,
      createdBy: lockedJob.createdBy
    });

    if (lockedJob.variantId) {
      const variant = await PlatformVariant.findById(lockedJob.variantId);
      const contentItem = lockedJob.contentItemId ? await ContentItem.findById(lockedJob.contentItemId) : null;
      if (variant) {
        variant.status = 'published';
        await variant.save();
      }
      if (contentItem) {
        contentItem.status = 'published';
        await contentItem.save();
        await createVariantVersion({
          user: {
            _id: lockedJob.createdBy,
            workspaceId: lockedJob.workspaceId,
            role: CONTENT_CREATOR_ROLE
          },
          contentItem,
          variant,
          changeNote: 'Real publish job succeeded',
          extraSnapshot: {
            publishJobId: lockedJob._id,
            publishedPostId: publishedPost._id,
            providerPostId: lockedJob.providerPostId,
            providerPostUrl: lockedJob.providerPostUrl,
            accountSnapshot: lockedJob.accountSnapshot,
            visibility: lockedJob.visibility
          }
        });
      }
    }

    await createWorkflowEvent({
      workspaceId: lockedJob.workspaceId,
      actorId: lockedJob.createdBy,
      eventType: 'publish.succeeded',
      message: 'Content was published through the connected platform API.',
      entityType: 'PublishedPost',
      entityId: publishedPost._id,
      metadata: {
        publishJobId: lockedJob._id,
        publishedPostId: publishedPost._id,
        platform: lockedJob.platform,
        providerPostId: lockedJob.providerPostId,
        providerPostUrl: lockedJob.providerPostUrl
      }
    });

    emitRealtimeEvent('publishing:job_updated', lockedJob);
    return lockedJob;
  } catch (error) {
    lockedJob.status = error.code === 'NOT_CONNECTED' ? 'blocked' : 'failed';
    lockedJob.errorCode = error.code || 'UNEXPECTED_ERROR';
    lockedJob.errorMessage = error.message || 'Publishing failed unexpectedly.';
    await lockedJob.save();
    await createWorkflowEvent({
      workspaceId: lockedJob.workspaceId,
      actorId: lockedJob.createdBy,
      eventType: lockedJob.status === 'blocked' ? 'publish.blocked' : 'publish.failed',
      message: lockedJob.errorMessage,
      entityType: 'PublishJob',
      entityId: lockedJob._id,
      metadata: { publishJobId: lockedJob._id, code: lockedJob.errorCode, platform: lockedJob.platform }
    });
    emitRealtimeEvent('publishing:job_updated', lockedJob);
    return lockedJob;
  }
};

export const processDuePublishJobs = async () => {
  const dueJobs = await PublishJob.find({
    status: 'queued',
    scheduledAt: { $lte: new Date() }
  })
    .sort({ scheduledAt: 1 })
    .limit(10);

  for (const job of dueJobs) {
    await processPublishJob({ jobId: job._id });
  }
};
