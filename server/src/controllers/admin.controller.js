import mongoose from 'mongoose';

import { USER_ROLES, normalizeRoles, primaryRole } from '../constants/roles.js';
import User from '../models/User.js';

const serializeUser = user => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: primaryRole(user.roles, user.role),
  roles: normalizeRoles(user.roles, user.role),
  workspaceId: user.workspaceId.toString(),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

const parseRequestedRoles = input => {
  const requestedRoles = Array.isArray(input.roles) ? input.roles : [input.role].filter(Boolean);
  const uniqueRoles = [...new Set(requestedRoles)];

  if (uniqueRoles.length === 0 || uniqueRoles.some(role => !USER_ROLES.includes(role))) {
    const error = new Error('A valid roles array is required.');
    error.statusCode = 400;
    throw error;
  }

  return uniqueRoles;
};

export const listAdminUsers = async (_req, res, next) => {
  try {
    const users = await User.find({}).sort({ email: 1 });
    res.json({ data: { users: users.map(serializeUser), availableRoles: USER_ROLES } });
  } catch (error) {
    next(error);
  }
};

export const updateAdminUserRoles = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const roles = parseRequestedRoles(req.body);
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    user.roles = normalizeRoles(roles);
    user.role = primaryRole(user.roles);
    await user.save();

    return res.json({ data: { user: serializeUser(user) } });
  } catch (error) {
    return next(error);
  }
};
