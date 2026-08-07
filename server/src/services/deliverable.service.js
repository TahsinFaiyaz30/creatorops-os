import ApprovalRequest from '../models/ApprovalRequest.js';
import ContentItem from '../models/ContentItem.js';
import Deliverable from '../models/Deliverable.js';
import MediaAsset from '../models/MediaAsset.js';
import PlatformVariant from '../models/PlatformVariant.js';
import ReviewNote from '../models/ReviewNote.js';
import TeamMembership from '../models/TeamMembership.js';
import TeamRole from '../models/TeamRole.js';
import Workspace from '../models/Workspace.js';
import { TEAM_PERMISSIONS } from '../constants/teamPermissions.js';
import { emitRealtimeEvent } from '../sockets/socket.js';
import { createWorkflowEvent } from './event.service.js';
import { hydrateMediaAssetPublicUrls } from './media.service.js';
import { createNotification } from './notification.service.js';
import { assertProjectAccess, scopeByVisibleProjects } from './projectAccess.service.js';

const createHttpError = (message, statusCode, code = '') => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
};

const idOf = value => String(value?._id || value || '');

const POPULATE = [
  { path: 'ownerId', select: 'name email profile.avatarUrl' },
  { path: 'projectId', select: 'name status leadId memberIds' },
  { path: 'taskId', select: 'title status' },
  { path: 'mediaAssetIds', select: '+objectKey' },
  { path: 'variantIds', select: 'platform caption hook cta hashtags status' }
];

const hydrate = async deliverables => {
  const list = Array.isArray(deliverables) ? deliverables : [deliverables];
  await Promise.all(list.map(item => hydrateMediaAssetPublicUrls(item?.mediaAssetIds)));
  return deliverables;
};

const loadDeliverable = async ({ user, team, deliverableId }) => {
  const deliverable = await Deliverable.findOne({ _id: deliverableId, workspaceId: user.workspaceId });
  if (!deliverable) throw createHttpError('Deliverable not found.', 404);
  /* Isolation reaches deliverables, not only the project listing. */
  await assertProjectAccess({ user, team, projectId: deliverable.projectId });
  return deliverable;
};

const canDecide = ({ team }) => !team || team.isOwner || team.can(TEAM_PERMISSIONS.APPROVAL_DECIDE);

/* ── Authoring ────────────────────────────────────────────────────────────── */

export const listDeliverables = async ({ user, team, query = {} }) => {
  const filter = await scopeByVisibleProjects({
    user,
    team,
    filter: { workspaceId: user.workspaceId },
    field: 'projectId'
  });

  if (query.projectId) {
    await assertProjectAccess({ user, team, projectId: query.projectId });
    filter.projectId = query.projectId;
  }
  if (query.status) filter.status = query.status;
  if (query.mine === 'true') filter.ownerId = user._id;

  const deliverables = await Deliverable.find(filter).sort({ updatedAt: -1 }).populate(POPULATE);
  return hydrate(deliverables);
};

export const createDeliverable = async ({ user, team, input }) => {
  const project = await assertProjectAccess({ user, team, projectId: input.projectId });

  const title = String(input.title || '').trim();
  if (!title) throw createHttpError('Give the deliverable a title so reviewers know what it is.', 400);

  /* Only assets and variants from this workspace can be bundled in. */
  const [mediaAssets, variants, task] = await Promise.all([
    MediaAsset.find({ _id: { $in: input.mediaAssetIds || [] }, workspaceId: user.workspaceId }).select('_id'),
    PlatformVariant.find({ _id: { $in: input.variantIds || [] }, workspaceId: user.workspaceId }).select('_id'),
    input.taskId
      ? ContentItem.findOne({ _id: input.taskId, workspaceId: user.workspaceId, campaignId: project._id }).select('_id')
      : null
  ]);

  const deliverable = await Deliverable.create({
    workspaceId: user.workspaceId,
    projectId: project._id,
    taskId: task?._id || null,
    ownerId: user._id,
    kind: input.kind || 'other',
    title,
    notes: String(input.notes || '').trim(),
    mediaAssetIds: mediaAssets.map(asset => asset._id),
    variantIds: variants.map(variant => variant._id),
    status: 'draft'
  });

  await createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType: 'deliverable.created',
    message: `Deliverable "${deliverable.title}" created.`,
    entityType: 'Deliverable',
    entityId: deliverable._id,
    metadata: { projectId: project._id, kind: deliverable.kind }
  });

  return hydrate(await Deliverable.findById(deliverable._id).populate(POPULATE));
};

