import express from 'express';

import {
  disconnect,
  getCapabilities,
  getConnection,
  getStatus,
  healthCheck,
  listConnections,
  refresh,
  remove
} from '../controllers/platformConnection.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireTeamPermission } from '../middleware/role.middleware.js';
import { TEAM_PERMISSIONS } from '../constants/teamPermissions.js';

const router = express.Router();

router.use(authenticate);

/*
 * Reads stay open to the whole team: composing and publishing both need to
 * know which accounts exist and whether they are healthy.
 *
 * Everything that changes a connection is gated on `accounts.manage`. That
 * permission was defined, offered in the position editor and shown to team
 * owners as "Connect and disconnect platform accounts" — but never checked
 * anywhere, so any active member could disconnect or delete the head's
 * accounts, or rotate their tokens.
 */
router.get('/', listConnections);
router.get('/status', getStatus);
router.get('/capabilities', getCapabilities);
router.get('/:id', getConnection);
router.post('/:id/health-check', healthCheck);

router.post('/:id/disconnect', requireTeamPermission(TEAM_PERMISSIONS.ACCOUNTS_MANAGE), disconnect);
router.post('/:id/refresh', requireTeamPermission(TEAM_PERMISSIONS.ACCOUNTS_MANAGE), refresh);
router.delete('/:id', requireTeamPermission(TEAM_PERMISSIONS.ACCOUNTS_MANAGE), remove);

export default router;
