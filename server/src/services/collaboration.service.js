import Deliverable from '../models/Deliverable.js';
import Handoff from '../models/Handoff.js';
import MediaAsset from '../models/MediaAsset.js';
import ProjectMessage from '../models/ProjectMessage.js';
import TeamMembership from '../models/TeamMembership.js';
import Workspace from '../models/Workspace.js';
import { emitProjectEvent } from '../sockets/socket.js';
import { createWorkflowEvent } from './event.service.js';
import { hydrateMediaAssetPublicUrls } from './media.service.js';
import { createNotification } from './notification.service.js';
import { assertProjectAccess, isProjectMember } from './projectAccess.service.js';

const createHttpError = (message, statusCode, code = '') => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
};

const idOf = value => String(value?._id || value || '');

/* ── Handoffs ─────────────────────────────────────────────────────────────── */

const HANDOFF_POPULATE = [
  { path: 'fromUserId', select: 'name email profile.avatarUrl' },
  { path: 'toUserIds', select: 'name email profile.avatarUrl' },
  { path: 'projectId', select: 'name status' },
  {
    path: 'deliverableId',
    populate: [
      { path: 'mediaAssetIds', select: '+objectKey' },
      { path: 'variantIds', select: 'platform caption status' }
    ]
  }
];

const hydrateHandoffs = async handoffs => {
  const list = Array.isArray(handoffs) ? handoffs : [handoffs];
  await Promise.all(list.map(handoff => hydrateMediaAssetPublicUrls(handoff?.deliverableId?.mediaAssetIds)));
  return handoffs;
};

export const createHandoff = async ({ user, team, input }) => {
  const deliverable = await Deliverable.findOne({
    _id: input?.deliverableId,
    workspaceId: user.workspaceId
  });
  if (!deliverable) throw createHttpError('Deliverable not found.', 404);

  const project = await assertProjectAccess({ user, team, projectId: deliverable.projectId });

  const workspace = await Workspace.findById(user.workspaceId).select('settings');
  if (workspace?.settings?.requireApprovalToHandoff && deliverable.status !== 'approved') {
    throw createHttpError(
      'This team requires work to be approved before it can be handed on.',
      409,
      'HANDOFF_NEEDS_APPROVAL'
    );
  }

  /*
   * Recipients must be active members of the team AND on this project — handing
   * work to someone who cannot open the project would deliver a dead link and
   * quietly widen the isolation boundary.
   */
  const requested = [...new Set((input?.toUserIds || []).map(String).filter(Boolean))];
  if (requested.length === 0) throw createHttpError('Choose at least one teammate to hand this to.', 400);

  const memberships = await TeamMembership.find({
    workspaceId: user.workspaceId,
    userId: { $in: requested },
    status: 'active'
  }).select('userId');

  const recipients = memberships
    .map(membership => membership.userId)
    .filter(userId => isProjectMember({ project, user: { _id: userId } }) || project.visibility === 'team');

  if (recipients.length === 0) {
    throw createHttpError(
      'None of those teammates are on this project. Add them to the project first.',
      400,
      'RECIPIENT_NOT_ON_PROJECT'
    );
  }

  const handoff = await Handoff.create({
    workspaceId: user.workspaceId,
    projectId: project._id,
    deliverableId: deliverable._id,
    fromUserId: user._id,
    toUserIds: recipients,
    note: String(input?.note || '').trim(),
    dueAt: input?.dueAt ? new Date(input.dueAt) : null,
    status: 'sent'
  });

  await Promise.all(
    recipients.map(userId =>
      createNotification({
        workspaceId: user.workspaceId,
        userId,
        type: 'handoff_received',
        title: 'Work was handed to you',
        message: `${user.name} handed you "${deliverable.title}" on ${project.name}.`,
        entityType: 'Handoff',
        entityId: handoff._id
      }).catch(() => {})
    )
  );

  await createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType: 'handoff.sent',
    message: `"${deliverable.title}" handed to ${recipients.length} teammate${recipients.length === 1 ? '' : 's'}.`,
    entityType: 'Handoff',
    entityId: handoff._id,
    metadata: { projectId: project._id, deliverableId: deliverable._id, recipientCount: recipients.length }
  });

  emitProjectEvent(project._id, 'handoff:created', { handoffId: handoff._id, projectId: project._id });
  return hydrateHandoffs(await Handoff.findById(handoff._id).populate(HANDOFF_POPULATE));
};

