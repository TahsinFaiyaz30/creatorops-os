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
const publishRoles = ['editor', 'creator_admin', 'brand_rep'];

router.use(authenticate);

router.post('/validate', requireRole(publishRoles), validatePublish);
router.post('/now', requireRole(publishRoles), publishNow);
router.post('/schedule', requireRole(publishRoles), schedulePublish);
router.get('/jobs', getJobs);
router.get('/jobs/:id', getJob);
router.post('/jobs/:id/cancel', requireRole(publishRoles), cancelJob);
router.post('/jobs/:id/retry', requireRole(publishRoles), retryJob);

export default router;
