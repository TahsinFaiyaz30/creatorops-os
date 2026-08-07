import mongoose from 'mongoose';

import PublishJob from '../models/PublishJob.js';
import TeamInvitation, { createInvitationToken } from '../models/TeamInvitation.js';
import TeamMembership from '../models/TeamMembership.js';
import TeamRole from '../models/TeamRole.js';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import { ALL_TEAM_PERMISSIONS, TEAM_PERMISSIONS, normalizeTeamPermissions } from '../constants/teamPermissions.js';
import { createWorkflowEvent } from './event.service.js';
import { createNotification } from './notification.service.js';
import {
  ensureOwnerMembership,
  ensureTeamRoles,
  listUserTeams,
  syncWorkspaceTeamMode
} from './teamMembership.service.js';

const INVITATION_TTL_DAYS = 14;

const createHttpError = (message, statusCode, code = '') => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
};

const idOf = value => String(value?._id || value || '');

const normalizeEmail = email => String(email || '').trim().toLowerCase();

/* ── Teams ────────────────────────────────────────────────────────────────── */

export const getMyTeams = ({ user }) => listUserTeams({ user });

export const createTeam = async ({ user, input }) => {
  const name = String(input?.name || '').trim();
  if (!name) throw createHttpError('Team name is required.', 400);

  const workspace = await Workspace.create({
    name,
    ownerId: user._id,
    type: 'team',
    description: String(input?.description || '').trim(),
    avatarUrl: String(input?.avatarUrl || '').trim(),
    /* A brand new team has one member, so the release gate would only ask the
       head to approve themselves. syncWorkspaceTeamMode turns it on at member two. */
    settings: { requirePublishApproval: false, requireApprovalToHandoff: false }
  });

  await ensureOwnerMembership({ workspaceId: workspace._id, ownerId: user._id });

  await createWorkflowEvent({
    workspaceId: workspace._id,
    actorId: user._id,
    eventType: 'team.created',
    message: `Team "${workspace.name}" created.`,
    entityType: 'Workspace',
    entityId: workspace._id,
    metadata: { workspaceId: workspace._id }
  });

  return workspace;
};

const assertTeamAccess = req => {
  if (!req?.team) throw createHttpError('You are not an active member of this team.', 403);
  return req.team;
};

export const getTeamOverview = async ({ user, team }) => {
  assertTeamAccess({ team });
  const workspaceId = team.workspaceId;

  const [workspace, members, roles, pendingInvitations] = await Promise.all([
    Workspace.findById(workspaceId).populate('ownerId', 'name email profile.avatarUrl'),
    TeamMembership.find({ workspaceId, status: { $in: ['active', 'suspended'] } })
      .populate('userId', 'name email role profile.avatarUrl averageRating totalReviews')
      .populate('teamRoleId')
      .sort({ createdAt: 1 }),
    ensureTeamRoles({ workspaceId }),
    team.can(TEAM_PERMISSIONS.TEAM_INVITE)
      ? TeamInvitation.find({ workspaceId, status: 'pending' }).populate('teamRoleId', 'name color').sort({ createdAt: -1 })
      : []
  ]);

  return {
    team: {
      _id: workspace._id,
      name: workspace.name,
      type: workspace.type,
      description: workspace.description,
      avatarUrl: workspace.avatarUrl,
      settings: workspace.settings,
      owner: workspace.ownerId,
      createdAt: workspace.createdAt
    },
    /* Echoed back so the client renders exactly the controls this member has. */
    viewer: {
      userId: user._id,
      isOwner: team.isOwner,
      permissions: team.permissions,
      role: team.role ? { _id: team.role._id, name: team.role.name, color: team.role.color } : null
    },
    members: members.map(membership => ({
      _id: membership._id,
      user: membership.userId,
      role: membership.teamRoleId,
      title: membership.title,
      status: membership.status,
      hiredAt: membership.hiredAt,
      isOwner: idOf(membership.userId?._id) === idOf(workspace.ownerId?._id || workspace.ownerId)
    })),
    roles,
    pendingInvitations
  };
};

