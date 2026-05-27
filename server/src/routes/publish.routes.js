import express from 'express';

import {
  cancelJob,
  deleteGroupDispatch,
  deleteJobDispatch,
  getJob,
  getJobs,
  getPublishSettings,
  mediaPlan,
  pauseJob,
  publishNow,
  resumeJob,
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

router.get('/settings', getPublishSettings);
router.post('/media-plan', requireRole(publishRoles), mediaPlan);
router.post('/validate', requireRole(publishRoles), validatePublish);
router.post('/now', requireRole(publishRoles), publishNow);
router.post('/schedule', requireRole(publishRoles), schedulePublish);
router.get('/jobs', getJobs);
router.get('/jobs/:id', getJob);
router.post('/groups/:id/delete', requireRole(publishRoles), deleteGroupDispatch);
router.post('/jobs/:id/pause', requireRole(publishRoles), pauseJob);
router.post('/jobs/:id/resume', requireRole(publishRoles), resumeJob);
router.post('/jobs/:id/cancel', requireRole(publishRoles), cancelJob);
router.post('/jobs/:id/retry', requireRole(publishRoles), retryJob);
router.post('/jobs/:id/delete', requireRole(publishRoles), deleteJobDispatch);

export default router;