export const listHandoffs = async ({ user, team, query = {} }) => {
  const filter = { workspaceId: user.workspaceId };

  if (query.projectId) {
    await assertProjectAccess({ user, team, projectId: query.projectId });
    filter.projectId = query.projectId;
  } else {
    /* Default view is personal: what was handed to me, and what I handed on. */
    filter.$or = [{ toUserIds: user._id }, { fromUserId: user._id }];
  }
  if (query.status) filter.status = query.status;

  const handoffs = await Handoff.find(filter).sort({ createdAt: -1 }).populate(HANDOFF_POPULATE);
  return hydrateHandoffs(handoffs);
};

export const respondToHandoff = async ({ user, team, handoffId, status }) => {
  if (!['acknowledged', 'accepted', 'returned'].includes(status)) {
    throw createHttpError('Unknown handoff response.', 400);
  }

  const handoff = await Handoff.findOne({ _id: handoffId, workspaceId: user.workspaceId });
  if (!handoff) throw createHttpError('Handoff not found.', 404);
  await assertProjectAccess({ user, team, projectId: handoff.projectId });

  const isRecipient = (handoff.toUserIds || []).some(userId => idOf(userId) === idOf(user._id));
  if (!isRecipient) throw createHttpError('Only a recipient can respond to this handoff.', 403);

  handoff.status = status;
  handoff.respondedAt = new Date();
  handoff.respondedBy = user._id;
  await handoff.save();

  await createNotification({
    workspaceId: user.workspaceId,
    userId: handoff.fromUserId,
    type: 'handoff_received',
    title: `Handoff ${status}`,
    message: `${user.name} ${status} the work you handed over.`,
    entityType: 'Handoff',
    entityId: handoff._id
  }).catch(() => {});

  emitProjectEvent(handoff.projectId, 'handoff:updated', { handoffId: handoff._id, status });
  return hydrateHandoffs(await Handoff.findById(handoff._id).populate(HANDOFF_POPULATE));
};

/* ── Project chat ─────────────────────────────────────────────────────────── */

const MESSAGE_POPULATE = [
  { path: 'authorId', select: 'name email profile.avatarUrl' },
  { path: 'attachmentIds', select: '+objectKey' }
];

export const listProjectMessages = async ({ user, team, projectId, query = {} }) => {
  await assertProjectAccess({ user, team, projectId });

  const filter = { workspaceId: user.workspaceId, projectId };
  if (query.before) filter.createdAt = { $lt: new Date(query.before) };

  const messages = await ProjectMessage.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(query.limit) || 100, 200))
    .populate(MESSAGE_POPULATE);

  await Promise.all(messages.map(message => hydrateMediaAssetPublicUrls(message.attachmentIds)));
  return messages.reverse();
};

export const postProjectMessage = async ({ user, team, projectId, input }) => {
  const project = await assertProjectAccess({ user, team, projectId });

  const body = String(input?.body || '').trim();
  if (!body) throw createHttpError('A message cannot be empty.', 400);

  const attachments = Array.isArray(input?.attachmentIds)
    ? await MediaAsset.find({ _id: { $in: input.attachmentIds }, workspaceId: user.workspaceId }).select('_id')
    : [];

  const message = await ProjectMessage.create({
    workspaceId: user.workspaceId,
    projectId: project._id,
    authorId: user._id,
    body,
    attachmentIds: attachments.map(asset => asset._id),
    parentId: input?.parentId || null
  });

  const populated = await ProjectMessage.findById(message._id).populate(MESSAGE_POPULATE);
  await hydrateMediaAssetPublicUrls(populated.attachmentIds);

  /* Broadcast to the project room only — a non-member never receives the frame. */
  emitProjectEvent(project._id, 'project:message', populated);

  /* Everyone on the project except the author. */
  const recipients = new Set(
    [...(project.memberIds || []), project.leadId, project.createdBy]
      .filter(Boolean)
      .map(idOf)
      .filter(userId => userId !== idOf(user._id))
  );

  await Promise.all(
    [...recipients].map(userId =>
      createNotification({
        workspaceId: user.workspaceId,
        userId,
        type: 'project_message',
        title: `New message on ${project.name}`,
        message: `${user.name}: ${body.slice(0, 120)}`,
        entityType: 'Campaign',
        entityId: project._id
      }).catch(() => {})
    )
  );

  return populated;
};
