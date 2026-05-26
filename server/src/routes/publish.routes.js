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
import { BRAND_REP_ROLE, CONTENT_CREATOR_ROLE } from '../constants/roles.js';

const router = express.Router();
const publishRoles = [CONTENT_CREATOR_ROLE, BRAND_REP_ROLE];

router.use(authenticate);

router.post('/validate', requireRole(publishRoles), validatePublish);
router.post('/now', requireRole(publishRoles), publishNow);
router.post('/schedule', requireRole(publishRoles), schedulePublish);
router.get('/jobs', getJobs);
router.get('/jobs/:id', getJob);
router.post('/jobs/:id/cancel', requireRole(publishRoles), cancelJob);
router.post('/jobs/:id/retry', requireRole(publishRoles), retryJob);

export default router;
