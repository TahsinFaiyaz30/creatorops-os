import crypto from 'crypto';

import OAuthState from '../models/OAuthState.js';

const STATE_TTL_MS = 10 * 60 * 1000;

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const createOAuthState = async ({ user, platform, redirectUri = '', returnUrl = '', codeVerifier = '' }) => {
  const state = crypto.randomBytes(32).toString('base64url');

  await OAuthState.create({
    state,
    workspaceId: user.workspaceId,
    userId: user._id,
    platform,
    redirectUri,
    returnUrl,
    codeVerifier,
    expiresAt: new Date(Date.now() + STATE_TTL_MS)
  });

  return state;
};

export const consumeOAuthState = async state => {
  if (!state) {
    throw createHttpError('OAuth state is required.', 400);
  }

  const oauthState = await OAuthState.findOne({ state });

  if (!oauthState || oauthState.consumedAt) {
    throw createHttpError('OAuth state is invalid or already used.', 400);
  }

  if (oauthState.expiresAt <= new Date()) {
    throw createHttpError('OAuth state expired. Start the connection again.', 400);
  }

  oauthState.consumedAt = new Date();
  await oauthState.save();

  return oauthState;
};

export const getOAuthStateReturnUrl = async state => {
  if (!state) return '';

  const oauthState = await OAuthState.findOne({ state }).select('returnUrl expiresAt consumedAt');
  if (!oauthState || oauthState.consumedAt || oauthState.expiresAt <= new Date()) return '';
  return oauthState.returnUrl || '';
};

export const createCodeVerifier = () => crypto.randomBytes(48).toString('base64url');

export const createCodeChallenge = codeVerifier =>
  crypto.createHash('sha256').update(codeVerifier).digest('base64url');
