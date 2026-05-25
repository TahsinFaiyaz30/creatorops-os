import { Router } from 'express';

import {
  createContentHandler,
  getContentVersionsHandler,
  listContentByCampaignHandler,
  updateContentHandler,
  updateContentStatusHandler
} from '../controllers/content.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.post('/', createContentHandler);
router.get('/campaign/:campaignId', listContentByCampaignHandler);
router.patch('/:id', updateContentHandler);
router.patch('/:id/status', updateContentStatusHandler);
router.get('/:id/versions', getContentVersionsHandler);

export default router;
