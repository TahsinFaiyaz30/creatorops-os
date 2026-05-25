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

const router = Router();

router.use(authenticate);

router.post('/request', requestApprovalHandler);
router.get('/pending', requireRole(['creator_admin']), getPendingApprovalsHandler);
router.post('/:id/approve', requireRole(['creator_admin']), approveApprovalHandler);
router.post('/:id/reject', requireRole(['creator_admin']), rejectApprovalHandler);
router.post('/:id/request-changes', requireRole(['creator_admin']), requestChangesHandler);

export default router;
