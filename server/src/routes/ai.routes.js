import { Router } from 'express';

import {
  customizeCaptionsHandler,
  optimizeVariantHandler,
  repurposeContentHandler
} from '../controllers/ai.controller.js';
import { aiScript } from '../controllers/script.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireTeamPermission } from '../middleware/role.middleware.js';
import { TEAM_PERMISSIONS } from '../constants/teamPermissions.js';

const router = Router();

router.use(authenticate);

/*
 * The sidebar hides Compose and Script AI from positions lacking these
 * permissions, but hiding a link is not access control: a Viewer holding no
 * permissions at all could still call every one of these directly, burning the
 * team's AI budget and writing variants into campaigns they cannot even open.
 * A solo creator has no team context, so these pass them through unchanged.
 */
router.post('/repurpose', requireTeamPermission(TEAM_PERMISSIONS.VARIANT_GENERATE), repurposeContentHandler);
router.post('/optimize', requireTeamPermission(TEAM_PERMISSIONS.VARIANT_EDIT), optimizeVariantHandler);
router.post('/customize-captions', requireTeamPermission(TEAM_PERMISSIONS.VARIANT_GENERATE), customizeCaptionsHandler);
router.post('/script', requireTeamPermission(TEAM_PERMISSIONS.SCRIPT_USE), aiScript);

export default router;
