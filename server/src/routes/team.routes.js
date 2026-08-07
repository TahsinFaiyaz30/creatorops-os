import { Router } from 'express';

import {
  deleteInvite,
  deleteMember,
  deleteRole,
  getAssignableMembers,
  getMyInvitations,
  getOverview,
  getPermissionCatalogue,
  getRoles,
  getTeams,
  patchMember,
  patchRole,
  patchTeam,
  postAcceptInvitation,
  postDeclineInvitation,
  postInvite,
  postLeave,
  postRole,
  postTeam
} from '../controllers/team.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireTeamPermission } from '../middleware/role.middleware.js';
import { TEAM_PERMISSIONS } from '../constants/teamPermissions.js';

const router = Router();

router.use(authenticate);

/*
 * Routes below /current act on whichever workspace the X-Workspace-Id header
 * selects, which the auth middleware has already validated membership for. The
 * team-scoped routes therefore never take a workspace id in the path — one way
 * in means one place where membership is checked.
 */

router.get('/', getTeams);
router.post('/', postTeam);
router.get('/permissions', getPermissionCatalogue);

router.get('/invitations', getMyInvitations);
router.post('/invitations/:invitationId/accept', postAcceptInvitation);
router.post('/invitations/:invitationId/decline', postDeclineInvitation);

router.get('/current', getOverview);
router.patch('/current', requireTeamPermission(TEAM_PERMISSIONS.TEAM_MANAGE), patchTeam);
router.post('/current/leave', postLeave);
router.get('/current/members/assignable', getAssignableMembers);

router.get('/current/roles', getRoles);
router.post('/current/roles', requireTeamPermission(TEAM_PERMISSIONS.TEAM_ROLES), postRole);
router.patch('/current/roles/:roleId', requireTeamPermission(TEAM_PERMISSIONS.TEAM_ROLES), patchRole);
router.delete('/current/roles/:roleId', requireTeamPermission(TEAM_PERMISSIONS.TEAM_ROLES), deleteRole);

router.post('/current/invites', requireTeamPermission(TEAM_PERMISSIONS.TEAM_INVITE), postInvite);
router.delete('/current/invites/:invitationId', requireTeamPermission(TEAM_PERMISSIONS.TEAM_INVITE), deleteInvite);

router.patch('/current/members/:membershipId', requireTeamPermission(TEAM_PERMISSIONS.TEAM_INVITE), patchMember);
router.delete('/current/members/:membershipId', requireTeamPermission(TEAM_PERMISSIONS.TEAM_REMOVE), deleteMember);

export default router;
