import { Router } from 'express';

import {
  createPlatformAccountHandler,
  deletePlatformAccountHandler,
  getPlatformAccountHandler,
  listPlatformAccountsHandler,
  updatePlatformAccountHandler
} from '../controllers/platformAccount.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

router.use(authenticate);

router.post('/', requireRole(['creator_admin']), createPlatformAccountHandler);
router.get('/', listPlatformAccountsHandler);
router.get('/:id', getPlatformAccountHandler);
router.patch('/:id', requireRole(['creator_admin']), updatePlatformAccountHandler);
router.delete('/:id', requireRole(['creator_admin']), deletePlatformAccountHandler);

export default router;
