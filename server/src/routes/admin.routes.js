import { Router } from 'express';

import {
  getAdminSettings,
  listAdminUsers,
  updateAdminSettings,
  updateAdminUserRoles
} from '../controllers/admin.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/role.middleware.js';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/users', listAdminUsers);
router.patch('/users/:id/roles', updateAdminUserRoles);
router.get('/settings', getAdminSettings);
router.patch('/settings', updateAdminSettings);

export default router;
