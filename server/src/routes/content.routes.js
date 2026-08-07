import { Router } from 'express';

import {
  createContentHandler,
  getContentVersionsHandler,
  listContentVariantsHandler,
  listContentByCampaignHandler,
  listMyTasksHandler,
  updateContentHandler,
  updateContentStatusHandler
} from '../controllers/content.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireTeamPermission } from '../middleware/role.middleware.js';
import { TEAM_PERMISSIONS } from '../constants/teamPermissions.js';

const router = Router();

router.use(authenticate);

/* /mine before /:id so the literal segment is not swallowed by the param route. */
router.get('/mine', listMyTasksHandler);

router.post('/', requireTeamPermission(TEAM_PERMISSIONS.CONTENT_CREATE), createContentHandler);
router.get('/campaign/:campaignId', listContentByCampaignHandler);
router.patch('/:id', requireTeamPermission(TEAM_PERMISSIONS.CONTENT_EDIT), updateContentHandler);
router.patch('/:id/status', requireTeamPermission(TEAM_PERMISSIONS.CONTENT_EDIT), updateContentStatusHandler);
router.get('/:id/versions', getContentVersionsHandler);
router.get('/:id/variants', listContentVariantsHandler);

export default router;
