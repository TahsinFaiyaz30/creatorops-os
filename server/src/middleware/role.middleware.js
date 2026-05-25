export const requireRole = roles => (req, res, next) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  if (!req.user) {
    return res.status(401).json({ message: 'Authentication is required.' });
  }

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Forbidden: insufficient role.' });
  }

  return next();
};

export const requireCreatorAdmin = requireRole(['creator_admin']);
