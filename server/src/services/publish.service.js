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
import { createCompressedMediaAssets, deleteDerivativeFiles } from './mediaDerivative.service.js';
import { deleteTemporaryMediaAssets } from './media.service.js';
import { refreshStoredConnectionIfNeeded, sanitizeConnection } from './platformConnection.service.js';
import { getTemporaryMediaRetentionSeconds } from './systemSettings.service.js';
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
const ACTIVE_PUBLISH_STATUSES = ['queued', 'publishing', 'paused'];
const UNSUCCESSFUL_TERMINAL_STATUSES = ['failed', 'blocked', 'cancelled'];
const FILE_TOO_LARGE_CODES = ['FILE_TOO_LARGE', 'PAYLOAD_TOO_LARGE', 'REQUEST_ENTITY_TOO_LARGE'];
const STALE_PUBLISH_JOB_MS = 60 * 60 * 1000;
const CONTROL_ACTIONS = {
  PAUSE: 'pause_requested',
  CANCEL: 'cancel_requested'
};
const CONTROL_RESULT_CODES = {
  [CONTROL_ACTIONS.PAUSE]: 'PUBLISH_PAUSED',
  [CONTROL_ACTIONS.CANCEL]: 'PUBLISH_CANCELLED'
};
const activePublishControls = new Map();

const requirePublishPermission = user => {
  if (!roleMatches(user, PUBLISH_ROLES)) {
    throw createHttpError('Forbidden: publishing is not allowed for these roles.', 403);
  }
};

const getControlResult = action => {
  if (action === CONTROL_ACTIONS.PAUSE) {
    return {
      ok: false,
      code: CONTROL_RESULT_CODES[action],
      message: 'Publish job paused before the next provider action. Resume it from Publishing when ready.',
      data: { action }
    };
  }
  if (action === CONTROL_ACTIONS.CANCEL) {
    return {
      ok: false,
      code: CONTROL_RESULT_CODES[action],
      message: 'Publish job cancellation was applied at a safe checkpoint. If a provider request was already accepted, check the platform before posting again.',
      data: { action }
    };
  }
  return null;
};

const requestActivePublishControl = ({ jobId, action }) => {
  const active = activePublishControls.get(String(jobId));
  if (!active) return false;
  active.action = action;
  active.controller.abort();
  return true;
};

const checkPublishControl = async job => {
  const jobId = String(job._id);
  const active = activePublishControls.get(jobId);
  const activeResult = getControlResult(active?.action);
  if (activeResult) return activeResult;

  const fresh = await PublishJob.findById(job._id).select('publishControl.action status');
  const action = fresh?.publishControl?.action || '';
  const result = getControlResult(action);
  if (result && active) active.action = action;
  return result;
};

const checkPayloadPublishControl = async payload => {
  if (typeof payload?.checkPublishControl !== 'function') return null;
  return payload.checkPublishControl();
};

const clearPublishControl = job => {
  job.publishControl = {
    action: '',
    requestedAt: null,
    requestedBy: null,
    message: ''
  };
};

const getExpectedTargetCount = groupJobs => Math.max(1, ...groupJobs.map(job => Number(job.groupTargetCount) || 1));

const getGroupMediaAssetIds = groupJobs => [
  ...new Set(
    groupJobs
      .flatMap(job => job.mediaAssetIds || [])
      .map(id => String(id))
  )
];

const refreshTemporaryMediaLifecycleForGroup = async ({ workspaceId, postGroupId, now = new Date(), retentionSeconds = null }) => {
  if (!postGroupId) return;

  const groupJobs = await PublishJob.find({ workspaceId, postGroupId }).select(
    'status mediaAssetIds groupTargetCount updatedAt temporaryMediaExpiredAt'
  );
  if (groupJobs.length === 0) return;

  const expectedTargetCount = getExpectedTargetCount(groupJobs);
  if (groupJobs.length < expectedTargetCount) {
    return;
  }

  const hasActiveJob = groupJobs.some(job => ACTIVE_PUBLISH_STATUSES.includes(job.status));
  if (hasActiveJob) {
    await PublishJob.updateMany(
      { workspaceId, postGroupId, temporaryMediaExpiredAt: null },
      { $set: { temporaryMediaExpiresAt: null } }
    );
    return;
  }

  const mediaAssetIds = getGroupMediaAssetIds(groupJobs);
  if (mediaAssetIds.length === 0) return;

  const temporaryMediaCount = await MediaAsset.countDocuments({
    _id: { $in: mediaAssetIds },
    workspaceId,
    storageIntent: 'temporary_publish'
  });
  if (temporaryMediaCount === 0) return;

  if (groupJobs.every(job => job.status === 'published')) {
    await deleteTemporaryMediaAssets({ workspaceId, mediaAssetIds });
    await PublishJob.updateMany({ workspaceId, postGroupId }, { $set: { temporaryMediaExpiresAt: null } });
    return;
  }

  const unsuccessfulJobs = groupJobs.filter(job => UNSUCCESSFUL_TERMINAL_STATUSES.includes(job.status));
  if (unsuccessfulJobs.length === 0) return;

  const latestUnsuccessfulAt = unsuccessfulJobs
    .map(job => new Date(job.updatedAt || now).getTime())
    .reduce((latest, timestamp) => Math.max(latest, timestamp), 0);
  const resolvedRetentionSeconds = retentionSeconds ?? await getTemporaryMediaRetentionSeconds();
  const expiresAt = new Date(latestUnsuccessfulAt + resolvedRetentionSeconds * 1000);

  if (expiresAt <= now) {
    await deleteTemporaryMediaAssets({ workspaceId, mediaAssetIds });
    await PublishJob.updateMany(
      { workspaceId, postGroupId, status: { $in: UNSUCCESSFUL_TERMINAL_STATUSES } },
      {
        $set: {
          temporaryMediaExpiresAt: expiresAt,
          temporaryMediaExpiredAt: now
        }
      }
    );
    return;
  }

  await PublishJob.updateMany(
    { workspaceId, postGroupId, status: { $in: UNSUCCESSFUL_TERMINAL_STATUSES }, temporaryMediaExpiredAt: null },
    { $set: { temporaryMediaExpiresAt: expiresAt } }
  );
};

