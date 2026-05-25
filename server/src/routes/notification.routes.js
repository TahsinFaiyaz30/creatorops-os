import express from 'express';

import { getNotifications, readNotification } from '../controllers/notification.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticate);
router.get('/', getNotifications);
router.post('/:id/read', readNotification);

export default router;
