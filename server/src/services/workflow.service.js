import { CONTENT_STATUSES } from '../models/ContentItem.js';

const editorTransitions = new Set(['idea->draft', 'draft->in_review', 'changes_requested->draft']);

const creatorAdminTransitions = new Set([
  'in_review->approved',
  'in_review->rejected',
  'in_review->changes_requested',
  'approved->scheduled',
  'scheduled->published'
]);

const adminOnlyTargets = new Set(['approved', 'rejected', 'changes_requested', 'scheduled', 'published']);

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const validateStatusTransition = ({ role, fromStatus, toStatus }) => {
  if (!CONTENT_STATUSES.includes(toStatus)) {
    throw createHttpError('Invalid content status.', 400);
  }

  if (fromStatus === toStatus) {
    throw createHttpError('Content is already in this status.', 400);
  }

  const transition = `${fromStatus}->${toStatus}`;

  if (role === 'editor') {
    if (adminOnlyTargets.has(toStatus)) {
      throw createHttpError('Forbidden: editor cannot perform this status transition.', 403);
    }

    if (editorTransitions.has(transition)) {
      return true;
    }

    throw createHttpError('Invalid editor status transition.', 400);
  }

  if (role === 'creator_admin') {
    if (creatorAdminTransitions.has(transition)) {
      return true;
    }

    if (editorTransitions.has(transition)) {
      throw createHttpError('Forbidden: this transition is reserved for editors.', 403);
    }

    throw createHttpError('Invalid creator_admin status transition.', 400);
  }

  throw createHttpError('Forbidden: unsupported role for workflow transition.', 403);
};