const updatePublishJobStage = async (job, stage, message, mediaProcessing = {}) => {
  job.processingStage = stage;
  job.processingMessage = message;
  job.processingStageUpdatedAt = new Date();
  if (Object.keys(mediaProcessing).length > 0) {
    job.mediaProcessing = {
      ...(job.mediaProcessing || {}),
      ...mediaProcessing
    };
  }
  await job.save();
  emitRealtimeEvent('publishing:job_updated', job);
};

const isFileTooLargeResult = ({ result, connector }) =>
  FILE_TOO_LARGE_CODES.includes(result?.code) || connector?.isFileTooLargeResult?.(result);

const buildMediaPolicyItems = mediaAssets =>
  mediaAssets.map(asset => ({
    mediaAssetId: String(asset._id || ''),
    originalName: asset.originalName,
    mimeType: asset.mimeType,
    size: Number(asset.size || 0),
    mediaType: asset.mediaType
  }));

const hasExactMaxBytes = item => Number.isFinite(Number(item?.maxBytes)) && Number(item.maxBytes) > 0;

const resolveCompressionTargets = async ({ connector, connection, mediaAssets, requireExactPolicy = false, requireOversizedTarget = false }) => {
  let policy;
  try {
    policy = await connector.getMediaUploadPolicy({
      connection,
      mediaItems: buildMediaPolicyItems(mediaAssets)
    });
  } catch (error) {
    policy = {
      ok: false,
      code: error.code || 'PROVIDER_MEDIA_POLICY_FAILED',
      message: error.message || 'Provider media policy lookup failed.',
      data: {}
    };
  }

  if (!policy.ok) {
    return {
      ok: false,
      code: policy.code || 'PROVIDER_MEDIA_POLICY_FAILED',
      message: `${connector.getDisplayName()} could not return media upload limits from its provider API: ${policy.message}`,
      data: policy.data || {}
    };
  }

  const policyData = policy.data || {};
  if (requireExactPolicy && !policyData.policyAvailable) {
    return {
      ok: false,
      code: 'PROVIDER_MEDIA_POLICY_UNAVAILABLE',
      message: `${connector.getDisplayName()} does not expose an exact provider max size for these media files, so CreatorOps will not compress to a guessed limit.`,
      data: policyData
    };
  }

  const oversizedMedia = Array.isArray(policyData.oversizedMedia) ? policyData.oversizedMedia : [];
  const missingExactMax = oversizedMedia.filter(item => item.compressionAvailable && !hasExactMaxBytes(item));
  if (missingExactMax.length > 0) {
    return {
      ok: false,
      code: 'PROVIDER_MEDIA_LIMIT_UNKNOWN',
      message: `${connector.getDisplayName()} reported media is too large but did not return an exact max byte limit, so CreatorOps will not compress to a guessed size.`,
      data: { ...policyData, missingExactMax }
    };
  }

  const targets = oversizedMedia
    .filter(item => item.compressionAvailable && hasExactMaxBytes(item))
    .map(item => ({
      mediaAssetId: item.mediaAssetId ? String(item.mediaAssetId) : '',
      originalName: item.originalName,
      mimeType: item.mimeType,
      mediaType: item.mediaType,
      currentBytes: Number(item.size || item.currentBytes || 0),
      maxBytes: Math.floor(Number(item.maxBytes))
    }));

  if (requireOversizedTarget && targets.length === 0) {
    return {
      ok: false,
      code: 'PROVIDER_MEDIA_LIMIT_UNKNOWN',
      message: `${connector.getDisplayName()} rejected the upload as too large but did not return an exact compressible max size for the selected media.`,
      data: policyData
    };
  }

  return {
    ok: true,
    data: {
      policy: policyData,
      targets
    }
  };
};

const describeCompressionTargets = targets =>
  targets
    .map(target => `${target.originalName || 'media'} <= ${target.maxBytes} bytes`)
    .join(', ');

