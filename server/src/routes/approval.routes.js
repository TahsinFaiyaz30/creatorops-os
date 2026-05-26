import { Router } from 'express';

import {
  approveApprovalHandler,
  getPendingApprovalsHandler,
  rejectApprovalHandler,
  requestApprovalHandler,
  requestChangesHandler
} from '../controllers/approval.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { CONTENT_CREATOR_ROLE } from '../constants/roles.js';

const router = Router();

router.use(authenticate);

router.post('/request', requestApprovalHandler);
router.get('/pending', requireRole([CONTENT_CREATOR_ROLE]), getPendingApprovalsHandler);
router.post('/:id/approve', requireRole([CONTENT_CREATOR_ROLE]), approveApprovalHandler);
router.post('/:id/reject', requireRole([CONTENT_CREATOR_ROLE]), rejectApprovalHandler);
router.post('/:id/request-changes', requireRole([CONTENT_CREATOR_ROLE]), requestChangesHandler);

export default router;
