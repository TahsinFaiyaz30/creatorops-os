import express from 'express';

import { callbackOAuth, startOAuth } from '../controllers/oauth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = express.Router();

router.get('/:platform/start', authenticate, requireRole(['creator_admin']), startOAuth);
router.get('/:platform/callback', callbackOAuth);

export default router;