const uploadWithProviderSizedCompression = async ({ connector, payload, connection, job, requireOversizedTarget = false }) => {
  const controlBeforePolicy = await checkPayloadPublishControl(payload);
  if (controlBeforePolicy) return controlBeforePolicy;

  const targetPlan = await resolveCompressionTargets({
    connector,
    connection,
    mediaAssets: payload.mediaAssets,
    requireExactPolicy: true,
    requireOversizedTarget
  });

  if (!targetPlan.ok) return targetPlan;

  const targets = targetPlan.data.targets;
  if (targets.length === 0) {
    await updatePublishJobStage(job, 'uploading', `${connector.getDisplayName()} provider policy accepts the current media size; uploading original media.`);
    const controlBeforeOriginalUpload = await checkPayloadPublishControl(payload);
    if (controlBeforeOriginalUpload) return controlBeforeOriginalUpload;
    return connector.publish(payload, connection);
  }

  let derivativePaths = [];
  try {
    const controlBeforeCompression = await checkPayloadPublishControl(payload);
    if (controlBeforeCompression) return controlBeforeCompression;

    await updatePublishJobStage(job, 'compressing', `Compressing media to the exact ${connector.getDisplayName()} provider max size before upload.`, {
      lastCompressionStatus: 'compressing',
      lastCompressionMessage: describeCompressionTargets(targets),
      lastCompressedAt: new Date()
    });

    const compressed = await createCompressedMediaAssets({
      workspaceId: job.workspaceId,
      jobId: job._id,
      platform: job.platform,
      mediaAssets: payload.mediaAssets,
      mediaTargets: targets,
      level: Math.min(3, Math.max(1, job.retryCount + 1))
    });
    derivativePaths = compressed.derivativePaths;

    const controlAfterCompression = await checkPayloadPublishControl(payload);
    if (controlAfterCompression) return controlAfterCompression;

    await updatePublishJobStage(job, 'uploading_compressed', `Uploading provider-sized compressed media to ${connector.getDisplayName()}.`, {
      lastCompressionStatus: 'ready',
      lastCompressionMessage: 'Compressed derivative is under the provider max size and ready for upload.'
    });

    const compressedResult = await connector.publish({ ...payload, mediaAssets: compressed.mediaAssets }, connection);
    await updatePublishJobStage(job, compressedResult.ok ? 'provider_uploaded' : 'provider_rejected', compressedResult.message || '', {
      lastCompressionStatus: compressedResult.ok ? 'uploaded' : 'failed',
      lastCompressionMessage: compressedResult.message || ''
    });
    return compressedResult;
  } catch (error) {
    return {
      ok: false,
      code: error.code || 'MEDIA_COMPRESSION_FAILED',
      message: error.message || 'Media compression failed before provider upload.',
      data: {}
    };
  } finally {
    await deleteDerivativeFiles(derivativePaths);
  }
};

