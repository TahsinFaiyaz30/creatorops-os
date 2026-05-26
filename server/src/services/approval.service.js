import ApprovalRequest from '../models/ApprovalRequest.js';
import ContentItem from '../models/ContentItem.js';
import PlatformVariant from '../models/PlatformVariant.js';
import { isContentCreatorRole } from '../constants/roles.js';
import { createWorkflowEvent } from './event.service.js';
import { createVariantVersion } from './versioning.service.js';

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const requireCreatorAdmin = user => {
  if (!isContentCreatorRole(user.role)) {
    throw createHttpError('Forbidden: Content Creator role is required for this approval action.', 403);
  }
};

const findScopedVariant = async (user, variantId) => {
  const variant = await PlatformVariant.findOne({
    _id: variantId,
    workspaceId: user.workspaceId
  });

  if (!variant) {
    throw createHttpError('Platform variant not found.', 404);
  }

  return variant;
};

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

const findPendingApproval = async (user, approvalId) => {
  const approval = await ApprovalRequest.findOne({
    _id: approvalId,
    workspaceId: user.workspaceId,
    status: 'pending'
  });

  if (!approval) {
    throw createHttpError('Pending approval request not found.', 404);
  }

  return approval;
};

const createApprovalVersion = async ({ user, contentItem, variant, approval, changeNote }) =>
  createVariantVersion({
    user,
    contentItem,
    variant,
    changeNote,
    extraSnapshot: {
      approvalStatus: approval.status,
      approvalId: approval._id,
      reviewerComment: approval.comment || '',
      reviewedBy: approval.reviewedBy || null,
      requestedBy: approval.requestedBy
    }
  });

const createApprovalEvent = async ({
  user,
  approval,
  contentItem,
  variant,
  eventType,
  previousStatus,
  newStatus
}) =>
  createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType,
    message:
      eventType === 'approval.requested'
        ? `Approval requested for ${variant.platform} variant.`
        : `Approval ${newStatus} for ${variant.platform} variant.`,
    entityType: 'ApprovalRequest',
    entityId: approval._id,
    metadata: {
      approvalId: approval._id,
      contentItemId: contentItem._id,
      variantId: variant._id,
      platform: variant.platform,
      previousStatus,
      newStatus,
      comment: approval.comment || ''
    }
  });

export const requestApproval = async ({ variantId, comment = '', user }) => {
  if (!variantId) {
    throw createHttpError('variantId is required.', 400);
  }

  const variant = await findScopedVariant(user, variantId);
  const contentItem = await findScopedContentItem(user, variant.contentItemId);

  const duplicatePending = await ApprovalRequest.findOne({
    workspaceId: user.workspaceId,
    variantId: variant._id,
    status: 'pending'
  });

  if (duplicatePending) {
    throw createHttpError('A pending approval request already exists for this variant.', 409);
  }

  if (variant.status !== 'draft') {
    throw createHttpError('Only draft variants can be submitted for approval.', 400);
  }

  const previousStatus = variant.status;

  const approval = await ApprovalRequest.create({
    workspaceId: user.workspaceId,
    contentItemId: contentItem._id,
    variantId: variant._id,
    requestedBy: user._id,
    status: 'pending',
    comment
  });

  variant.status = 'in_review';
  await variant.save();

  if (!['scheduled', 'published'].includes(contentItem.status)) {
    contentItem.status = 'in_review';
    await contentItem.save();
  }

  await createApprovalVersion({
    user,
    contentItem,
    variant,
    approval,
    changeNote: comment || 'Approval requested'
  });

  await createApprovalEvent({
    user,
    approval,
    contentItem,
    variant,
    eventType: 'approval.requested',
    previousStatus,
    newStatus: variant.status
  });

  return ApprovalRequest.findById(approval._id)
    .populate('requestedBy', 'name email role')
    .populate('reviewedBy', 'name email role')
    .populate('contentItemId', 'title rawIdea status')
    .populate('variantId');
};

export const getPendingApprovals = async ({ user }) => {
  requireCreatorAdmin(user);

  return ApprovalRequest.find({
    workspaceId: user.workspaceId,
    status: 'pending'
  })
    .sort({ createdAt: -1 })
    .populate('requestedBy', 'name email role')
    .populate('reviewedBy', 'name email role')
    .populate('contentItemId', 'title rawIdea status')
    .populate('variantId', 'platform caption hook cta hashtags brandScore readinessScore status warnings suggestions aiProvider');
};

const completeApprovalDecision = async ({ approvalId, user, comment = '', decisionStatus, eventType }) => {
  requireCreatorAdmin(user);

  const approval = await findPendingApproval(user, approvalId);
  const variant = await findScopedVariant(user, approval.variantId);
  const contentItem = await findScopedContentItem(user, approval.contentItemId);
  const previousStatus = variant.status;

  if (variant.status !== 'in_review') {
    throw createHttpError('Only in_review variants can receive an approval decision.', 400);
  }

  approval.status = decisionStatus;
  approval.reviewedBy = user._id;
  approval.comment = comment;
  await approval.save();

  variant.status = decisionStatus;
  await variant.save();

  if (!['scheduled', 'published'].includes(contentItem.status)) {
    contentItem.status = decisionStatus;
    await contentItem.save();
  }

  await createApprovalVersion({
    user,
    contentItem,
    variant,
    approval,
    changeNote: comment || `Approval ${decisionStatus}`
  });

  await createApprovalEvent({
    user,
    approval,
    contentItem,
    variant,
    eventType,
    previousStatus,
    newStatus: decisionStatus
  });

  const populatedApproval = await ApprovalRequest.findById(approval._id)
    .populate('requestedBy', 'name email role')
    .populate('reviewedBy', 'name email role')
    .populate('contentItemId', 'title rawIdea status')
    .populate('variantId');

  return {
    approval: populatedApproval,
    variant,
    contentItem
  };
};

export const approveApproval = ({ approvalId, user, comment = '' }) =>
  completeApprovalDecision({
    approvalId,
    user,
    comment,
    decisionStatus: 'approved',
    eventType: 'approval.approved'
  });

export const rejectApproval = ({ approvalId, user, comment = '' }) =>
  completeApprovalDecision({
    approvalId,
    user,
    comment,
    decisionStatus: 'rejected',
    eventType: 'approval.rejected'
  });

export const requestChanges = ({ approvalId, user, comment = '' }) =>
  completeApprovalDecision({
    approvalId,
    user,
    comment,
    decisionStatus: 'changes_requested',
    eventType: 'approval.changes_requested'
  });
