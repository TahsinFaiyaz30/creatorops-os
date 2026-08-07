import CreatorNotification from '../models/CreatorNotification.js';
import { emitRealtimeEvent } from '../sockets/socket.js';

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const createNotification = async ({ workspaceId, userId, type, title, message, entityType = '', entityId = null }) => {
  const notification = await CreatorNotification.create({
    workspaceId,
    userId,
    type,
    title,
    message,
    entityType,
    entityId
  });

  emitRealtimeEvent('notification:created', notification);
  emitRealtimeEvent('calendar:updated', { workspaceId, source: 'notification', entityId });

  return notification;
};

/*
 * Scoped by user, not by workspace. A notification is already addressed to one
 * person, and a creator who works for three teams must see "you were assigned a
 * task" without first guessing which team to switch into. The originating
 * workspace rides along so the bell can label and deep-link it.
 */
export const listNotifications = async ({ user }) =>
  CreatorNotification.find({ userId: user._id })
    .populate('workspaceId', 'name type avatarUrl')
    .sort({ createdAt: -1 })
    .limit(100);

export const markNotificationRead = async ({ user, notificationId }) => {
  const notification = await CreatorNotification.findOne({
    _id: notificationId,
    userId: user._id
  });

  if (!notification) {
    throw createHttpError('Notification not found.', 404);
  }

  notification.readAt = notification.readAt || new Date();
  await notification.save();
  emitRealtimeEvent('notification:read', notification);
  return notification;
};
