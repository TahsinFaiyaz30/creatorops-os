import express from 'express';

import { calendarFeed } from '../controllers/calendar.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticate);
router.get('/feed', calendarFeed);

export default router;
