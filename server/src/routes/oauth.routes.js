import express from 'express';

import { callbackOAuth, startOAuth } from '../controllers/oauth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/:platform/start', authenticate, startOAuth);
router.get('/:platform/callback', callbackOAuth);

export default router;