export const updateTeam = async ({ team, input }) => {
  const workspace = await Workspace.findById(team.workspaceId);
  if (!workspace) throw createHttpError('Team not found.', 404);

  if (input.name !== undefined) {
    const name = String(input.name).trim();
    if (!name) throw createHttpError('Team name cannot be empty.', 400);
    workspace.name = name;
  }
  if (input.description !== undefined) workspace.description = String(input.description).trim();
  if (input.avatarUrl !== undefined) workspace.avatarUrl = String(input.avatarUrl).trim();
  if (input.settings?.requirePublishApproval !== undefined) {
    workspace.settings.requirePublishApproval = Boolean(input.settings.requirePublishApproval);
  }
  if (input.settings?.requireApprovalToHandoff !== undefined) {
    workspace.settings.requireApprovalToHandoff = Boolean(input.settings.requireApprovalToHandoff);
  }

  await workspace.save();
  return workspace;
};

/* ── Positions ────────────────────────────────────────────────────────────── */

export const listTeamRoles = ({ team }) => ensureTeamRoles({ workspaceId: team.workspaceId });

export const createTeamRole = async ({ user, team, input }) => {
  const name = String(input?.name || '').trim();
  if (!name) throw createHttpError('Position name is required.', 400);

  const duplicate = await TeamRole.findOne({ workspaceId: team.workspaceId, name });
  if (duplicate) throw createHttpError('A position with that name already exists in this team.', 409);

  return TeamRole.create({
    workspaceId: team.workspaceId,
    name,
    color: String(input?.color || '#8b5cf6'),
    description: String(input?.description || '').trim(),
    permissions: normalizeTeamPermissions(input?.permissions),
    rank: Number.isFinite(Number(input?.rank)) ? Number(input.rank) : 100,
    createdBy: user._id
  });
};

const findEditableRole = async ({ team, roleId }) => {
  const role = await TeamRole.findOne({ _id: roleId, workspaceId: team.workspaceId });
  if (!role) throw createHttpError('Position not found.', 404);
  /*
   * The owner position is deliberately immutable. It is the only guarantee that
   * a head cannot edit or delete their way out of controlling their own team.
   */
  if (role.isOwner) throw createHttpError('The Owner position cannot be edited or removed.', 400, 'OWNER_ROLE_LOCKED');
  return role;
};

export const updateTeamRole = async ({ team, roleId, input }) => {
  const role = await findEditableRole({ team, roleId });

  if (input.name !== undefined) {
    const name = String(input.name).trim();
    if (!name) throw createHttpError('Position name cannot be empty.', 400);
    const duplicate = await TeamRole.findOne({ workspaceId: team.workspaceId, name, _id: { $ne: role._id } });
    if (duplicate) throw createHttpError('A position with that name already exists in this team.', 409);
    role.name = name;
  }
  if (input.color !== undefined) role.color = String(input.color);
  if (input.description !== undefined) role.description = String(input.description).trim();
  if (input.permissions !== undefined) role.permissions = normalizeTeamPermissions(input.permissions);
  if (input.rank !== undefined && Number.isFinite(Number(input.rank))) role.rank = Number(input.rank);

  await role.save();
  return role;
};

export const deleteTeamRole = async ({ team, roleId }) => {
  const role = await findEditableRole({ team, roleId });

  const inUse = await TeamMembership.countDocuments({
    workspaceId: team.workspaceId,
    teamRoleId: role._id,
    status: { $in: ['active', 'suspended'] }
  });
  if (inUse > 0) {
    throw createHttpError(
      `${inUse} member${inUse === 1 ? '' : 's'} still hold this position. Move them to another position first.`,
      409,
      'ROLE_IN_USE'
    );
  }

  const pendingInvites = await TeamInvitation.countDocuments({
    workspaceId: team.workspaceId,
    teamRoleId: role._id,
    status: 'pending'
  });
  if (pendingInvites > 0) {
    throw createHttpError('Pending invitations still offer this position. Revoke them first.', 409, 'ROLE_IN_USE');
  }

  await role.deleteOne();
  return { _id: role._id, deleted: true };
};

/* ── Hiring ───────────────────────────────────────────────────────────────── */