const publishWithOptionalCompression = async ({ connector, payload, connection, job }) => {
  const controlBeforePublish = await checkPayloadPublishControl(payload);
  if (controlBeforePublish) return controlBeforePublish;

  if (job.mediaProcessing?.compressBeforeUpload) {
    return uploadWithProviderSizedCompression({
      connector,
      payload,
      connection,
      job,
      requireOversizedTarget: false
    });
  }

  await updatePublishJobStage(job, 'uploading', `Uploading media to ${connector.getDisplayName()}.`);
  const controlBeforeOriginalUpload = await checkPayloadPublishControl(payload);
  if (controlBeforeOriginalUpload) return controlBeforeOriginalUpload;
  const firstResult = await connector.publish(payload, connection);
  if (firstResult.ok || !isFileTooLargeResult({ result: firstResult, connector })) {
    return firstResult;
  }

  if (!job.mediaProcessing?.compressOnOversize) {
    return {
      ...firstResult,
      message: `${firstResult.message} Enable compression for this platform and retry from Publishing.`
    };
  }

  return uploadWithProviderSizedCompression({
    connector,
    payload,
    connection,
    job,
    requireOversizedTarget: true
  });
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
  groupTargetCount: Math.max(1, Number(input.groupTargetCount) || 1),
  campaignId: input.campaignId || null,
  contentItemId: input.contentItemId || null,
  mediaAssetIds: Array.isArray(input.mediaAssetIds) ? input.mediaAssetIds : [],
  mediaProcessing: {
    compressOnOversize: Boolean(input.mediaProcessing?.compressOnOversize),
    compressBeforeUpload: Boolean(input.mediaProcessing?.compressBeforeUpload)
  },
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

export const getPublishMediaPlan = async ({ user, input }) => {
  requirePublishPermission(user);
  const mediaItems = Array.isArray(input.mediaItems) ? input.mediaItems : [];
  const connectionTargets = Array.isArray(input.connectionTargets) ? input.connectionTargets : [];

  const targets = [];
  for (const target of connectionTargets) {
    if (!target.connectionId) continue;

    const connection = await getConnectionWithSecrets({ user, connectionId: target.connectionId });
    const platform = getPublishPlatform({
      input: {
        targetPlatform: target.platform ? normalizePlatform(target.platform) : ''
      },
      connection
    });
    const connector = getConnector(platform);
    if (!connector) {
      targets.push({
        connectionId: String(target.connectionId),
        platform,
        targetKey: `${target.connectionId}:${platform}`,
        ok: false,
        promptForCompression: false,
        message: 'No connector is registered for this platform.'
      });
      continue;
    }

    let policy;
    try {
      policy = await connector.getMediaUploadPolicy({ connection, mediaItems });
    } catch (error) {
      policy = {
        ok: false,
        code: error.code || 'PROVIDER_MEDIA_POLICY_FAILED',
        message: error.message || 'Provider media policy lookup failed.',
        data: {
          platform,
          displayName: connector.getDisplayName(),
          source: 'provider_api_error',
          policyAvailable: false,
          compressionSupported: false,
          promptForCompression: false,
          mediaChecks: [],
          oversizedMedia: [],
          prompts: []
        }
      };
    }
    targets.push({
      connectionId: String(target.connectionId),
      platform,
      targetKey: `${target.connectionId}:${platform}`,
      accountName: connection.accountName,
      accountHandle: connection.accountHandle,
      ok: Boolean(policy.ok),
      source: policy.data?.source || 'connector',
      policyAvailable: Boolean(policy.data?.policyAvailable),
      compressionSupported: Boolean(policy.data?.compressionSupported),
      promptForCompression: Boolean(policy.data?.promptForCompression),
      mediaChecks: policy.data?.mediaChecks || [],
      oversizedMedia: policy.data?.oversizedMedia || [],
      prompts: policy.data?.prompts || [],
      message: policy.message
    });
  }

  return { targets };
};

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
  const refreshAttempt = await refreshStoredConnectionIfNeeded({ connection, connector });
  if (refreshAttempt.result && !refreshAttempt.result.ok && refreshAttempt.result.code !== 'CAPABILITY_UNAVAILABLE') {
    return {
      ok: false,
      code: refreshAttempt.result.code,
      message: refreshAttempt.result.message,
      data: { ...(refreshAttempt.result.data || {}), platform: finalPublishPlatform },
      connection: sanitizeConnection(connection),
      variant,
      contentItem: null,
      mediaAssets: []
    };
  }
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
  let result = connector.validatePublishPayload(payload, connection);
  if (result.ok) {
    result = await connector.validateTargetMedia(payload, connection);
  }

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

const createBlockedPublishJob = async ({ user, input, validation, publishNow }) => {
  const scheduledAt = publishNow ? new Date() : input.scheduledAt;
  const publishPlatform = validation.data?.platform || validation.variant?.platform || input.targetPlatform || validation.connection?.platform;

  if (!publishPlatform) {
    throw createHttpError(validation.message, 400, validation.code);
  }

  const job = await PublishJob.create({
    workspaceId: user.workspaceId,
    postGroupId: input.postGroupId,
    groupTargetCount: input.groupTargetCount,
    campaignId: input.campaignId || validation.variant?.campaignId || validation.contentItem?.campaignId || null,
    contentItemId: validation.contentItem?._id || input.contentItemId || null,
    variantId: validation.variant?._id || input.variantId || null,
    mediaAssetIds: validation.mediaAssets?.length ? validation.mediaAssets.map(asset => asset._id) : input.mediaAssetIds,
    platformConnectionId: input.platformConnectionId,
    platform: publishPlatform,
    accountSnapshot: buildAccountSnapshot(validation.connection || {}, publishPlatform),
    caption: input.caption || validation.variant?.caption || '',
    visibility: input.visibility,
    scheduledAt: Number.isNaN(scheduledAt.getTime()) ? new Date() : scheduledAt,
    status: 'blocked',
    errorCode: validation.code || 'VALIDATION_FAILED',
    errorMessage: validation.message,
    processingStage: 'blocked',
    processingMessage: validation.message,
    processingStageUpdatedAt: new Date(),
    mediaProcessing: input.mediaProcessing,
    createdBy: user._id
  });

  await createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType: 'publish.blocked',
    message: validation.message,
    entityType: 'PublishJob',
    entityId: job._id,
    metadata: {
      publishJobId: job._id,
      code: validation.code,
      platform: publishPlatform,
      platformConnectionId: input.platformConnectionId
    }
  });

  await refreshTemporaryMediaLifecycleForGroup({ workspaceId: user.workspaceId, postGroupId: job.postGroupId });

  emitRealtimeEvent('publishing:job_updated', job);
  return getPublishJobById({ user, jobId: job._id });
};

