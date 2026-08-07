import ApprovalRequest from '../models/ApprovalRequest.js';
import ContentItem from '../models/ContentItem.js';
import Deliverable from '../models/Deliverable.js';
import PlatformVariant from '../models/PlatformVariant.js';
import { isContentCreatorRole } from '../constants/roles.js';
import { TEAM_PERMISSIONS } from '../constants/teamPermissions.js';
import { createWorkflowEvent } from './event.service.js';
import { hydrateMediaAssetPublicUrls } from './media.service.js';
import { scopeByVisibleProjects } from './projectAccess.service.js';
import { createVariantVersion } from './versioning.service.js';

const createHttpError = (message, statusCode, code = '') => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
};

const requireContentCreator = user => {
  if (!isContentCreatorRole(user)) {
    throw createHttpError('Forbidden: Content Creator role is required for this review action.', 403);
  }
};

/*
 * A solo creator has no team context and reviews their own work, so the team
 * check degrades to "allow". Inside a team the position decides.
 */
const requireDecidePermission = team => {
  if (!team || team.isOwner || team.can(TEAM_PERMISSIONS.APPROVAL_DECIDE)) return;
  throw createHttpError(
    'Your position in this team does not allow approving work.',
    403,
    'TEAM_PERMISSION_DENIED'
  );
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
    throw createHttpError('Pending review request not found.', 404);
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
        ? `Creator review requested for ${variant.platform} variant.`
        : `Creator review ${newStatus} for ${variant.platform} variant.`,
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
    throw createHttpError('A pending review request already exists for this variant.', 409);
  }

  if (variant.status !== 'draft') {
    throw createHttpError('Only draft variants can be queued for creator review.', 400);
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
    changeNote: comment || 'Creator review requested'
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

/**
 * The review queue.
 *
 * Previously this returned every pending approval in the workspace, which inside
 * a team would show a Designer the whole company's work. It is now scoped twice:
 * to the projects the caller can see, and — for anyone without approval.decide —
 * to their own submissions, so a member can still track what they sent in.
 *
 * Deliverable submissions and the original per-variant compose flow both land
 * here, because a head wants one queue, not two.
 */
export const getPendingApprovals = async ({ user, team = null, query = {} }) => {
  requireContentCreator(user);

  const canDecide = !team || team.isOwner || team.can(TEAM_PERMISSIONS.APPROVAL_DECIDE);

  const baseFilter = { workspaceId: user.workspaceId, status: 'pending' };
  if (query.kind) baseFilter.kind = query.kind;
  if (!canDecide) baseFilter.requestedBy = user._id;

  /*
   * Rows carrying a projectId are filtered by project visibility; legacy rows
   * without one predate projects and stay visible to anyone who may decide.
   */
  const scoped = await scopeByVisibleProjects({ user, team, filter: baseFilter, field: 'projectId' });
  const filter =
    scoped === baseFilter
      ? baseFilter
      : { ...baseFilter, $or: [{ projectId: null }, { projectId: scoped.projectId }] };

  const approvals = await ApprovalRequest.find(filter)
    .sort({ createdAt: -1 })
    .populate('requestedBy', 'name email role profile.avatarUrl')
    .populate('reviewedBy', 'name email role')
    .populate('contentItemId', 'title rawIdea status')
    .populate('projectId', 'name status')
    .populate('variantId', 'platform caption hook cta hashtags brandScore readinessScore status warnings suggestions aiProvider');

  /* Deliverable approvals carry their bundle so the queue can show the work. */
  const deliverableIds = approvals
    .filter(approval => approval.subjectType === 'Deliverable' && approval.subjectId)
    .map(approval => approval.subjectId);

  const deliverables = deliverableIds.length
    ? await Deliverable.find({ _id: { $in: deliverableIds } })
        .populate('ownerId', 'name email profile.avatarUrl')
        .populate({ path: 'mediaAssetIds', select: '+objectKey' })
        .populate('variantIds', 'platform caption hook cta status')
    : [];

  await Promise.all(deliverables.map(deliverable => hydrateMediaAssetPublicUrls(deliverable.mediaAssetIds)));
  const deliverableById = Object.fromEntries(deliverables.map(item => [String(item._id), item]));

  return approvals.map(approval => ({
    ...approval.toObject(),
    deliverable: approval.subjectType === 'Deliverable' ? deliverableById[String(approval.subjectId)] || null : null,
    canDecide
  }));
};

const completeApprovalDecision = async ({ approvalId, user, team = null, comment = '', decisionStatus, eventType }) => {
  requireContentCreator(user);
  requireDecidePermission(team);

  const approval = await findPendingApproval(user, approvalId);
  const variant = await findScopedVariant(user, approval.variantId);
  const contentItem = await findScopedContentItem(user, approval.contentItemId);
  const previousStatus = variant.status;

  if (variant.status !== 'in_review') {
    throw createHttpError('Only in_review variants can receive a creator review decision.', 400);
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
    changeNote: comment || `Creator review ${decisionStatus}`
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

export const approveApproval = ({ approvalId, user, team = null, comment = '' }) =>
  completeApprovalDecision({
    approvalId,
    user,
    team,
    comment,
    decisionStatus: 'approved',
    eventType: 'approval.approved'
  });

export const rejectApproval = ({ approvalId, user, team = null, comment = '' }) =>
  completeApprovalDecision({
    approvalId,
    user,
    team,
    comment,
    decisionStatus: 'rejected',
    eventType: 'approval.rejected'
  });

export const requestChanges = ({ approvalId, user, team = null, comment = '' }) =>
  completeApprovalDecision({
    approvalId,
    user,
    team,
    comment,
    decisionStatus: 'changes_requested',
    eventType: 'approval.changes_requested'
  });