export const inviteToTeam = async ({ user, team, input }) => {
  const email = normalizeEmail(input?.email);
  if (!email) throw createHttpError('An email address is required to invite someone.', 400);

  const role = await TeamRole.findOne({ _id: input?.teamRoleId, workspaceId: team.workspaceId });
  if (!role) throw createHttpError('Pick a position from this team for the invitation.', 400);
  if (role.isOwner) throw createHttpError('The Owner position cannot be handed out through an invitation.', 400);

  const invitee = await User.findOne({ email }).select('_id name email workspaceId');

  if (invitee) {
    const existingMembership = await TeamMembership.findOne({ workspaceId: team.workspaceId, userId: invitee._id });
    if (existingMembership && existingMembership.status === 'active') {
      throw createHttpError('That creator is already an active member of this team.', 409, 'ALREADY_MEMBER');
    }
  }

  const existingInvite = await TeamInvitation.findOne({ workspaceId: team.workspaceId, email, status: 'pending' });
  if (existingInvite) {
    throw createHttpError('An invitation is already pending for that email.', 409, 'INVITE_PENDING');
  }

  const invitation = await TeamInvitation.create({
    workspaceId: team.workspaceId,
    email,
    userId: invitee?._id || null,
    teamRoleId: role._id,
    title: String(input?.title || '').trim(),
    message: String(input?.message || '').trim(),
    token: createInvitationToken(),
    invitedBy: user._id,
    expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000)
  });

  if (invitee) {
    /*
     * Notifications are workspace-scoped and the invitee is not a member yet, so
     * this is addressed to their own workspace — otherwise the invite would land
     * in a team they cannot read.
     */
    await createNotification({
      workspaceId: invitee.workspaceId,
      userId: invitee._id,
      type: 'team_invited',
      title: 'You have been invited to a team',
      message: `${user.name} invited you to join ${team.workspace.name} as ${role.name}.`,
      entityType: 'TeamInvitation',
      entityId: invitation._id
    });
  }

  await createWorkflowEvent({
    workspaceId: team.workspaceId,
    actorId: user._id,
    eventType: 'team.invited',
    message: `Invited ${email} as ${role.name}.`,
    entityType: 'TeamInvitation',
    entityId: invitation._id,
    metadata: { email, teamRoleId: role._id, roleName: role.name }
  });

  return TeamInvitation.findById(invitation._id).populate('teamRoleId', 'name color');
};

export const revokeInvitation = async ({ team, invitationId }) => {
  const invitation = await TeamInvitation.findOne({
    _id: invitationId,
    workspaceId: team.workspaceId,
    status: 'pending'
  });
  if (!invitation) throw createHttpError('Pending invitation not found.', 404);

  invitation.status = 'revoked';
  invitation.respondedAt = new Date();
  await invitation.save();
  return invitation;
};

/** Invitations addressed to this account's email but sent before it existed. */
export const claimPendingInvitations = async ({ user }) => {
  const result = await TeamInvitation.updateMany(
    { email: normalizeEmail(user.email), userId: null, status: 'pending' },
    { $set: { userId: user._id } }
  );
  return result.modifiedCount || 0;
};

const expireIfStale = async invitation => {
  if (invitation.status === 'pending' && invitation.expiresAt < new Date()) {
    invitation.status = 'expired';
    await invitation.save();
    return true;
  }
  return false;
};

export const listMyInvitations = async ({ user }) => {
  await claimPendingInvitations({ user });

  const invitations = await TeamInvitation.find({
    status: 'pending',
    $or: [{ userId: user._id }, { email: normalizeEmail(user.email) }]
  })
    .populate('teamRoleId', 'name color description permissions')
    .populate('workspaceId', 'name description avatarUrl type')
    .populate('invitedBy', 'name email')
    .sort({ createdAt: -1 });

  const live = [];
  for (const invitation of invitations) {
    if (await expireIfStale(invitation)) continue;
    live.push(invitation);
  }
  return live;
};

