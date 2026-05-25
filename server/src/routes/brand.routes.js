import { Router } from 'express';

import {
  createBrandProfileHandler,
  getBrandProfileHandler,
  updateBrandProfileHandler
} from '../controllers/brandProfile.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', getBrandProfileHandler);
router.post('/', createBrandProfileHandler);
router.patch('/', updateBrandProfileHandler);

export default router;
