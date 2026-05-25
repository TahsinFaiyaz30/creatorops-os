import express from 'express';

import {
  disconnect,
  getCapabilities,
  getConnection,
  getStatus,
  healthCheck,
  listConnections,
  refresh,
  remove
} from '../controllers/platformConnection.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = express.Router();

router.use(authenticate);

router.get('/', listConnections);
router.get('/status', getStatus);
router.get('/capabilities', getCapabilities);
router.get('/:id', getConnection);
router.post('/:id/disconnect', requireRole(['creator_admin']), disconnect);
router.post('/:id/refresh', requireRole(['creator_admin']), refresh);
router.post('/:id/health-check', requireRole(['creator_admin']), healthCheck);
router.delete('/:id', requireRole(['creator_admin']), remove);

export default router;
