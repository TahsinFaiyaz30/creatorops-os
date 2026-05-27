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

const router = express.Router();

router.use(authenticate);

router.get('/', listConnections);
router.get('/status', getStatus);
router.get('/capabilities', getCapabilities);
router.get('/:id', getConnection);
router.post('/:id/disconnect', disconnect);
router.post('/:id/refresh', refresh);
router.post('/:id/health-check', healthCheck);
router.delete('/:id', remove);

export default router;
