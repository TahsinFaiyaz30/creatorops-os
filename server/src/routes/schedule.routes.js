import { Router } from 'express';

import {
  createScheduleJobHandler,
  getScheduleJobsHandler,
  runScheduleJobNowHandler
} from '../controllers/schedule.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

router.use(authenticate);

router.post('/', requireRole(['creator_admin']), createScheduleJobHandler);
router.get('/', getScheduleJobsHandler);
router.post('/:id/run-now', requireRole(['creator_admin']), runScheduleJobNowHandler);

export default router;
