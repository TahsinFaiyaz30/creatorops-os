import express from 'express';

import {
  cancelJob,
  getJob,
  getJobs,
  publishNow,
  retryJob,
  schedulePublish,
  validatePublish
} from '../controllers/publish.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = express.Router();

router.use(authenticate);

router.post('/validate', requireRole(['creator_admin']), validatePublish);
router.post('/now', requireRole(['creator_admin']), publishNow);
router.post('/schedule', requireRole(['creator_admin']), schedulePublish);
router.get('/jobs', getJobs);
router.get('/jobs/:id', getJob);
router.post('/jobs/:id/cancel', requireRole(['creator_admin']), cancelJob);
router.post('/jobs/:id/retry', requireRole(['creator_admin']), retryJob);

export default router;