const findMyInvitation = async ({ user, invitationId }) => {
  const invitation = await TeamInvitation.findOne({
    _id: invitationId,
    status: 'pending',
    $or: [{ userId: user._id }, { email: normalizeEmail(user.email) }]
  });
  if (!invitation) throw createHttpError('Invitation not found or no longer pending.', 404);
  if (await expireIfStale(invitation)) throw createHttpError('That invitation has expired.', 410, 'INVITE_EXPIRED');
  return invitation;
};

export const acceptInvitation = async ({ user, invitationId }) => {
  const invitation = await findMyInvitation({ user, invitationId });

  const role = await TeamRole.findOne({ _id: invitation.teamRoleId, workspaceId: invitation.workspaceId });
  if (!role) throw createHttpError('The position offered no longer exists in that team.', 409);

  const membership = await TeamMembership.findOneAndUpdate(
    { workspaceId: invitation.workspaceId, userId: user._id },
    {
      $set: {
        teamRoleId: role._id,
        title: invitation.title || role.name,
        status: 'active',
        invitedBy: invitation.invitedBy,
        leftAt: null
      },
      $setOnInsert: { hiredAt: new Date() }
    },
    { upsert: true, new: true }
  );

  invitation.status = 'accepted';
  invitation.userId = user._id;
  invitation.respondedAt = new Date();
  await invitation.save();

  /* Second member turns the workspace into a team and arms the release gate. */
  await syncWorkspaceTeamMode(invitation.workspaceId);

  const workspace = await Workspace.findById(invitation.workspaceId).select('name ownerId');
  await createNotification({
    workspaceId: invitation.workspaceId,
    userId: workspace.ownerId,
    type: 'team_joined',
    title: 'A creator joined your team',
    message: `${user.name} accepted the ${role.name} position in ${workspace.name}.`,
    entityType: 'TeamMembership',
    entityId: membership._id
  });

  await createWorkflowEvent({
    workspaceId: invitation.workspaceId,
    actorId: user._id,
    eventType: 'team.member_joined',
    message: `${user.name} joined as ${role.name}.`,
    entityType: 'TeamMembership',
    entityId: membership._id,
    metadata: { userId: user._id, teamRoleId: role._id, roleName: role.name }
  });

  return { membership, workspaceId: invitation.workspaceId };
};

export const declineInvitation = async ({ user, invitationId }) => {
  const invitation = await findMyInvitation({ user, invitationId });
  invitation.status = 'declined';
  invitation.userId = user._id;
  invitation.respondedAt = new Date();
  await invitation.save();
  return invitation;
};

/* ── Members ──────────────────────────────────────────────────────────────── */

/**
 * Someone who is no longer on the team must not still be publishing to it.
 *
 * Their scheduled jobs are queued against the team's connected accounts and
 * would have gone out days later on the head's own Facebook or YouTube, long
 * after access was revoked. Only jobs that have not started are cancelled —
 * `publishing` is left alone rather than aborted mid-upload.
 */
const cancelQueuedJobsFor = async ({ workspaceId, userId, reason }) => {
  const result = await PublishJob.updateMany(
    { workspaceId, createdBy: userId, status: 'queued' },
    {
      $set: {
        status: 'cancelled',
        processingStage: 'cancelled',
        processingMessage: reason,
        processingStageUpdatedAt: new Date()
      }
    }
  );
  return result.modifiedCount || 0;
};

const findMembership = async ({ team, membershipId }) => {
  const membership = await TeamMembership.findOne({ _id: membershipId, workspaceId: team.workspaceId });
  if (!membership) throw createHttpError('Team member not found.', 404);

  const workspace = await Workspace.findById(team.workspaceId).select('ownerId');
  if (idOf(membership.userId) === idOf(workspace.ownerId)) {
    throw createHttpError('The team owner cannot be changed or removed.', 400, 'OWNER_LOCKED');
  }
  return membership;
};

