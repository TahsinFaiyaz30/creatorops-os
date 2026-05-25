import { listNotifications, markNotificationRead } from '../services/notification.service.js';

export const getNotifications = async (req, res, next) => {
  try {
    const notifications = await listNotifications({ user: req.user });
    res.json({ data: { notifications } });
  } catch (error) {
    next(error);
  }
};

export const readNotification = async (req, res, next) => {
  try {
    const notification = await markNotificationRead({ user: req.user, notificationId: req.params.id });
    res.json({ data: { notification } });
  } catch (error) {
    next(error);
  }
};
