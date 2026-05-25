import { Router } from 'express';

import {
  createCampaignHandler,
  getCampaignHandler,
  listCampaignsHandler
} from '../controllers/campaign.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.post('/', createCampaignHandler);
router.get('/', listCampaignsHandler);
router.get('/:id', getCampaignHandler);

export default router;
