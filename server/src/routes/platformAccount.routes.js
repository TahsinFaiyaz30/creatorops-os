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
import { CONTENT_CREATOR_ROLE } from '../constants/roles.js';

const router = Router();

router.use(authenticate);

router.post('/', requireRole([CONTENT_CREATOR_ROLE]), createPlatformAccountHandler);
router.get('/', listPlatformAccountsHandler);
router.get('/:id', getPlatformAccountHandler);
router.patch('/:id', requireRole([CONTENT_CREATOR_ROLE]), updatePlatformAccountHandler);
router.delete('/:id', requireRole([CONTENT_CREATOR_ROLE]), deletePlatformAccountHandler);

export default router;