export const updateDeliverable = async ({ user, team, deliverableId, input }) => {
  const deliverable = await loadDeliverable({ user, team, deliverableId });

  /*
   * Once submitted the bundle is frozen. A reviewer looking at four images must
   * be deciding on the four images that were submitted, not on whatever the
   * owner swapped in while the review was open.
   */
  if (!['draft', 'changes_requested'].includes(deliverable.status)) {
    throw createHttpError(
      'This deliverable is in review. Wait for a decision, or ask the reviewer to request changes.',
      409,
      'DELIVERABLE_LOCKED'
    );
  }
  if (idOf(deliverable.ownerId) !== idOf(user._id) && !canDecide({ team })) {
    throw createHttpError('Only the owner of this deliverable can edit it.', 403);
  }

  if (input.title !== undefined) {
    const title = String(input.title).trim();
    if (!title) throw createHttpError('Title cannot be empty.', 400);
    deliverable.title = title;
  }
  if (input.notes !== undefined) deliverable.notes = String(input.notes).trim();
  if (input.kind !== undefined) deliverable.kind = input.kind;
  if (input.mediaAssetIds !== undefined) {
    const assets = await MediaAsset.find({
      _id: { $in: input.mediaAssetIds },
      workspaceId: user.workspaceId
    }).select('_id');
    deliverable.mediaAssetIds = assets.map(asset => asset._id);
  }
  if (input.variantIds !== undefined) {
    const variants = await PlatformVariant.find({
      _id: { $in: input.variantIds },
      workspaceId: user.workspaceId
    }).select('_id');
    deliverable.variantIds = variants.map(variant => variant._id);
  }

  await deliverable.save();
  return hydrate(await Deliverable.findById(deliverable._id).populate(POPULATE));
};

/* ── Submit for review ────────────────────────────────────────────────────── */

export const submitDeliverable = async ({ user, team, deliverableId, comment = '' }) => {
  const deliverable = await loadDeliverable({ user, team, deliverableId });

  if (idOf(deliverable.ownerId) !== idOf(user._id)) {
    throw createHttpError('Only the owner of this deliverable can submit it.', 403);
  }
  if (!['draft', 'changes_requested'].includes(deliverable.status)) {
    throw createHttpError('This deliverable has already been submitted.', 409);
  }
  if (deliverable.mediaAssetIds.length === 0 && deliverable.variantIds.length === 0 && !deliverable.notes) {
    throw createHttpError('Attach media, a caption or notes before submitting — there is nothing to review.', 400);
  }

  const approval = await ApprovalRequest.create({
    workspaceId: user.workspaceId,
    subjectType: 'Deliverable',
    subjectId: deliverable._id,
    kind: 'work_review',
    projectId: deliverable.projectId,
    requestedBy: user._id,
    status: 'pending',
    revision: deliverable.revision,
    comment
  });

  deliverable.status = 'in_review';
  deliverable.currentApprovalId = approval._id;
  deliverable.submittedAt = new Date();
  await deliverable.save();

  await notifyReviewers({
    user,
    workspaceId: user.workspaceId,
    title: 'Work is waiting on your review',
    message: `${user.name} submitted "${deliverable.title}" for approval.`,
    entityType: 'Deliverable',
    entityId: deliverable._id
  });

  await createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType: 'deliverable.submitted',
    message: `"${deliverable.title}" submitted for approval.`,
    entityType: 'Deliverable',
    entityId: deliverable._id,
    metadata: { approvalId: approval._id, projectId: deliverable.projectId, revision: deliverable.revision }
  });

  emitRealtimeEvent('approval:requested', { workspaceId: user.workspaceId, deliverableId: deliverable._id });
  return hydrate(await Deliverable.findById(deliverable._id).populate(POPULATE));
};

