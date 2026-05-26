import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

import env from '../config/env.js';
import { CONTENT_CREATOR_ROLE, USER_ROLES, normalizeRole } from '../constants/roles.js';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeEmail = email => String(email || '').trim().toLowerCase();

const sanitizeUser = user => {
  const json = user.toJSON();
  return {
    id: json._id.toString(),
    name: json.name,
    email: json.email,
    role: normalizeRole(json.role),
    workspaceId: json.workspaceId.toString(),
    createdAt: json.createdAt,
    updatedAt: json.updatedAt
  };
};

const signToken = user => {
  if (!env.jwtSecret) {
    throw createHttpError('JWT_SECRET is not configured.', 500);
  }

  return jwt.sign(
    {
      sub: user._id.toString(),
      role: normalizeRole(user.role),
      workspaceId: user.workspaceId.toString()
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
};

export const registerUser = async input => {
  const name = String(input.name || '').trim();
  const email = normalizeEmail(input.email);
  const password = String(input.password || '');
  const role = normalizeRole(input.role || CONTENT_CREATOR_ROLE);

  if (!name || !email || !password) {
    throw createHttpError('Name, email, and password are required.', 400);
  }

  if (!USER_ROLES.includes(role)) {
    throw createHttpError('Invalid role.', 400);
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw createHttpError('A user with this email already exists.', 409);
  }

  const userId = new mongoose.Types.ObjectId();
  const workspaceId = new mongoose.Types.ObjectId();

  await Workspace.create({
    _id: workspaceId,
    name: input.workspaceName || `${name}'s Workspace`,
    ownerId: userId
  });

  const user = await User.create({
    _id: userId,
    name,
    email,
    passwordHash: password,
    role,
    workspaceId
  });

  return {
    user: sanitizeUser(user),
    token: signToken(user)
  };
};

export const loginUser = async input => {
  const email = normalizeEmail(input.email);
  const password = String(input.password || '');

  if (!email || !password) {
    throw createHttpError('Email and password are required.', 400);
  }

  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) {
    throw createHttpError('Invalid email or password.', 401);
  }

  const passwordMatches = await user.comparePassword(password);
  if (!passwordMatches) {
    throw createHttpError('Invalid email or password.', 401);
  }

  return {
    user: sanitizeUser(user),
    token: signToken(user)
  };
};

export const getCurrentUser = user => ({
  user: sanitizeUser(user)
});
