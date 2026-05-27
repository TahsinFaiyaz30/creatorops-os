import { Router } from 'express';

import {
  createScheduleJobHandler,
  getScheduleJobsHandler,
  runScheduleJobNowHandler
} from '../controllers/schedule.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { BRAND_REP_ROLE, CONTENT_CREATOR_ROLE } from '../constants/roles.js';

const router = Router();
const scheduleRoles = [CONTENT_CREATOR_ROLE, BRAND_REP_ROLE];

router.use(authenticate);

router.post('/', requireRole(scheduleRoles), createScheduleJobHandler);
router.get('/', getScheduleJobsHandler);
router.post('/:id/run-now', requireRole(scheduleRoles), runScheduleJobNowHandler);

export default router;
