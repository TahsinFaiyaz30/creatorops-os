import jwt from 'jsonwebtoken';

import env from '../config/env.js';
import { normalizeRoles, primaryRole } from '../constants/roles.js';
import User from '../models/User.js';
import { resolveTeamContext } from '../services/teamMembership.service.js';

export const WORKSPACE_HEADER = 'x-workspace-id';

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * Active workspace resolution.
 *
 * Every model in this codebase is scoped by workspaceId, and this is the single
 * place that decides which workspace a request runs in. That is what makes teams
 * possible without threading a team id through ~370 query sites: a team simply
 * IS a workspace, and membership decides which ones you may act in.
 *
 * No header → the user's own workspace, exactly as before teams existed. Every
 * pre-existing endpoint, page and test therefore behaves identically, and teams
 * are purely additive.
 *
 * A header naming a workspace the user is not an active member of is rejected
 * rather than silently falling back, because silently serving someone their own
 * data when they asked for a team's is how cross-tenant bugs get missed.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const resolveActiveWorkspace = async (req, user) => {
  const requested = String(req.get(WORKSPACE_HEADER) || '').trim();

  if (!requested || requested === String(user.workspaceId)) {
    /* `homeWorkspaceId`: this IS the caller's own workspace, so they hold every
       permission in it even if it predates ownerId and TeamMembership. */
    const context = await resolveTeamContext({
      userId: user._id,
      workspaceId: user.workspaceId,
      homeWorkspaceId: user.workspaceId
    });
    return { workspaceId: user.workspaceId, team: context, denied: false };
  }

  /*
   * A coded refusal, because the client has to be able to tell "this workspace is
   * not yours" apart from a genuine authorisation failure. A stale id in browser
   * storage — a team you were removed from, or the previous account's — otherwise
   * breaks every request, and the shell reads that as a dead session and bounces
   * you to the login page.
   */
  if (!/^[a-f\d]{24}$/i.test(requested)) {
    return { denied: true, code: 'WORKSPACE_ACCESS_DENIED', message: 'The requested workspace id is not valid.' };
  }

  const context = await resolveTeamContext({
    userId: user._id,
    workspaceId: requested,
    homeWorkspaceId: user.workspaceId
  });
  if (!context) {
    return { denied: true, code: 'WORKSPACE_ACCESS_DENIED', message: 'You are not an active member of that team.' };
  }

  return { workspaceId: context.workspaceId, team: context, denied: false };
};

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.get('Authorization') || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      console.log(`[AUTH FAILED] Missing token on ${req.method} ${req.originalUrl}`);
      return res.status(401).json({ message: 'Authentication token is required.' });
    }

    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.sub);

    if (!user) {
      return res.status(401).json({ message: 'Authentication token is invalid.' });
    }

    const roles = normalizeRoles(user.roles, user.role);
    user.roles = roles;
    user.role = primaryRole(roles);

    /* The account's own workspace, before any team switch is applied. */
    const personalWorkspaceId = user.workspaceId;
    const active = await resolveActiveWorkspace(req, user);
    if (active.denied) {
      return res.status(403).json({ message: active.message, code: active.code });
    }

    /*
     * Reassigning user.workspaceId is deliberate: every service reads scope from
     * it, so the switch lands everywhere at once. The document is never saved
     * after this point in the request, so nothing is persisted.
     */
    user.workspaceId = active.workspaceId;
    /*
     * Carried alongside so services that must ignore the team switch can find it
     * — marketplace statistics in particular, which are always a creator's own
     * reach and must not become the team's just because they were browsing
     * circulars while switched into it.
     */
    user.personalWorkspaceId = personalWorkspaceId;

    req.user = user;
    req.personalWorkspaceId = personalWorkspaceId;
    req.team = active.team;
    req.auth = {
      userId: user._id,
      workspaceId: active.workspaceId,
      personalWorkspaceId,
      role: user.role,
      roles,
      teamPermissions: active.team?.permissions || []
    };

    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Authentication token is invalid or expired.' });
    }

    return next(error);
  }
};
