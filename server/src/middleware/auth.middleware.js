import jwt from 'jsonwebtoken';

import env from '../config/env.js';
import { normalizeRoles, primaryRole } from '../constants/roles.js';
import User from '../models/User.js';

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
    req.user = user;
    req.auth = {
      userId: user._id,
      workspaceId: user.workspaceId,
      role: user.role,
      roles
    };

    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Authentication token is invalid or expired.' });
    }

    return next(error);
  }
};