/**
 * Everyone who may decide. Falls back to the team owner so a submission is never
 * silently unreviewable because no position happens to carry approval.decide.
 */
const notifyReviewers = async ({ user, workspaceId, title, message, entityType, entityId }) => {
  const roles = await TeamRole.find({ workspaceId }).select('_id permissions isOwner');
  const decidingRoleIds = roles
    .filter(role => role.isOwner || role.permissions.includes(TEAM_PERMISSIONS.APPROVAL_DECIDE))
    .map(role => role._id);

  const memberships = await TeamMembership.find({
    workspaceId,
    status: 'active',
    teamRoleId: { $in: decidingRoleIds }
  }).select('userId');

  const workspace = await Workspace.findById(workspaceId).select('ownerId');
  const recipientIds = new Set(memberships.map(membership => idOf(membership.userId)));
  recipientIds.add(idOf(workspace.ownerId));
  recipientIds.delete(idOf(user._id));

  await Promise.all(
    [...recipientIds].map(userId =>
      createNotification({
        workspaceId,
        userId,
        type: 'approval_requested',
        title,
        message,
        entityType,
        entityId
      }).catch(() => {})
    )
  );
};

/* ── Decisions ────────────────────────────────────────────────────────────── */

const DECISIONS = {
  approved: { deliverable: 'approved', event: 'deliverable.approved', label: 'approved' },
  changes_requested: { deliverable: 'changes_requested', event: 'deliverable.changes_requested', label: 'sent back for changes' },
  rejected: { deliverable: 'rejected', event: 'deliverable.rejected', label: 'rejected' }
};

export const decideDeliverable = async ({ user, team, deliverableId, decision, comment = '', notes = [] }) => {
  if (!DECISIONS[decision]) throw createHttpError('Unknown review decision.', 400);
  if (!canDecide({ team })) {
    throw createHttpError('Your position in this team does not allow approving work.', 403, 'TEAM_PERMISSION_DENIED');
  }

  const deliverable = await loadDeliverable({ user, team, deliverableId });
  if (deliverable.status !== 'in_review') {
    throw createHttpError('Only submitted work can receive a decision.', 409);
  }

  const approval = deliverable.currentApprovalId
    ? await ApprovalRequest.findById(deliverable.currentApprovalId)
    : null;

  if (approval) {
    approval.status = decision;
    approval.reviewedBy = user._id;
    approval.comment = comment;
    approval.decidedAt = new Date();
    await approval.save();
  }

  deliverable.status = DECISIONS[decision].deliverable;
  deliverable.decidedAt = new Date();
  /* A rejected-for-changes bundle comes back as the next revision, editable again. */
  if (decision === 'changes_requested') {
    deliverable.revision += 1;
    deliverable.currentApprovalId = null;
  }
  await deliverable.save();

  /* Pinned notes: "change this caption", "swap this image". */
  const createdNotes = await Promise.all(
    (Array.isArray(notes) ? notes : [])
      .filter(note => String(note?.body || '').trim())
      .map(note =>
        ReviewNote.create({
          workspaceId: user.workspaceId,
          approvalId: approval?._id || null,
          deliverableId: deliverable._id,
          authorId: user._id,
          body: String(note.body).trim(),
          targetField: String(note.targetField || '')
        })
      )
  );

  await createNotification({
    workspaceId: user.workspaceId,
    userId: deliverable.ownerId,
    type: 'approval_decided',
    title: `Your work was ${DECISIONS[decision].label}`,
    message: `${user.name} ${DECISIONS[decision].label} "${deliverable.title}".${comment ? ` — ${comment}` : ''}`,
    entityType: 'Deliverable',
    entityId: deliverable._id
  }).catch(() => {});

  /* Approval is a gate: this is where downstream work becomes startable. */
  const unblocked = decision === 'approved' ? await notifyUnblockedTasks({ user, deliverable }) : [];

  await createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType: DECISIONS[decision].event,
    message: `"${deliverable.title}" ${DECISIONS[decision].label}.`,
    entityType: 'Deliverable',
    entityId: deliverable._id,
    metadata: {
      decision,
      comment,
      projectId: deliverable.projectId,
      unblockedTaskIds: unblocked.map(task => task._id),
      noteCount: createdNotes.length
    }
  });

  emitRealtimeEvent('approval:decided', {
    workspaceId: user.workspaceId,
    deliverableId: deliverable._id,
    decision
  });

  return {
    deliverable: await hydrate(await Deliverable.findById(deliverable._id).populate(POPULATE)),
    unblockedTasks: unblocked,
    notes: createdNotes
  };
};