export const updateMember = async ({ user, team, membershipId, input }) => {
  const membership = await findMembership({ team, membershipId });

  if (input.teamRoleId !== undefined) {
    const role = await TeamRole.findOne({ _id: input.teamRoleId, workspaceId: team.workspaceId });
    if (!role) throw createHttpError('Pick a position from this team.', 400);
    if (role.isOwner) throw createHttpError('The Owner position cannot be assigned.', 400);
    membership.teamRoleId = role._id;
  }
  if (input.title !== undefined) membership.title = String(input.title).trim();
  if (input.status !== undefined && ['active', 'suspended'].includes(input.status)) {
    membership.status = input.status;
  }

  await membership.save();

  /* Suspension locks them out, so their queued posts must not fire either. */
  if (membership.status === 'suspended') {
    await cancelQueuedJobsFor({
      workspaceId: team.workspaceId,
      userId: membership.userId,
      reason: 'Cancelled because the member who queued it was suspended.'
    });
  }

  await createWorkflowEvent({
    workspaceId: team.workspaceId,
    actorId: user._id,
    eventType: 'team.member_updated',
    message: 'Team member updated.',
    entityType: 'TeamMembership',
    entityId: membership._id,
    metadata: { userId: membership.userId, teamRoleId: membership.teamRoleId, status: membership.status }
  });

  return TeamMembership.findById(membership._id).populate('userId', 'name email role profile.avatarUrl').populate('teamRoleId');
};

export const removeMember = async ({ user, team, membershipId }) => {
  const membership = await findMembership({ team, membershipId });

  membership.status = 'removed';
  membership.leftAt = new Date();
  await membership.save();
  await syncWorkspaceTeamMode(team.workspaceId);

  const cancelledJobs = await cancelQueuedJobsFor({
    workspaceId: team.workspaceId,
    userId: membership.userId,
    reason: 'Cancelled because the member who queued it was removed from the team.'
  });

  await createWorkflowEvent({
    workspaceId: team.workspaceId,
    actorId: user._id,
    eventType: 'team.member_removed',
    message:
      cancelledJobs > 0
        ? `Team member removed. ${cancelledJobs} queued dispatch${cancelledJobs === 1 ? '' : 'es'} cancelled.`
        : 'Team member removed.',
    entityType: 'TeamMembership',
    entityId: membership._id,
    metadata: { userId: membership.userId, cancelledJobs }
  });

  /*
   * The membership row is kept, never deleted: their tasks, deliverables,
   * approvals and messages all reference it, and losing the row would leave
   * the team's history full of dangling authors.
   */
  return { _id: membership._id, status: membership.status };
};

export const leaveTeam = async ({ user, team }) => {
  const workspace = await Workspace.findById(team.workspaceId).select('ownerId name');
  if (idOf(workspace.ownerId) === idOf(user._id)) {
    throw createHttpError('A team owner cannot leave their own team.', 400, 'OWNER_CANNOT_LEAVE');
  }

  const membership = await TeamMembership.findOne({ workspaceId: team.workspaceId, userId: user._id });
  if (!membership) throw createHttpError('You are not a member of this team.', 404);

  membership.status = 'left';
  membership.leftAt = new Date();
  await membership.save();
  await syncWorkspaceTeamMode(team.workspaceId);

  await cancelQueuedJobsFor({
    workspaceId: team.workspaceId,
    userId: user._id,
    reason: 'Cancelled because the member who queued it left the team.'
  });

  await createWorkflowEvent({
    workspaceId: team.workspaceId,
    actorId: user._id,
    eventType: 'team.member_left',
    message: `${user.name} left the team.`,
    entityType: 'TeamMembership',
    entityId: membership._id,
    metadata: { userId: user._id }
  });

  return { _id: membership._id, status: membership.status };
};

/** Members a project can draw from, for assignment pickers. */
export const listAssignableMembers = async ({ team }) => {
  const memberships = await TeamMembership.find({ workspaceId: team.workspaceId, status: 'active' })
    .populate('userId', 'name email profile.avatarUrl')
    .populate('teamRoleId', 'name color');

  return memberships
    .filter(membership => membership.userId)
    .map(membership => ({
      userId: membership.userId._id,
      name: membership.userId.name,
      email: membership.userId.email,
      avatarUrl: membership.userId.profile?.avatarUrl || '',
      role: membership.teamRoleId ? { name: membership.teamRoleId.name, color: membership.teamRoleId.color } : null,
      title: membership.title
    }));
};

export { ALL_TEAM_PERMISSIONS, mongoose };
