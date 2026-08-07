import { TEAM_PERMISSION_GROUPS } from '../constants/teamPermissions.js';
import {
  acceptInvitation,
  createTeam,
  createTeamRole,
  declineInvitation,
  deleteTeamRole,
  getMyTeams,
  getTeamOverview,
  inviteToTeam,
  leaveTeam,
  listAssignableMembers,
  listMyInvitations,
  listTeamRoles,
  removeMember,
  revokeInvitation,
  updateMember,
  updateTeam,
  updateTeamRole
} from '../services/team.service.js';

export const getTeams = async (req, res, next) => {
  try {
    const teams = await getMyTeams({ user: req.user });
    res.json({ data: { teams } });
  } catch (error) {
    next(error);
  }
};

export const postTeam = async (req, res, next) => {
  try {
    const team = await createTeam({ user: req.user, input: req.body });
    res.status(201).json({ data: { team } });
  } catch (error) {
    next(error);
  }
};

export const getOverview = async (req, res, next) => {
  try {
    const overview = await getTeamOverview({ user: req.user, team: req.team });
    res.json({ data: overview });
  } catch (error) {
    next(error);
  }
};

export const patchTeam = async (req, res, next) => {
  try {
    const team = await updateTeam({ team: req.team, input: req.body });
    res.json({ data: { team } });
  } catch (error) {
    next(error);
  }
};

/** The permission catalogue, so the role editor never hardcodes it. */
export const getPermissionCatalogue = (_req, res) => {
  res.json({ data: { groups: TEAM_PERMISSION_GROUPS } });
};

export const getRoles = async (req, res, next) => {
  try {
    const roles = await listTeamRoles({ team: req.team });
    res.json({ data: { roles } });
  } catch (error) {
    next(error);
  }
};

export const postRole = async (req, res, next) => {
  try {
    const role = await createTeamRole({ user: req.user, team: req.team, input: req.body });
    res.status(201).json({ data: { role } });
  } catch (error) {
    next(error);
  }
};

export const patchRole = async (req, res, next) => {
  try {
    const role = await updateTeamRole({ team: req.team, roleId: req.params.roleId, input: req.body });
    res.json({ data: { role } });
  } catch (error) {
    next(error);
  }
};

export const deleteRole = async (req, res, next) => {
  try {
    const result = await deleteTeamRole({ team: req.team, roleId: req.params.roleId });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const postInvite = async (req, res, next) => {
  try {
    const invitation = await inviteToTeam({ user: req.user, team: req.team, input: req.body });
    res.status(201).json({ data: { invitation } });
  } catch (error) {
    next(error);
  }
};

export const deleteInvite = async (req, res, next) => {
  try {
    const invitation = await revokeInvitation({ team: req.team, invitationId: req.params.invitationId });
    res.json({ data: { invitation } });
  } catch (error) {
    next(error);
  }
};

export const getMyInvitations = async (req, res, next) => {
  try {
    const invitations = await listMyInvitations({ user: req.user });
    res.json({ data: { invitations } });
  } catch (error) {
    next(error);
  }
};

export const postAcceptInvitation = async (req, res, next) => {
  try {
    const result = await acceptInvitation({ user: req.user, invitationId: req.params.invitationId });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const postDeclineInvitation = async (req, res, next) => {
  try {
    const invitation = await declineInvitation({ user: req.user, invitationId: req.params.invitationId });
    res.json({ data: { invitation } });
  } catch (error) {
    next(error);
  }
};

export const patchMember = async (req, res, next) => {
  try {
    const member = await updateMember({
      user: req.user,
      team: req.team,
      membershipId: req.params.membershipId,
      input: req.body
    });
    res.json({ data: { member } });
  } catch (error) {
    next(error);
  }
};

export const deleteMember = async (req, res, next) => {
  try {
    const result = await removeMember({ user: req.user, team: req.team, membershipId: req.params.membershipId });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const postLeave = async (req, res, next) => {
  try {
    const result = await leaveTeam({ user: req.user, team: req.team });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const getAssignableMembers = async (req, res, next) => {
  try {
    const members = await listAssignableMembers({ team: req.team });
    res.json({ data: { members } });
  } catch (error) {
    next(error);
  }
};
