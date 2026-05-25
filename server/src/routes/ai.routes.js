import { Router } from 'express';

import {
  customizeCaptionsHandler,
  optimizeVariantHandler,
  repurposeContentHandler
} from '../controllers/ai.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.post('/repurpose', repurposeContentHandler);
router.post('/optimize', optimizeVariantHandler);
router.post('/customize-captions', customizeCaptionsHandler);

export default router;
