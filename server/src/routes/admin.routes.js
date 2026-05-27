import { Router } from 'express';

import { listAdminUsers, updateAdminUserRoles } from '../controllers/admin.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/role.middleware.js';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/users', listAdminUsers);
router.patch('/users/:id/roles', updateAdminUserRoles);

export default router;
