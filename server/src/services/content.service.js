import Campaign from '../models/Campaign.js';
import ContentItem from '../models/ContentItem.js';
import PlatformVariant from '../models/PlatformVariant.js';
import { createWorkflowEvent } from './event.service.js';
import { createContentVersion, listContentVersions } from './versioning.service.js';
import { validateStatusTransition } from './workflow.service.js';

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const editableFields = ['title', 'rawIdea', 'assignedTo'];

const pickContentFields = input =>
  editableFields.reduce((picked, field) => {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      picked[field] = input[field];
    }
    return picked;
  }, {});

const findScopedContentItem = async (user, contentItemId) => {
  const contentItem = await ContentItem.findOne({
    _id: contentItemId,
    workspaceId: user.workspaceId
  });

  if (!contentItem) {
    throw createHttpError('Content item not found.', 404);
  }

  return contentItem;
};

const ensureScopedCampaign = async (user, campaignId) => {
  const campaign = await Campaign.findOne({
    _id: campaignId,
    workspaceId: user.workspaceId
  });

  if (!campaign) {
    throw createHttpError('Campaign not found.', 404);
  }

  return campaign;
};

export const createContentItem = async (user, input) => {
  await ensureScopedCampaign(user, input.campaignId);

  const title = String(input.title || '').trim();
  const rawIdea = String(input.rawIdea || '').trim();

  if (!title || !rawIdea) {
    throw createHttpError('title and rawIdea are required.', 400);
  }

  const contentItem = await ContentItem.create({
    workspaceId: user.workspaceId,
    campaignId: input.campaignId,
    title,
    rawIdea,
    status: 'idea',
    createdBy: user._id,
    assignedTo: input.assignedTo || null,
    currentVersion: 1
  });

  await createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType: 'content.created',
    message: `Content item "${contentItem.title}" created.`,
    entityType: 'ContentItem',
    entityId: contentItem._id,
    metadata: {
      campaignId: contentItem.campaignId,
      status: contentItem.status
    }
  });

  await createContentVersion({
    user,
    contentItem,
    changeNote: input.changeNote || 'Initial content snapshot'
  });

  return contentItem;
};

export const listContentByCampaign = async (user, campaignId) => {
  await ensureScopedCampaign(user, campaignId);

  return ContentItem.find({
    workspaceId: user.workspaceId,
    campaignId
  })
    .sort({ createdAt: -1 })
    .populate('createdBy', 'name email role')
    .populate('assignedTo', 'name email role');
};

export const updateContentItem = async (user, contentItemId, input) => {
  const contentItem = await findScopedContentItem(user, contentItemId);
  const updates = pickContentFields(input);

  const textChanged =
    Object.prototype.hasOwnProperty.call(updates, 'title') && updates.title !== contentItem.title;
  const ideaChanged =
    Object.prototype.hasOwnProperty.call(updates, 'rawIdea') && updates.rawIdea !== contentItem.rawIdea;

  const changedFields = Object.entries(updates).filter(([field, value]) => {
    const currentValue = contentItem[field];
    return String(currentValue ?? '') !== String(value ?? '');
  });

  if (changedFields.length === 0) {
    return { contentItem, version: null };
  }

  Object.assign(contentItem, updates);

  if (textChanged || ideaChanged) {
    contentItem.currentVersion += 1;
  }

  await contentItem.save();

  let version = null;

  if (textChanged || ideaChanged) {
    version = await createContentVersion({
      user,
      contentItem,
      changeNote: input.changeNote || 'Content text updated'
    });
  }

  await createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType: 'content.updated',
    message: `Content item "${contentItem.title}" updated.`,
    entityType: 'ContentItem',
    entityId: contentItem._id,
    metadata: {
      changedFields: changedFields.map(([field]) => field),
      versionNumber: version?.versionNumber || contentItem.currentVersion
    }
  });

  return { contentItem, version };
};

export const updateContentStatus = async (user, contentItemId, input) => {
  const contentItem = await findScopedContentItem(user, contentItemId);
  const nextStatus = input.status;
  const previousStatus = contentItem.status;

  validateStatusTransition({
    user,
    fromStatus: previousStatus,
    toStatus: nextStatus
  });

  contentItem.status = nextStatus;
  await contentItem.save();

  await createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType: 'content.status_changed',
    message: `Content item "${contentItem.title}" moved from ${previousStatus} to ${nextStatus}.`,
    entityType: 'ContentItem',
    entityId: contentItem._id,
    metadata: {
      previousStatus,
      nextStatus
    }
  });

  return contentItem;
};

export const getContentVersions = async (user, contentItemId) => listContentVersions(user, contentItemId);

export const listContentVariants = async (user, contentItemId) => {
  await findScopedContentItem(user, contentItemId);

  return PlatformVariant.find({
    workspaceId: user.workspaceId,
    contentItemId
  }).sort({ platform: 1, createdAt: 1 });
};
