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
import { BRAND_REP_ROLE, CONTENT_CREATOR_ROLE } from '../constants/roles.js';

const router = Router();

router.use(authenticate);

const accountManagerRoles = [CONTENT_CREATOR_ROLE, BRAND_REP_ROLE];

router.post('/', requireRole(accountManagerRoles), createPlatformAccountHandler);
router.get('/', listPlatformAccountsHandler);
router.get('/:id', getPlatformAccountHandler);
router.patch('/:id', requireRole(accountManagerRoles), updatePlatformAccountHandler);
router.delete('/:id', requireRole(accountManagerRoles), deletePlatformAccountHandler);

export default router;