export const createPublishJob = async ({ user, input, publishNow = false }) => {
  requirePublishPermission(user);
  const normalized = normalizePublishInput(input);
  if (!normalized.postGroupId) normalized.postGroupId = createPostGroupId();

  if (normalized.postGroupId && normalized.platformConnectionId && normalized.targetPlatform) {
    const existingJob = await PublishJob.findOne({
      workspaceId: user.workspaceId,
      postGroupId: normalized.postGroupId,
      platformConnectionId: normalized.platformConnectionId,
      platform: normalized.targetPlatform
    }).sort({ createdAt: -1 });

    if (existingJob) {
      return getPublishJobById({ user, jobId: existingJob._id });
    }
  }

  const validation = await validatePublishPayload({ user, input: normalized });

  if (!validation.ok) {
    await persistValidationFailure({ user, input: normalized, result: validation });
    return createBlockedPublishJob({ user, input: normalized, validation, publishNow });
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
    groupTargetCount: normalized.groupTargetCount,
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
    processingStage: publishNow ? 'queued_now' : 'scheduled',
    processingMessage: publishNow ? 'Queued for immediate publishing.' : 'Scheduled and waiting for its publish time.',
    processingStageUpdatedAt: new Date(),
    mediaProcessing: normalized.mediaProcessing,
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
    return getPublishJobById({ user, jobId: job._id });
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
  if (!['queued', 'publishing', 'paused', 'blocked', 'failed'].includes(job.status)) {
    throw createHttpError('Only queued, publishing, paused, blocked, or failed publish jobs can be cancelled.', 400);
  }

  if (job.status === 'publishing' && requestActivePublishControl({ jobId: job._id, action: CONTROL_ACTIONS.CANCEL })) {
    job.publishControl = {
      action: CONTROL_ACTIONS.CANCEL,
      requestedAt: new Date(),
      requestedBy: user._id,
      message: 'Cancel requested. Active upload will stop at the next safe checkpoint; provider calls already accepted cannot be undone.'
    };
    job.processingStage = 'cancel_requested';
    job.processingMessage = 'Cancel requested. Active upload will stop at the next safe checkpoint; provider calls already accepted cannot be undone.';
    job.processingStageUpdatedAt = new Date();
    await job.save();
    await createWorkflowEvent({
      workspaceId: user.workspaceId,
      actorId: user._id,
      eventType: 'publish.cancel_requested',
      message: 'Cancel requested for active publish job.',
      entityType: 'PublishJob',
      entityId: job._id,
      metadata: { publishJobId: job._id }
    });
    emitRealtimeEvent('publishing:job_updated', job);
    return getPublishJobById({ user, jobId });
  }

  job.status = 'cancelled';
  clearPublishControl(job);
  job.processingStage = 'cancelled';
  job.processingMessage = 'Publish job cancelled.';
  job.processingStageUpdatedAt = new Date();
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
  await refreshTemporaryMediaLifecycleForGroup({ workspaceId: job.workspaceId, postGroupId: job.postGroupId });
  emitRealtimeEvent('publishing:job_updated', job);
  return getPublishJobById({ user, jobId });
};

export const pausePublishJob = async ({ user, jobId }) => {
  requirePublishPermission(user);
  const job = await PublishJob.findOne({ _id: jobId, workspaceId: user.workspaceId });
  if (!job) throw createHttpError('Publish job not found.', 404);
  if (!['queued', 'publishing'].includes(job.status)) {
    throw createHttpError('Only queued or publishing jobs can be paused.', 400);
  }
  const previousStatus = job.status;

  if (job.status === 'publishing' && requestActivePublishControl({ jobId: job._id, action: CONTROL_ACTIONS.PAUSE })) {
    job.publishControl = {
      action: CONTROL_ACTIONS.PAUSE,
      requestedAt: new Date(),
      requestedBy: user._id,
      message: 'Pause requested. Active upload will pause at the next safe checkpoint.'
    };
    job.processingStage = 'pause_requested';
    job.processingMessage = 'Pause requested. Active upload will pause at the next safe checkpoint.';
    job.processingStageUpdatedAt = new Date();
    await job.save();
    await createWorkflowEvent({
      workspaceId: user.workspaceId,
      actorId: user._id,
      eventType: 'publish.pause_requested',
      message: 'Pause requested for active publish job.',
      entityType: 'PublishJob',
      entityId: job._id,
      metadata: { publishJobId: job._id }
    });
    emitRealtimeEvent('publishing:job_updated', job);
    return getPublishJobById({ user, jobId });
  }

  job.status = 'paused';
  clearPublishControl(job);
  job.processingStage = 'paused';
  job.processingMessage = previousStatus === 'queued'
    ? 'Publish job paused before upload.'
    : 'Publish job paused. Resume it to queue a fresh safe attempt with retained media.';
  job.processingStageUpdatedAt = new Date();
  await job.save();
  await createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType: 'publish.paused',
    message: 'Publish job paused.',
    entityType: 'PublishJob',
    entityId: job._id,
    metadata: { publishJobId: job._id }
  });
  await refreshTemporaryMediaLifecycleForGroup({ workspaceId: job.workspaceId, postGroupId: job.postGroupId });
  emitRealtimeEvent('publishing:job_updated', job);
  return getPublishJobById({ user, jobId });
};

