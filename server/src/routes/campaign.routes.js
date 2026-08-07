import { Router } from 'express';

import {
  createCampaignHandler,
  getCampaignHandler,
  getCampaignTrackingHandler,
  listCampaignsHandler,
  patchCampaignHandler
} from '../controllers/campaign.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireTeamPermission } from '../middleware/role.middleware.js';
import { TEAM_PERMISSIONS } from '../constants/teamPermissions.js';

const router = Router();

router.use(authenticate);

/*
 * Reads carry no permission gate on purpose: what a member may see is decided by
 * project membership inside the service (projectScopeFilter / assertProjectAccess),
 * not by a blanket permission — so a Designer sees their own projects and nothing
 * else, without needing a permission to see anything at all.
 */
router.post('/', requireTeamPermission(TEAM_PERMISSIONS.PROJECT_CREATE), createCampaignHandler);
router.get('/', listCampaignsHandler);
router.get('/:id/tracking', getCampaignTrackingHandler);
router.get('/:id/publish-summary', getCampaignTrackingHandler);
router.patch('/:id', patchCampaignHandler);
router.get('/:id', getCampaignHandler);

export default router;
