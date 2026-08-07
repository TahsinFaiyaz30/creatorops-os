import { ADMIN_ROLE, CONTENT_CREATOR_ROLE, roleMatches } from '../constants/roles.js';

/*
 * Team permissions sit alongside platform roles, not inside them. requireRole
 * answers "what is this account?"; requireTeamPermission answers "what may this
 * account do inside the team it is currently acting in?". Routes that need both
 * chain both, in that order.
 */
export const requireTeamPermission = permission => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication is required.' });
  }

  if (!req.team) {
    return res.status(403).json({ message: 'You are not an active member of this workspace.' });
  }

  if (!req.team.can(permission)) {
    return res.status(403).json({
      message: `Your position in this team does not allow "${permission}".`,
      code: 'TEAM_PERMISSION_DENIED',
      requiredPermission: permission
    });
  }

  return next();
};

/** Passes when the member holds any one of the listed permissions. */
export const requireAnyTeamPermission = permissions => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication is required.' });
  }

  if (!req.team || !permissions.some(permission => req.team.can(permission))) {
    return res.status(403).json({
      message: 'Your position in this team does not allow this action.',
      code: 'TEAM_PERMISSION_DENIED',
      requiredPermission: permissions.join(' | ')
    });
  }

  return next();
};

export const requireRole = roles => (req, res, next) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  if (!req.user) {
    return res.status(401).json({ message: 'Authentication is required.' });
  }

  if (!roleMatches(req.user, allowedRoles)) {
    return res.status(403).json({ message: 'Forbidden: insufficient role.' });
  }

  return next();
};

export const requireContentCreator = requireRole([CONTENT_CREATOR_ROLE]);

export const requireAdmin = requireRole([ADMIN_ROLE]);