export const resumePublishJob = async ({ user, jobId }) => {
  requirePublishPermission(user);
  const job = await PublishJob.findOne({ _id: jobId, workspaceId: user.workspaceId });
  if (!job) throw createHttpError('Publish job not found.', 404);
  if (job.status !== 'paused') {
    throw createHttpError('Only paused publish jobs can be resumed.', 400);
  }
  if (job.temporaryMediaExpiredAt) {
    throw createHttpError('Temporary media expired and was deleted. This publish job can no longer be resumed.', 400, 'TEMPORARY_MEDIA_EXPIRED');
  }

  job.status = 'queued';
  clearPublishControl(job);
  job.processingStage = 'queued_resume';
  job.processingMessage = 'Paused publish job resumed and queued.';
  job.processingStageUpdatedAt = new Date();
  job.temporaryMediaExpiresAt = null;
  await job.save();
  if (job.postGroupId) {
    await PublishJob.updateMany(
      { workspaceId: job.workspaceId, postGroupId: job.postGroupId, temporaryMediaExpiredAt: null },
      { $set: { temporaryMediaExpiresAt: null } }
    );
  }
  await createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType: 'publish.resumed',
    message: 'Publish job resumed.',
    entityType: 'PublishJob',
    entityId: job._id,
    metadata: { publishJobId: job._id }
  });
  emitRealtimeEvent('publishing:job_updated', job);
  return getPublishJobById({ user, jobId });
};

