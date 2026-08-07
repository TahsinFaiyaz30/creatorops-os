import Campaign from '../models/Campaign.js';
import { TEAM_PERMISSIONS } from '../constants/teamPermissions.js';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Project isolation.
 *
 * One rule, in one place:
 *
 *   A member sees a project — and everything hanging off it: tasks, deliverables,
 *   approvals, media, messages — if and only if they are in `memberIds`, or they
 *   hold project.view_all.
 *
 * Every project-scoped read and write routes through here. A visibility rule
 * enforced in twelve call sites is a visibility rule with a hole in it, and the
 * hole is always the endpoint nobody remembered.
 *
 * A personal workspace has no team context and no members, so everything below
 * degrades to "your own workspace, allow" — a solo creator never meets this code.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const createHttpError = (message, statusCode, code = '') => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
};

const idOf = value => String(value?._id || value || '');

export const canViewAllProjects = ({ team }) =>
  !team || team.isOwner || team.can(TEAM_PERMISSIONS.PROJECT_VIEW_ALL);

export const isProjectMember = ({ project, user }) => {
  const userId = idOf(user._id);
  if (idOf(project.createdBy) === userId) return true;
  if (idOf(project.leadId) === userId) return true;
  return (project.memberIds || []).some(memberId => idOf(memberId) === userId);
};

/**
 * Mongo filter selecting the projects this caller may see. Used instead of
 * fetching everything and filtering in JS, so a member's list query never even
 * reads rows they are not entitled to.
 */
export const projectScopeFilter = ({ user, team }) => {
  const filter = { workspaceId: user.workspaceId };
  if (canViewAllProjects({ team })) return filter;

  return {
    ...filter,
    $or: [
      { memberIds: user._id },
      { leadId: user._id },
      { createdBy: user._id },
      /* Explicitly team-wide projects are visible to everyone in the team. */
      { visibility: 'team' }
    ]
  };
};

/**
 * Loads a project and proves the caller may touch it.
 *
 * `requireManage` additionally demands project.manage — used by edits, so a
 * member who can see a project cannot silently rewrite its brief or membership.
 */
export const assertProjectAccess = async ({ user, team, projectId, requireManage = false }) => {
  if (!projectId) throw createHttpError('A project is required.', 400);

  const project = await Campaign.findOne({ _id: projectId, workspaceId: user.workspaceId });
  if (!project) throw createHttpError('Project not found.', 404);

  const visible = canViewAllProjects({ team }) || project.visibility === 'team' || isProjectMember({ project, user });
  /*
   * 404, not 403. Telling someone "this exists but you cannot see it" leaks the
   * existence of work they were deliberately kept out of, which is exactly what
   * project isolation is for.
   */
  if (!visible) throw createHttpError('Project not found.', 404);

  if (requireManage) {
    const canManage =
      !team ||
      team.isOwner ||
      team.can(TEAM_PERMISSIONS.PROJECT_MANAGE) ||
      idOf(project.leadId) === idOf(user._id);
    if (!canManage) {
      throw createHttpError('Your position in this team does not allow managing this project.', 403, 'TEAM_PERMISSION_DENIED');
    }
  }

  return project;
};

/** Project ids the caller may see — for scoping queries on child collections. */
export const visibleProjectIds = async ({ user, team }) => {
  if (canViewAllProjects({ team })) return null; /* null = no restriction */
  const projects = await Campaign.find(projectScopeFilter({ user, team })).select('_id');
  return projects.map(project => project._id);
};

/**
 * Applies project visibility to any collection carrying a campaignId. Returns
 * the filter unchanged for callers who can see everything, so the common
 * solo/owner path adds no query cost.
 */
export const scopeByVisibleProjects = async ({ user, team, filter = {}, field = 'campaignId' }) => {
  const allowed = await visibleProjectIds({ user, team });
  if (allowed === null) return filter;
  return { ...filter, [field]: { $in: allowed } };
};

export { createHttpError as createProjectHttpError };
