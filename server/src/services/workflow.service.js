import { CONTENT_STATUSES } from '../models/ContentItem.js';
import { isContentCreatorRole } from '../constants/roles.js';

const draftTransitions = new Set(['idea->draft', 'draft->in_review', 'changes_requested->draft']);

const reviewAndPublishTransitions = new Set([
  'in_review->approved',
  'in_review->rejected',
  'in_review->changes_requested',
  'approved->scheduled',
  'scheduled->published'
]);

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const validateStatusTransition = ({ user, role, fromStatus, toStatus }) => {
  if (!CONTENT_STATUSES.includes(toStatus)) {
    throw createHttpError('Invalid content status.', 400);
  }

  if (fromStatus === toStatus) {
    throw createHttpError('Content is already in this status.', 400);
  }

  const transition = `${fromStatus}->${toStatus}`;

  if (isContentCreatorRole(user || role)) {
    if (draftTransitions.has(transition) || reviewAndPublishTransitions.has(transition)) {
      return true;
    }

    throw createHttpError('Invalid Content Creator status transition.', 400);
  }

  throw createHttpError('Forbidden: unsupported role for workflow transition.', 403);
};
