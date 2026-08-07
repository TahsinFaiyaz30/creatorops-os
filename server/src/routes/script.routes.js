import express from 'express';

import { convertScript, getScript, getScripts } from '../controllers/script.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireTeamPermission } from '../middleware/role.middleware.js';
import { TEAM_PERMISSIONS } from '../constants/teamPermissions.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getScripts);
router.get('/:id', getScript);
/* Turning a script into a content item is authoring, so it needs content.create. */
router.post('/:id/convert-to-content', requireTeamPermission(TEAM_PERMISSIONS.CONTENT_CREATE), convertScript);

export default router;
