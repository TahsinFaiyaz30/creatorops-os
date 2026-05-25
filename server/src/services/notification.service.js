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

export const listNotifications = async ({ user }) =>
  CreatorNotification.find({ workspaceId: user.workspaceId, userId: user._id })
    .sort({ createdAt: -1 })
    .limit(100);

export const markNotificationRead = async ({ user, notificationId }) => {
  const notification = await CreatorNotification.findOne({
    _id: notificationId,
    workspaceId: user.workspaceId,
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
