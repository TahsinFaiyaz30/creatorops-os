import ContentItem from '../models/ContentItem.js';
import ContentVersion from '../models/ContentVersion.js';
import PlatformVariant from '../models/PlatformVariant.js';
import { createWorkflowEvent } from './event.service.js';

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const buildContentSnapshot = contentItem => ({
  type: 'content_item',
  title: contentItem.title,
  rawIdea: contentItem.rawIdea,
  status: contentItem.status,
  currentVersion: contentItem.currentVersion
});

const buildVariantSnapshot = (variant, contentItem, extraSnapshot = {}) => ({
  type: 'platform_variant',
  contentItemStatus: contentItem?.status,
  platform: variant.platform,
  caption: variant.caption,
  hook: variant.hook,
  cta: variant.cta,
  hashtags: variant.hashtags,
  status: variant.status,
  brandScore: variant.brandScore,
  readinessScore: variant.readinessScore,
  warnings: variant.warnings,
  suggestions: variant.suggestions,
  aiProvider: variant.aiProvider,
  ...extraSnapshot
});

export const createContentVersion = async ({ user, contentItem, changeNote = '' }) => {
  const version = await ContentVersion.create({
    workspaceId: user.workspaceId,
    contentItemId: contentItem._id,
    variantId: null,
    versionNumber: contentItem.currentVersion,
    snapshot: buildContentSnapshot(contentItem),
    changedBy: user._id,
    changeNote
  });

  await createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType: 'version.created',
    message: `Version ${version.versionNumber} created for content item "${contentItem.title}".`,
    entityType: 'ContentVersion',
    entityId: version._id,
    metadata: {
      contentItemId: contentItem._id,
      versionNumber: version.versionNumber,
      changeNote
    }
  });

  return version;
};

export const createVariantVersion = async ({ user, contentItem, variant, changeNote = '', extraSnapshot = {} }) => {
  const latestVersion = await ContentVersion.findOne({
    workspaceId: user.workspaceId,
    contentItemId: contentItem._id,
    variantId: variant._id
  }).sort({ versionNumber: -1 });

  const versionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

  const version = await ContentVersion.create({
    workspaceId: user.workspaceId,
    contentItemId: contentItem._id,
    variantId: variant._id,
    versionNumber,
    snapshot: buildVariantSnapshot(variant, contentItem, extraSnapshot),
    changedBy: user._id,
    changeNote
  });

  await createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType: 'version.created',
    message: `Version ${version.versionNumber} created for ${variant.platform} variant.`,
    entityType: 'ContentVersion',
    entityId: version._id,
    metadata: {
      contentItemId: contentItem._id,
      variantId: variant._id,
      versionNumber: version.versionNumber,
      changeNote
    }
  });

  return version;
};

export const listContentVersions = async (user, contentItemId) => {
  const contentItem = await ContentItem.findOne({
    _id: contentItemId,
    workspaceId: user.workspaceId
  });

  if (!contentItem) {
    throw createHttpError('Content item not found.', 404);
  }

  return ContentVersion.find({
    workspaceId: user.workspaceId,
    contentItemId
  })
    .sort({ versionNumber: 1, createdAt: 1 })
    .populate('changedBy', 'name email role');
};

export const maybeCreateVariantVersion = async ({ user, variantId, changeNote = '' }) => {
  const variant = await PlatformVariant.findOne({
    _id: variantId,
    workspaceId: user.workspaceId
  });

  if (!variant) {
    throw createHttpError('Platform variant not found.', 404);
  }

  const contentItem = await ContentItem.findOne({
    _id: variant.contentItemId,
    workspaceId: user.workspaceId
  });

  if (!contentItem) {
    throw createHttpError('Content item not found.', 404);
  }

  return createVariantVersion({ user, contentItem, variant, changeNote });
};
