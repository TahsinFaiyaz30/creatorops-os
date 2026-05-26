import { Router } from 'express';

import {
  createScheduleJobHandler,
  getScheduleJobsHandler,
  runScheduleJobNowHandler
} from '../controllers/schedule.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { CONTENT_CREATOR_ROLE } from '../constants/roles.js';

const router = Router();

router.use(authenticate);

router.post('/', requireRole([CONTENT_CREATOR_ROLE]), createScheduleJobHandler);
router.get('/', getScheduleJobsHandler);
router.post('/:id/run-now', requireRole([CONTENT_CREATOR_ROLE]), runScheduleJobNowHandler);

export default router;
