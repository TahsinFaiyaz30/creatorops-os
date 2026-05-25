import { Router } from 'express';

import {
  getPlatformFormatHandler,
  listPlatformFormatsHandler
} from '../controllers/platformFormat.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', listPlatformFormatsHandler);
router.get('/:platform', getPlatformFormatHandler);

export default router;
