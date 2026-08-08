import express from 'express';

import { callbackOAuth, startOAuth } from '../controllers/oauth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireTeamPermission } from '../middleware/role.middleware.js';
import { TEAM_PERMISSIONS } from '../constants/teamPermissions.js';

const router = express.Router();

/* Starting a flow attaches a real account to the active workspace, so it needs
   the same permission as disconnecting one. */
router.get(
  '/:platform/start',
  authenticate,
  requireTeamPermission(TEAM_PERMISSIONS.ACCOUNTS_MANAGE),
  startOAuth
);

/*
 * Deliberately unauthenticated — this is the provider's redirect and carries no
 * session. The signed, single-use `state` identifies the user and the workspace,
 * and completeOAuthCallback re-checks membership before storing anything.
 */
router.get('/:platform/callback', callbackOAuth);

export default router;
