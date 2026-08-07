import TeamMembership from '../models/TeamMembership.js';
import TeamRole from '../models/TeamRole.js';
import Workspace from '../models/Workspace.js';
import {
  ALL_TEAM_PERMISSIONS,
  SYSTEM_TEAM_ROLES,
  TEAM_PERMISSIONS,
  normalizeTeamPermissions
} from '../constants/teamPermissions.js';

const createHttpError = (message, statusCode, code = '') => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
};

const idOf = value => String(value?._id || value || '');

/**
 * Seeds the positions every team starts with. Idempotent: re-running it on a
 * workspace that already has positions adds only the missing ones, so it is safe
 * from both team creation and the backfill.
 */
export const ensureTeamRoles = async ({ workspaceId, createdBy = null }) => {
  const existing = await TeamRole.find({ workspaceId }).select('name isOwner');
  const existingNames = new Set(existing.map(role => role.name));

  const missing = SYSTEM_TEAM_ROLES.filter(role => !existingNames.has(role.name)).map(role => ({
    workspaceId,
    name: role.name,
    color: role.color,
    description: role.description,
    permissions: role.permissions,
    isOwner: Boolean(role.isOwner),
    isSystem: true,
    rank: role.rank,
    createdBy
  }));

  if (missing.length) await TeamRole.insertMany(missing);
  return TeamRole.find({ workspaceId }).sort({ rank: 1, name: 1 });
};

export const getOwnerRole = async workspaceId => {
  const roles = await ensureTeamRoles({ workspaceId });
  return roles.find(role => role.isOwner) || roles[0];
};

/**
 * Guarantees the workspace owner holds an active owner membership. Called from
 * the backfill and from team creation, and cheap enough to be safe anywhere.
 */
export const ensureOwnerMembership = async ({ workspaceId, ownerId }) => {
  const ownerRole = await getOwnerRole(workspaceId);
  return TeamMembership.findOneAndUpdate(
    { workspaceId, userId: ownerId },
    {
      $set: { teamRoleId: ownerRole._id, status: 'active' },
      $setOnInsert: { workspaceId, userId: ownerId, title: 'Owner', hiredAt: new Date() }
    },
    { upsert: true, new: true }
  );
};

/**
 * Resolves what a user may do in one workspace.
 *
 * The owner short-circuits to every permission rather than reading their role
 * row: an owner who accidentally edits their own position must not be able to
 * lock themselves out of their own team.
 */
export const resolveTeamContext = async ({ userId, workspaceId }) => {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) return null;

  const isOwner = idOf(workspace.ownerId) === idOf(userId);

  const membership = await TeamMembership.findOne({ workspaceId, userId }).populate('teamRoleId');

  if (!isOwner && (!membership || membership.status !== 'active')) return null;

  const role = membership?.teamRoleId || null;
  const permissions = isOwner || role?.isOwner ? [...ALL_TEAM_PERMISSIONS] : normalizeTeamPermissions(role?.permissions);

  return {
    workspace,
    workspaceId: workspace._id,
    membership,
    role,
    isOwner,
    permissions,
    can: permission => permissions.includes(permission)
  };
};

/** Every workspace the user can currently act in, personal one first. */
export const listUserTeams = async ({ user }) => {
  /*
   * The account's OWN workspace, not the active one.
   *
   * The auth middleware reassigns user.workspaceId to whichever team the request
   * is acting in, so reading it here labelled the currently-active team as
   * "Personal" and stripped the label from the real personal workspace — which in
   * turn made the switcher clear the active workspace when you clicked the team
   * you were already in, and sent the personal workspace to the team page.
   */
  const personalWorkspaceId = user.personalWorkspaceId || user.workspaceId;

  const memberships = await TeamMembership.find({ userId: user._id, status: 'active' })
    .populate('teamRoleId')
    .sort({ createdAt: 1 });

  const workspaceIds = memberships.map(membership => membership.workspaceId);
  /* The personal workspace predates memberships, so include it either way. */
  if (!workspaceIds.some(id => idOf(id) === idOf(personalWorkspaceId))) {
    workspaceIds.unshift(personalWorkspaceId);
  }

  const [workspaces, memberCounts] = await Promise.all([
    Workspace.find({ _id: { $in: workspaceIds } }).populate('ownerId', 'name email'),
    TeamMembership.aggregate([
      { $match: { workspaceId: { $in: workspaceIds }, status: 'active' } },
      { $group: { _id: '$workspaceId', count: { $sum: 1 } } }
    ])
  ]);

  const countByWorkspace = Object.fromEntries(memberCounts.map(row => [String(row._id), row.count]));
  const membershipByWorkspace = Object.fromEntries(
    memberships.map(membership => [String(membership.workspaceId), membership])
  );

  return workspaces
    .map(workspace => {
      const membership = membershipByWorkspace[idOf(workspace._id)];
      const isOwner = idOf(workspace.ownerId?._id || workspace.ownerId) === idOf(user._id);
      const role = membership?.teamRoleId;
      return {
        _id: workspace._id,
        name: workspace.name,
        type: workspace.type,
        description: workspace.description,
        avatarUrl: workspace.avatarUrl,
        settings: workspace.settings,
        owner: workspace.ownerId,
        isOwner,
        isPersonal: idOf(workspace._id) === idOf(personalWorkspaceId),
        memberCount: countByWorkspace[idOf(workspace._id)] || 1,
        role: role ? { _id: role._id, name: role.name, color: role.color, isOwner: role.isOwner } : null,
        title: membership?.title || (isOwner ? 'Owner' : ''),
        permissions: isOwner || role?.isOwner ? [...ALL_TEAM_PERMISSIONS] : normalizeTeamPermissions(role?.permissions)
      };
    })
    .sort((a, b) => Number(b.isPersonal) - Number(a.isPersonal) || a.name.localeCompare(b.name));
};

export const countActiveMembers = workspaceId =>
  TeamMembership.countDocuments({ workspaceId, status: 'active' });

/**
 * A team of one has nobody to review its work, so the release gate stays off
 * until a second member joins — and turns on by itself at that moment rather
 * than waiting for the head to discover the setting.
 */
export const syncWorkspaceTeamMode = async workspaceId => {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) return null;

  const memberCount = await countActiveMembers(workspaceId);
  const isTeam = memberCount > 1;

  if (isTeam && workspace.type !== 'team') workspace.type = 'team';
  if (isTeam && !workspace.settings.requirePublishApproval) {
    workspace.settings.requirePublishApproval = true;
  }
  if (!isTeam && workspace.type === 'personal') {
    workspace.settings.requirePublishApproval = false;
  }

  await workspace.save();
  return workspace;
};

export const assertPermission = (req, permission) => {
  if (!req.team) {
    throw createHttpError('Team context is unavailable for this request.', 403, 'NO_TEAM_CONTEXT');
  }
  if (!req.team.can(permission)) {
    throw createHttpError(
      `Your position in this team does not allow "${permission}".`,
      403,
      'TEAM_PERMISSION_DENIED'
    );
  }
};

export { TEAM_PERMISSIONS, createHttpError as createTeamHttpError };