/**
 * Tasks that were waiting only on this deliverable. Their assignees are told the
 * moment the work they depend on clears review, which is the whole point of the
 * gate — nobody has to poll the head to find out they can start.
 */
const notifyUnblockedTasks = async ({ user, deliverable }) => {
  const waiting = await ContentItem.find({
    workspaceId: deliverable.workspaceId,
    blockedByDeliverableIds: deliverable._id
  }).populate('blockedByDeliverableIds', 'status');

  const nowFree = waiting.filter(task =>
    (task.blockedByDeliverableIds || []).every(blocker => blocker.status === 'approved')
  );

  await Promise.all(
    nowFree.flatMap(task => {
      const assignees = new Set([
        ...(task.assignedToIds || []).map(idOf),
        ...(task.assignedTo ? [idOf(task.assignedTo)] : [])
      ]);
      assignees.delete(idOf(user._id));
      return [...assignees].map(userId =>
        createNotification({
          workspaceId: deliverable.workspaceId,
          userId,
          type: 'task_assigned',
          title: 'A task you are on just unlocked',
          message: `"${deliverable.title}" was approved, so "${task.title}" is ready to start.`,
          entityType: 'ContentItem',
          entityId: task._id
        }).catch(() => {})
      );
    })
  );

  return nowFree.map(task => ({ _id: task._id, title: task.title }));
};

/* ── Review notes ─────────────────────────────────────────────────────────── */

export const listReviewNotes = async ({ user, team, deliverableId }) => {
  await loadDeliverable({ user, team, deliverableId });
  return ReviewNote.find({ workspaceId: user.workspaceId, deliverableId })
    .sort({ createdAt: 1 })
    .populate('authorId', 'name email profile.avatarUrl');
};

export const addReviewNote = async ({ user, team, deliverableId, input }) => {
  await loadDeliverable({ user, team, deliverableId });
  const body = String(input?.body || '').trim();
  if (!body) throw createHttpError('A note cannot be empty.', 400);

  const note = await ReviewNote.create({
    workspaceId: user.workspaceId,
    deliverableId,
    authorId: user._id,
    body,
    targetField: String(input?.targetField || '')
  });

  return ReviewNote.findById(note._id).populate('authorId', 'name email profile.avatarUrl');
};

export const resolveReviewNote = async ({ user, team, deliverableId, noteId }) => {
  await loadDeliverable({ user, team, deliverableId });
  const note = await ReviewNote.findOne({ _id: noteId, workspaceId: user.workspaceId, deliverableId });
  if (!note) throw createHttpError('Review note not found.', 404);

  note.resolvedAt = new Date();
  note.resolvedBy = user._id;
  await note.save();
  return note;
};

export { loadDeliverable, canDecide, notifyReviewers };
