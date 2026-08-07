import Campaign from '../models/Campaign.js';
import ContentItem from '../models/ContentItem.js';
import Deliverable from '../models/Deliverable.js';
import PlatformVariant from '../models/PlatformVariant.js';
import TeamMembership from '../models/TeamMembership.js';
import { createWorkflowEvent } from './event.service.js';
import { createNotification } from './notification.service.js';
import { assertProjectAccess } from './projectAccess.service.js';
import { createContentVersion, listContentVersions } from './versioning.service.js';
import { validateStatusTransition } from './workflow.service.js';

const createHttpError = (message, statusCode, code = '') => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
};

const idOf = value => String(value?._id || value || '');

const editableFields = ['title', 'rawIdea', 'assignedTo', 'dueAt', 'order'];

const pickContentFields = input =>
  editableFields.reduce((picked, field) => {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      picked[field] = input[field];
    }
    return picked;
  }, {});

const resolveTeamMemberIds = async ({ workspaceId, userIds }) => {
  /* String(undefined) is "undefined" — truthy, and a malformed ObjectId. */
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

/**
 * A task is locked until every deliverable it waits on has been approved. This
 * is the gate behind "once the head approves, the next member can start" — and
 * it is enforced on writes, not merely rendered as a greyed-out card, because a
 * lock that only exists in the UI is not a lock.
 */
export const getTaskBlockers = async contentItem => {
  const blockerIds = contentItem.blockedByDeliverableIds || [];
  if (blockerIds.length === 0) return [];

  const blockers = await Deliverable.find({ _id: { $in: blockerIds } })
    .select('title status ownerId')
    .populate('ownerId', 'name');

  return blockers.filter(blocker => blocker.status !== 'approved');
};

const assertTaskUnblocked = async contentItem => {
  const open = await getTaskBlockers(contentItem);
  if (open.length === 0) return;

  const names = open.map(blocker => `"${blocker.title}"`).join(', ');
  throw createHttpError(
    `This task is waiting on approval of ${names}. It unlocks once that work is approved.`,
    409,
    'TASK_BLOCKED'
  );
};

const findScopedContentItem = async (user, contentItemId, team = null) => {
  const contentItem = await ContentItem.findOne({
    _id: contentItemId,
    workspaceId: user.workspaceId
  });

  if (!contentItem) {
    throw createHttpError('Content item not found.', 404);
  }

  /* Project isolation reaches the task, not just the project listing. */
  await assertProjectAccess({ user, team, projectId: contentItem.campaignId });

  return contentItem;
};

const ensureScopedCampaign = async (user, campaignId, team = null) =>
  assertProjectAccess({ user, team, projectId: campaignId });

const notifyAssignees = async ({ user, contentItem, userIds, project }) => {
  const recipients = (userIds || []).filter(userId => idOf(userId) !== idOf(user._id));
  await Promise.all(
    recipients.map(userId =>
      createNotification({
        workspaceId: contentItem.workspaceId,
        userId,
        type: 'task_assigned',
        title: 'You were assigned a task',
        message: `${user.name} assigned you "${contentItem.title}"${project ? ` on ${project.name}` : ''}.`,
        entityType: 'ContentItem',
        entityId: contentItem._id
      }).catch(() => {})
    )
  );
};

export const createContentItem = async (user, input, team = null) => {
  const project = await ensureScopedCampaign(user, input.campaignId, team);

  const title = String(input.title || '').trim();
  const rawIdea = String(input.rawIdea || '').trim();

  if (!title || !rawIdea) {
    throw createHttpError('title and rawIdea are required.', 400);
  }

  const assignedToIds = await resolveTeamMemberIds({
    workspaceId: user.workspaceId,
    userIds: input.assignedToIds || (input.assignedTo ? [input.assignedTo] : [])
  });

  /* Only deliverables inside this same project can gate this task. */
  const blockers = Array.isArray(input.blockedByDeliverableIds)
    ? await Deliverable.find({
        _id: { $in: input.blockedByDeliverableIds },
        workspaceId: user.workspaceId,
        projectId: project._id
      }).select('_id')
    : [];

  const contentItem = await ContentItem.create({
    workspaceId: user.workspaceId,
    campaignId: input.campaignId,
    title,
    rawIdea,
    status: 'idea',
    createdBy: user._id,
    assignedTo: assignedToIds[0] || input.assignedTo || null,
    assignedToIds,
    blockedByDeliverableIds: blockers.map(blocker => blocker._id),
    dueAt: input.dueAt ? new Date(input.dueAt) : null,
    order: Number.isFinite(Number(input.order)) ? Number(input.order) : 0,
    currentVersion: 1
  });

  await notifyAssignees({ user, contentItem, userIds: assignedToIds, project });

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

export const listContentByCampaign = async (user, campaignId, team = null) => {
  await ensureScopedCampaign(user, campaignId, team);

  const items = await ContentItem.find({
    workspaceId: user.workspaceId,
    campaignId
  })
    .sort({ order: 1, createdAt: -1 })
    .populate('createdBy', 'name email role profile.avatarUrl')
    .populate('assignedTo', 'name email role profile.avatarUrl')
    .populate('assignedToIds', 'name email profile.avatarUrl')
    .populate('blockedByDeliverableIds', 'title status');

  /* The board needs to know what is locked, and by what, to say so. */
  return items.map(item => {
    const openBlockers = (item.blockedByDeliverableIds || []).filter(blocker => blocker.status !== 'approved');
    return {
      ...item.toObject(),
      isBlocked: openBlockers.length > 0,
      openBlockers
    };
  });
};

/** Everything assigned to this member across every project they can see. */
export const listMyTasks = async (user, team = null) => {
  const items = await ContentItem.find({
    workspaceId: user.workspaceId,
    $or: [{ assignedToIds: user._id }, { assignedTo: user._id }]
  })
    .sort({ dueAt: 1, createdAt: -1 })
    .populate('campaignId', 'name status deadline priority')
    .populate('assignedToIds', 'name email profile.avatarUrl')
    .populate('blockedByDeliverableIds', 'title status');

  /* A task on a project the member was removed from must stop appearing. */
  const visible = [];
  for (const item of items) {
    try {
      await assertProjectAccess({ user, team, projectId: item.campaignId?._id || item.campaignId });
    } catch (_error) {
      continue;
    }
    const openBlockers = (item.blockedByDeliverableIds || []).filter(blocker => blocker.status !== 'approved');
    visible.push({ ...item.toObject(), isBlocked: openBlockers.length > 0, openBlockers });
  }
  return visible;
};

export const updateContentItem = async (user, contentItemId, input, team = null) => {
  const contentItem = await findScopedContentItem(user, contentItemId, team);
  /* Editing locked work is exactly what the gate is meant to prevent. */
  await assertTaskUnblocked(contentItem);

  const updates = pickContentFields(input);

  if (input.assignedToIds !== undefined) {
    const assignedToIds = await resolveTeamMemberIds({ workspaceId: user.workspaceId, userIds: input.assignedToIds });
    const before = new Set((contentItem.assignedToIds || []).map(idOf));
    contentItem.assignedToIds = assignedToIds;
    if (!updates.assignedTo) updates.assignedTo = assignedToIds[0] || null;
    const added = assignedToIds.filter(userId => !before.has(idOf(userId)));
    if (added.length) await notifyAssignees({ user, contentItem, userIds: added });
  }

  if (input.blockedByDeliverableIds !== undefined) {
    const blockers = await Deliverable.find({
      _id: { $in: input.blockedByDeliverableIds },
      workspaceId: user.workspaceId,
      projectId: contentItem.campaignId
    }).select('_id');
    contentItem.blockedByDeliverableIds = blockers.map(blocker => blocker._id);
  }

  const textChanged =
    Object.prototype.hasOwnProperty.call(updates, 'title') && updates.title !== contentItem.title;
  const ideaChanged =
    Object.prototype.hasOwnProperty.call(updates, 'rawIdea') && updates.rawIdea !== contentItem.rawIdea;

  const changedFields = Object.entries(updates).filter(([field, value]) => {
    const currentValue = contentItem[field];
    return String(currentValue ?? '') !== String(value ?? '');
  });

  /*
   * assignedToIds and blockedByDeliverableIds are set directly on the document
   * above rather than through `updates`, so the early return has to account for
   * them — otherwise reassigning a task with no other edit would be dropped.
   */
  const relationsChanged = contentItem.isModified('assignedToIds') || contentItem.isModified('blockedByDeliverableIds');

  if (changedFields.length === 0 && !relationsChanged) {
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

export const updateContentStatus = async (user, contentItemId, input, team = null) => {
  const contentItem = await findScopedContentItem(user, contentItemId, team);
  const nextStatus = input.status;
  const previousStatus = contentItem.status;

  await assertTaskUnblocked(contentItem);

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

export const getContentVersions = async (user, contentItemId, team = null) => {
  await findScopedContentItem(user, contentItemId, team);
  return listContentVersions(user, contentItemId);
};

export const listContentVariants = async (user, contentItemId, team = null) => {
  await findScopedContentItem(user, contentItemId, team);

  return PlatformVariant.find({
    workspaceId: user.workspaceId,
    contentItemId
  }).sort({ platform: 1, createdAt: 1 });
};

export { findScopedContentItem, assertTaskUnblocked };