export const retryPublishJob = async ({ user, jobId, input = {} }) => {
  requirePublishPermission(user);
  const job = await PublishJob.findOne({ _id: jobId, workspaceId: user.workspaceId });
  if (!job) throw createHttpError('Publish job not found.', 404);
  if (!['failed', 'blocked'].includes(job.status)) {
    throw createHttpError('Only failed or blocked publish jobs can be retried.', 400);
  }
  if (job.temporaryMediaExpiredAt) {
    throw createHttpError('Temporary media expired and was deleted. This publish job can no longer be retried.', 400, 'TEMPORARY_MEDIA_EXPIRED');
  }
  job.status = 'queued';
  job.retryCount += 1;
  job.errorCode = '';
  job.errorMessage = '';
  clearPublishControl(job);
  job.processingStage = 'queued_retry';
  job.processingMessage = 'Retry queued.';
  job.processingStageUpdatedAt = new Date();
  if (Object.prototype.hasOwnProperty.call(input, 'mediaProcessing')) {
    job.mediaProcessing = {
      ...(job.mediaProcessing || {}),
      compressOnOversize: Boolean(input.mediaProcessing?.compressOnOversize),
      compressBeforeUpload: Boolean(input.mediaProcessing?.compressBeforeUpload)
    };
  }
  job.temporaryMediaExpiresAt = null;
  await job.save();
  if (job.postGroupId) {
    await PublishJob.updateMany(
      { workspaceId: job.workspaceId, postGroupId: job.postGroupId, temporaryMediaExpiredAt: null },
      { $set: { temporaryMediaExpiresAt: null } }
    );
  }
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

const finalizeControlledPublishJob = async ({ job, result }) => {
  const isPaused = result.code === 'PUBLISH_PAUSED';
  job.status = isPaused ? 'paused' : 'cancelled';
  job.errorCode = '';
  job.errorMessage = '';
  clearPublishControl(job);
  job.processingStage = isPaused ? 'paused' : 'cancelled';
  job.processingMessage = result.message;
  job.processingStageUpdatedAt = new Date();
  await job.save();
  await createWorkflowEvent({
    workspaceId: job.workspaceId,
    actorId: job.createdBy,
    eventType: isPaused ? 'publish.paused' : 'publish.cancelled',
    message: result.message,
    entityType: 'PublishJob',
    entityId: job._id,
    metadata: { publishJobId: job._id, code: result.code, platform: job.platform }
  });
  await refreshTemporaryMediaLifecycleForGroup({
    workspaceId: job.workspaceId,
    postGroupId: job.postGroupId
  });
  emitRealtimeEvent('publishing:job_updated', job);
  return job;
};

export const processPublishJob = async ({ jobId }) => {
  const lockedJob = await PublishJob.findOneAndUpdate(
    {
      _id: jobId,
      status: 'queued'
    },
    {
      status: 'publishing',
      lastAttemptAt: new Date(),
      processingStage: 'starting',
      processingMessage: 'Starting publish job.',
      processingStageUpdatedAt: new Date(),
      publishControl: {
        action: '',
        requestedAt: null,
        requestedBy: null,
        message: ''
      }
    },
    { new: true }
  );

  if (!lockedJob) {
    return PublishJob.findById(jobId);
  }

  emitRealtimeEvent('publishing:job_updated', lockedJob);
  const abortController = new AbortController();
  activePublishControls.set(String(lockedJob._id), { controller: abortController, action: '' });

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
    const earlyControl = await checkPublishControl(lockedJob);
    if (earlyControl) return finalizeControlledPublishJob({ job: lockedJob, result: earlyControl });

    await updatePublishJobStage(lockedJob, 'checking_connection', 'Checking platform connection and credentials.');
    const connection = await PlatformConnection.findOne({
      _id: lockedJob.platformConnectionId,
      workspaceId: lockedJob.workspaceId
    }).select('+encryptedAccessToken +encryptedRefreshToken +encryptedApiSecret +encryptedAppPassword');
    const connector = getConnector(lockedJob.platform);
    if (!connection || !connector) {
      throw createHttpError('Publishing connection is unavailable.', 400, 'NOT_CONNECTED');
    }
    const refreshAttempt = await refreshStoredConnectionIfNeeded({ connection, connector });
    if (refreshAttempt.result && !refreshAttempt.result.ok && refreshAttempt.result.code !== 'CAPABILITY_UNAVAILABLE') {
      throw createHttpError(refreshAttempt.result.message, 400, refreshAttempt.result.code);
    }
    const connectionControl = await checkPublishControl(lockedJob);
    if (connectionControl) return finalizeControlledPublishJob({ job: lockedJob, result: connectionControl });

    await updatePublishJobStage(lockedJob, 'loading_media', 'Loading temporary media for provider upload.');
    const mediaAssets = await MediaAsset.find({
      _id: { $in: lockedJob.mediaAssetIds },
      workspaceId: lockedJob.workspaceId
    }).select('+localPath');
    const payload = {
      caption: lockedJob.caption,
      mediaAssets,
      platform: lockedJob.platform,
      ...(getVisibilityOptions(lockedJob.platform).length > 1 ? { visibility: lockedJob.visibility } : {}),
      account: sanitizeConnection(connection),
      abortSignal: abortController.signal,
      checkPublishControl: () => checkPublishControl(lockedJob),
      onUploadProgress: async ({ phase, bytesUploaded = 0, totalBytes = 0 }) => {
        const percent = totalBytes > 0 ? Math.min(100, Math.floor((bytesUploaded / totalBytes) * 100)) : 0;
        if (phase === 'initializing') {
          await updatePublishJobStage(lockedJob, 'initializing_provider_upload', `Starting ${connector.getDisplayName()} resumable media upload.`);
          return;
        }
        if (phase === 'uploaded') {
          await updatePublishJobStage(lockedJob, 'provider_uploaded', `${connector.getDisplayName()} media upload reached 100%.`);
          return;
        }
        await updatePublishJobStage(lockedJob, 'uploading', `Uploading media to ${connector.getDisplayName()}: ${percent}% complete.`);
      }
    };
    const result = await publishWithOptionalCompression({ connector, payload, connection, job: lockedJob });

    if (!result.ok) {
      if (['PUBLISH_PAUSED', 'PUBLISH_CANCELLED'].includes(result.code)) {
        return finalizeControlledPublishJob({ job: lockedJob, result });
      }
      const controlAfterProviderReturn = await checkPublishControl(lockedJob);
      if (controlAfterProviderReturn) {
        return finalizeControlledPublishJob({ job: lockedJob, result: controlAfterProviderReturn });
      }
      const blockedCodes = ['NOT_CONFIGURED', 'MISSING_PERMISSIONS', 'PAYMENT_REQUIRED', 'HTTP_402', 'PLATFORM_REVIEW_REQUIRED', 'CAPABILITY_UNAVAILABLE', 'NOT_IMPLEMENTED', 'NOT_CONNECTED', 'SHORTS_MEDIA_INELIGIBLE', 'SHORTS_MEDIA_UNVERIFIED'];
      lockedJob.status = blockedCodes.includes(result.code) ? 'blocked' : 'failed';
      lockedJob.errorCode = result.code;
      lockedJob.errorMessage = result.message;
      lockedJob.processingStage = result.code === 'NETWORK_ERROR' ? 'provider_unreachable' : lockedJob.status;
      lockedJob.processingMessage = result.message;
      lockedJob.processingStageUpdatedAt = new Date();
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
      await refreshTemporaryMediaLifecycleForGroup({
        workspaceId: lockedJob.workspaceId,
        postGroupId: lockedJob.postGroupId
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
    clearPublishControl(lockedJob);
    lockedJob.processingStage = 'published';
    lockedJob.processingMessage = result.message || 'Provider upload completed.';
    lockedJob.processingStageUpdatedAt = new Date();
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

    await refreshTemporaryMediaLifecycleForGroup({
      workspaceId: lockedJob.workspaceId,
      postGroupId: lockedJob.postGroupId
    });

    emitRealtimeEvent('publishing:job_updated', lockedJob);
    return lockedJob;
  } catch (error) {
    const controlResult = await checkPublishControl(lockedJob);
    if (controlResult) {
      return finalizeControlledPublishJob({ job: lockedJob, result: controlResult });
    }
    const errorCode = error.code || (/fetch failed/i.test(error.message || '') ? 'NETWORK_ERROR' : 'UNEXPECTED_ERROR');
    lockedJob.status = error.code === 'NOT_CONNECTED' ? 'blocked' : 'failed';
    lockedJob.errorCode = errorCode;
    lockedJob.errorMessage = errorCode === 'NETWORK_ERROR'
      ? 'The platform API could not be reached from the CreatorOps server. Retry the action after checking server network access.'
      : error.message || 'Publishing failed unexpectedly.';
    lockedJob.processingStage = errorCode === 'NETWORK_ERROR' ? 'provider_unreachable' : lockedJob.status;
    lockedJob.processingMessage = lockedJob.errorMessage;
    lockedJob.processingStageUpdatedAt = new Date();
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
    await refreshTemporaryMediaLifecycleForGroup({
      workspaceId: lockedJob.workspaceId,
      postGroupId: lockedJob.postGroupId
    });
    emitRealtimeEvent('publishing:job_updated', lockedJob);
    return lockedJob;
  } finally {
    activePublishControls.delete(String(lockedJob._id));
  }
};

export const processDuePublishJobs = async () => {
  await processStalePublishingJobs();
  const dueJobs = await PublishJob.find({
    status: 'queued',
    scheduledAt: { $lte: new Date() }
  })
    .sort({ scheduledAt: 1 })
    .limit(10);

  await Promise.allSettled(dueJobs.map(job => processPublishJob({ jobId: job._id })));
};

export const processStalePublishingJobs = async ({ now = new Date() } = {}) => {
  const cutoff = new Date(now.getTime() - STALE_PUBLISH_JOB_MS);
  const staleJobs = await PublishJob.find({
    status: 'publishing',
    $or: [
      { processingStageUpdatedAt: { $lte: cutoff } },
      { processingStageUpdatedAt: null, lastAttemptAt: { $lte: cutoff } }
    ]
  });

  for (const job of staleJobs) {
    const controlResult = getControlResult(job.publishControl?.action);
    if (controlResult) {
      job.status = controlResult.code === 'PUBLISH_PAUSED' ? 'paused' : 'cancelled';
      job.errorCode = '';
      job.errorMessage = '';
      clearPublishControl(job);
      job.processingStage = job.status;
      job.processingMessage = controlResult.message;
    } else {
      job.status = 'failed';
      job.errorCode = 'PUBLISH_INTERRUPTED';
      job.errorMessage = 'This upload stopped before CreatorOps received a final platform result. Check the platform for a completed post before retrying to avoid a duplicate upload.';
      job.processingStage = 'interrupted';
      job.processingMessage = job.errorMessage;
    }
    job.processingStageUpdatedAt = now;
    await job.save();
    await createWorkflowEvent({
      workspaceId: job.workspaceId,
      actorId: job.createdBy,
      eventType: job.status === 'failed' ? 'publish.failed' : `publish.${job.status}`,
      message: job.processingMessage,
      entityType: 'PublishJob',
      entityId: job._id,
      metadata: { publishJobId: job._id, code: job.errorCode, platform: job.platform }
    });
    await refreshTemporaryMediaLifecycleForGroup({
      workspaceId: job.workspaceId,
      postGroupId: job.postGroupId,
      now
    });
    emitRealtimeEvent('publishing:job_updated', job);
  }

  return staleJobs.length;
};

export const processTemporaryPublishMediaCleanup = async () => {
  const now = new Date();
  const retentionSeconds = await getTemporaryMediaRetentionSeconds();
  const temporaryAssets = await MediaAsset.find({ storageIntent: 'temporary_publish' }).select(
    'workspaceId cleanupGroupId createdAt'
  );
  const groups = new Map();

  for (const asset of temporaryAssets) {
    const workspaceId = String(asset.workspaceId);
    const cleanupGroupId = asset.cleanupGroupId || '';
    const key = `${workspaceId}:${cleanupGroupId || asset._id}`;
    const existing = groups.get(key) || {
      workspaceId: asset.workspaceId,
      cleanupGroupId,
      mediaAssetIds: [],
      latestAssetCreatedAt: new Date(0)
    };

    existing.mediaAssetIds.push(asset._id);
    if (asset.createdAt && asset.createdAt > existing.latestAssetCreatedAt) {
      existing.latestAssetCreatedAt = asset.createdAt;
    }
    groups.set(key, existing);
  }

  for (const group of groups.values()) {
    if (!group.cleanupGroupId) {
      const orphanExpiresAt = new Date(group.latestAssetCreatedAt.getTime() + retentionSeconds * 1000);
      if (orphanExpiresAt <= now) {
        await deleteTemporaryMediaAssets({
          workspaceId: group.workspaceId,
          mediaAssetIds: group.mediaAssetIds
        });
      }
      continue;
    }

    const jobCount = await PublishJob.countDocuments({
      workspaceId: group.workspaceId,
      postGroupId: group.cleanupGroupId
    });

    if (jobCount === 0) {
      const orphanGroupExpiresAt = new Date(group.latestAssetCreatedAt.getTime() + retentionSeconds * 1000);
      if (orphanGroupExpiresAt <= now) {
        await deleteTemporaryMediaAssets({
          workspaceId: group.workspaceId,
          mediaAssetIds: group.mediaAssetIds
        });
      }
      continue;
    }

    await refreshTemporaryMediaLifecycleForGroup({
      workspaceId: group.workspaceId,
      postGroupId: group.cleanupGroupId,
      now,
      retentionSeconds
    });
  }
};
