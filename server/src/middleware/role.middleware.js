import { ADMIN_ROLE, CONTENT_CREATOR_ROLE, roleMatches } from '../constants/roles.js';

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
