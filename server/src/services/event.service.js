import WorkflowEvent from '../models/WorkflowEvent.js';

export const createWorkflowEvent = async ({
  workspaceId,
  actorId,
  eventType,
  message,
  entityType = '',
  entityId = null,
  metadata = {}
}) =>
  WorkflowEvent.create({
    workspaceId,
    actorId,
    eventType,
    message,
    entityType,
    entityId,
    metadata
  });

export const listWorkflowEvents = async (user, query = {}) => {
  const filter = { workspaceId: user.workspaceId };

  if (query.eventType) {
    filter.eventType = query.eventType;
  }

  const limit = Math.min(Number(query.limit) || 50, 100);

  return WorkflowEvent.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('actorId', 'name email role');
};
