import { Router } from 'express';

import { optimizeVariantHandler, repurposeContentHandler } from '../controllers/ai.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.post('/repurpose', repurposeContentHandler);
router.post('/optimize', optimizeVariantHandler);

export default router;
