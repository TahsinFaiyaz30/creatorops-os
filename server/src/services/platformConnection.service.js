import PlatformConnection from '../models/PlatformConnection.js';
import env from '../config/env.js';
import User from '../models/User.js';
import { SUPPORTED_PLATFORMS, normalizePlatform } from '../constants/platforms.js';
import { getConnector, listConnectors } from '../platforms/connectorRegistry.js';
import { assertEncryptionConfigured, encryptSecret } from './encryption.service.js';
import {
  consumeOAuthState,
  createCodeChallenge,
  createCodeVerifier,
  createOAuthState
} from './oauthState.service.js';

const createHttpError = (message, statusCode, code = '') => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
};

const requireCreatorAdmin = user => {
  // Allowed for all roles now per requirements
};

const GOOGLE_POWERED_PLATFORMS = ['youtube', 'youtube_shorts'];

const resolveRequestedPlatform = rawPlatform => {
  const platform = normalizePlatform(rawPlatform);
  if (platform === 'google') return 'youtube';
  return platform;
};

export const getStoragePlatform = platform => {
  const normalized = resolveRequestedPlatform(platform);
  return normalized;
};

export const getConnectionPlatformsForQuery = platform => {
  const normalized = resolveRequestedPlatform(platform);
  return [normalized];
};

const getCallbackUrl = platform => {
  const redirectUriByPlatform = {
    facebook: env.oauth.facebook.redirectUri,
    instagram: env.oauth.instagram.redirectUri,
    tiktok: env.oauth.tiktok.redirectUri,
    youtube: env.oauth.google.redirectUri,
    youtube_shorts: env.oauth.google.redirectUri,
    threads: env.oauth.threads.redirectUri,
    linkedin: env.oauth.linkedin.redirectUri,
    x: env.oauth.x.redirectUri,
    pinterest: env.oauth.pinterest.redirectUri,
    shopify: env.oauth.shopify.redirectUri
  };

  return redirectUriByPlatform[platform] || '';
};

const getSafeReturnUrl = returnUrl => {
  if (!returnUrl) return env.clientUrl;

  try {
    const candidate = new URL(returnUrl);
    return env.clientUrls.includes(candidate.origin) ? candidate.origin : env.clientUrl;
  } catch (_error) {
    return env.clientUrl;
  }
};

const getSafeErrorMessage = result => result?.message || 'Platform request failed.';

const logOAuthCallback = state => {
  console.info(
    '[oauth.callback]',
    JSON.stringify({
      platform: state.platform,
      callbackPlatform: state.callbackPlatform,
      stateValid: Boolean(state.stateValid),
      userWorkspaceRecovered: Boolean(state.userWorkspaceRecovered),
      codeExists: Boolean(state.codeExists),
      tokenExchangeSuccess: Boolean(state.tokenExchangeSuccess),
      profileFetchSuccess: Boolean(state.profileFetchSuccess),
      connectionSaveSuccess: Boolean(state.connectionSaveSuccess),
      savedConnectionId: state.savedConnectionId || '',
      redirectTarget: state.redirectTarget || ''
    })
  );
};

const attachReturnUrl = (error, returnUrl) => {
  if (returnUrl) error.returnUrl = returnUrl;
  return error;
};

export const sanitizeConnection = connection => {
  if (!connection) return null;
  const obj = typeof connection.toObject === 'function' ? connection.toObject() : connection;
  const {
    encryptedAccessToken,
    encryptedRefreshToken,
    encryptedApiSecret,
    encryptedAppPassword,
    ...safe
  } = obj;
  const connector = getConnector(safe.platform);
  const requiredScopes = connector?.getRequiredScopes?.() || [];
  const grantedScopes = new Set(safe.scopes || []);
  const missingScopes = requiredScopes.filter(scope => !grantedScopes.has(scope));
  return {
    ...safe,
    requiredScopes,
    missingScopes,
    hasRequiredScopes: missingScopes.length === 0
  };
};

export const sanitizeConnections = connections => connections.map(sanitizeConnection);

export const listPlatformConnections = async ({ user, query = {} }) => {
  const filter = { workspaceId: user.workspaceId };
  if (query.platform) filter.platform = { $in: getConnectionPlatformsForQuery(query.platform) };
  if (query.status) filter.status = query.status;
  const connections = await PlatformConnection.find(filter).sort({ platform: 1, accountName: 1 });
  return sanitizeConnections(connections);
};

export const getPlatformConnectionById = async ({ user, connectionId, includeSecrets = false }) => {
  let query = PlatformConnection.findOne({
    _id: connectionId,
    workspaceId: user.workspaceId
  });

  if (includeSecrets) {
    query = query.select('+encryptedAccessToken +encryptedRefreshToken +encryptedApiSecret +encryptedAppPassword');
  }

  const connection = await query;

  if (!connection) {
    throw createHttpError('Platform connection not found.', 404);
  }

  return connection;
};

const buildCapabilities = connector => connector.getCapabilities();

export const getConnectionStatus = async ({ user }) => {
  const connections = await PlatformConnection.find({ workspaceId: user.workspaceId });
  const safeConnections = sanitizeConnections(connections);
  return listConnectors().map(meta => {
    const connectionPlatforms = getConnectionPlatformsForQuery(meta.platform);
    const relatedConnections = safeConnections.filter(connection => connectionPlatforms.includes(connection.platform));
    const missingEnvNames = meta.requiredEnv.filter(key => !process.env[key]);
    const connectAllowedForCurrentUser =
      meta.configured && missingEnvNames.length === 0 && Boolean(env.encryptionKey);
    const blockedReason =
      missingEnvNames.length > 0
        ? `Missing server credentials: ${missingEnvNames.join(', ')}`
        : !env.encryptionKey
          ? 'Server encryption is not configured.'
          : '';

    return {
      ...meta,
      missingEnvNames,
      callbackUrl: getCallbackUrl(meta.platform),
      connectedCount: relatedConnections.filter(connection => connection.status === 'connected').length,
      connectAllowedForCurrentUser,
      blockedReason,
      connections: relatedConnections
    };
  });
};

export const getConnectionCapabilities = async () => listConnectors();

const connectionPayloadFromProfile = ({ user, platform, connector, profileData, tokenData }) => ({
  workspaceId: user.workspaceId,
  platform: getStoragePlatform(platform),
  connectionMode:
    platform === 'wordpress' ? 'app_password' : platform === 'shopify' ? 'admin_token' : 'oauth',
  accountName: profileData.accountName || connector.getDisplayName(),
  accountHandle: profileData.accountHandle || profileData.externalAccountId || '',
  externalAccountId:
    profileData.externalAccountId ||
    `${getStoragePlatform(platform)}:${user.workspaceId}:${profileData.accountHandle || profileData.accountName || 'unknown'}`,
  accountType: profileData.accountType || 'profile',
  status: profileData.status || 'connected',
  scopes: profileData.scopes || tokenData.scopes || [],
  missingScopes: profileData.missingScopes || [],
  tokenExpiresAt: tokenData.expiresIn ? new Date(Date.now() + Number(tokenData.expiresIn) * 1000) : null,
  encryptedAccessToken: encryptSecret(profileData.accessToken || tokenData.accessToken || ''),
  encryptedRefreshToken: encryptSecret(profileData.refreshToken || tokenData.refreshToken || ''),
  encryptedApiSecret: encryptSecret(profileData.apiSecret || tokenData.apiSecret || ''),
  encryptedAppPassword: encryptSecret(profileData.appPassword || tokenData.appPassword || ''),
  platformMetadata: profileData.platformMetadata || {},
  capabilities: buildCapabilities(connector),
  lastHealthCheckAt: new Date(),
  lastErrorCode: profileData.lastErrorCode || '',
  lastErrorMessage: profileData.lastErrorMessage || '',
  createdBy: user._id,
  updatedBy: user._id
});

export const upsertConnectionFromProfile = async ({ user, platform, connector, profileData, tokenData = {} }) => {
  const payload = connectionPayloadFromProfile({ user, platform, connector, profileData, tokenData });
  const { createdBy, ...updatePayload } = payload;

  const connection = await PlatformConnection.findOneAndUpdate(
    {
      workspaceId: user.workspaceId,
      platform: payload.platform,
      externalAccountId: payload.externalAccountId
    },
    {
      $set: updatePayload,
      $setOnInsert: { createdBy }
    },
    { new: true, upsert: true }
  );

  return sanitizeConnection(connection);
};

export const startPlatformOAuth = async ({ user, platform: rawPlatform, returnUrl = '' }) => {
  requireCreatorAdmin(user);

  const platform = resolveRequestedPlatform(rawPlatform);
  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    throw createHttpError('Unsupported platform.', 404);
  }

  const connector = getConnector(platform);
  if (!connector) {
    throw createHttpError('No connector is registered for this platform.', 404);
  }

  if (typeof connector.createConnectionFromEnv === 'function') {
    if (!connector.isConfigured()) {
      throw createHttpError(`${connector.getDisplayName()} server credentials are not configured.`, 400, 'NOT_CONFIGURED');
    }
    assertEncryptionConfigured();
    const result = await connector.createConnectionFromEnv();
    if (!result.ok) {
      throw createHttpError(result.message, 400, result.code);
    }
    const connection = await upsertConnectionFromProfile({
      user,
      platform,
      connector,
      profileData: result.data,
      tokenData: result.data
    });
    return { connection, message: result.message };
  }

  if (!connector.isConfigured()) {
    throw createHttpError(`${connector.getDisplayName()} server OAuth credentials are not configured.`, 400, 'NOT_CONFIGURED');
  }

  assertEncryptionConfigured();

  const finalRedirectUri = getCallbackUrl(platform);
  const codeVerifier = platform === 'x' ? createCodeVerifier() : '';
  const state = await createOAuthState({
    user,
    platform,
    redirectUri: finalRedirectUri,
    returnUrl: getSafeReturnUrl(returnUrl),
    codeVerifier
  });
  const authResult = connector.getAuthorizationUrl({
    state,
    redirectUri: finalRedirectUri,
    codeChallenge: codeVerifier ? createCodeChallenge(codeVerifier) : ''
  });

  if (!authResult.ok) {
    throw createHttpError(authResult.message, 400, authResult.code);
  }

  return {
    authorizationUrl: authResult.data.authorizationUrl,
    message: authResult.message
  };
};

export const disconnectConnection = async ({ user, connectionId }) => {
  requireCreatorAdmin(user);
  const connection = await getPlatformConnectionById({ user, connectionId });
  connection.status = 'disconnected';
  connection.updatedBy = user._id;
  await connection.save();
  return sanitizeConnection(connection);
};

export const deleteConnection = async ({ user, connectionId }) => {
  requireCreatorAdmin(user);
  const connection = await getPlatformConnectionById({ user, connectionId });
  await connection.deleteOne();
  return sanitizeConnection(connection);
};

export const healthCheckConnection = async ({ user, connectionId }) => {
  requireCreatorAdmin(user);
  const connection = await getPlatformConnectionById({ user, connectionId, includeSecrets: true });
  const connector = getConnector(connection.platform);
  const result = await connector.healthCheck(connection);
  connection.lastHealthCheckAt = new Date();
  connection.lastErrorCode = result.ok ? '' : result.code;
  connection.lastErrorMessage = result.ok ? '' : result.message;
  if (!result.ok && ['MISSING_PERMISSIONS', 'EXPIRED', 'BLOCKED'].includes(result.code)) {
    connection.status = result.code.toLowerCase();
  }
  await connection.save();
  return { connection: sanitizeConnection(connection), result };
};

export const refreshConnection = async ({ user, connectionId }) => {
  requireCreatorAdmin(user);
  assertEncryptionConfigured();
  const connection = await getPlatformConnectionById({ user, connectionId, includeSecrets: true });
  const connector = getConnector(connection.platform);
  const result = await connector.refreshToken(connection);
  if (!result.ok) {
    connection.lastErrorCode = result.code;
    connection.lastErrorMessage = result.message;
    await connection.save();
    throw createHttpError(result.message, 400, result.code);
  }
  if (result.data.accessToken) connection.encryptedAccessToken = encryptSecret(result.data.accessToken);
  if (result.data.refreshToken) connection.encryptedRefreshToken = encryptSecret(result.data.refreshToken);
  if (result.data.expiresIn) connection.tokenExpiresAt = new Date(Date.now() + Number(result.data.expiresIn) * 1000);
  connection.status = 'connected';
  connection.updatedBy = user._id;
  await connection.save();
  return sanitizeConnection(connection);
};

export const completeOAuthCallback = async ({ platform: rawPlatform, code, state }) => {
  assertEncryptionConfigured();

  const debugState = {
    platform: '',
    callbackPlatform: rawPlatform || '',
    stateValid: false,
    userWorkspaceRecovered: false,
    codeExists: Boolean(code),
    tokenExchangeSuccess: false,
    profileFetchSuccess: false,
    connectionSaveSuccess: false,
    savedConnectionId: '',
    redirectTarget: ''
  };

  let oauthState;
  try {
    oauthState = await consumeOAuthState(state);
    debugState.stateValid = true;
    debugState.platform = oauthState.platform;
  } catch (error) {
    logOAuthCallback(debugState);
    throw error;
  }

  const callbackPlatform = normalizePlatform(rawPlatform || oauthState.platform);
  const platform = ['google', 'meta'].includes(callbackPlatform) ? oauthState.platform : resolveRequestedPlatform(callbackPlatform);
  debugState.callbackPlatform = callbackPlatform;
  debugState.redirectTarget = getSafeReturnUrl(oauthState.returnUrl);

  if (platform !== oauthState.platform) {
    logOAuthCallback(debugState);
    throw attachReturnUrl(createHttpError('OAuth callback platform does not match stored state.', 400), debugState.redirectTarget);
  }

  const user = await User.findOne({
    _id: oauthState.userId,
    workspaceId: oauthState.workspaceId
  });

  if (!user) {
    logOAuthCallback(debugState);
    throw attachReturnUrl(createHttpError('OAuth user context was not found.', 404), debugState.redirectTarget);
  }
  debugState.userWorkspaceRecovered = true;

  const connector = getConnector(platform);
  if (!connector) {
    logOAuthCallback(debugState);
    throw attachReturnUrl(createHttpError('No connector is registered for this platform.', 404), debugState.redirectTarget);
  }

  let tokenResult;
  try {
    tokenResult = await connector.exchangeCodeForToken({
      code,
      redirectUri: oauthState.redirectUri,
      codeVerifier: oauthState.codeVerifier
    });
  } catch (error) {
    logOAuthCallback(debugState);
    throw attachReturnUrl(error, debugState.redirectTarget);
  }

  if (!tokenResult.ok) {
    logOAuthCallback(debugState);
    throw attachReturnUrl(createHttpError(tokenResult.message, 400, tokenResult.code), debugState.redirectTarget);
  }
  debugState.tokenExchangeSuccess = true;

  let profileResult;
  try {
    profileResult =
      typeof connector.fetchAccountProfileFromToken === 'function'
        ? await connector.fetchAccountProfileFromToken(tokenResult.data)
        : await connector.fetchAccountProfile({
            accessToken: tokenResult.data.accessToken
          });
  } catch (error) {
    profileResult = {
      ok: false,
      code: 'PROFILE_FETCH_FAILED',
      message: error.message || 'Profile fetch failed after token exchange.',
      data: {}
    };
  }

  debugState.profileFetchSuccess = Boolean(profileResult.ok);

  const profileData = profileResult.ok
    ? profileResult.data
    : {
        accountName: connector.getDisplayName(),
        accountHandle: getStoragePlatform(platform),
        externalAccountId: `${getStoragePlatform(platform)}:${user.workspaceId}`,
        accountType: getStoragePlatform(platform) === 'youtube' ? 'channel' : 'profile',
        status: 'connected',
        scopes: tokenResult.data.scopes || [],
        missingScopes: profileResult.data?.missingScopes || [],
        lastErrorCode: profileResult.code || 'PROFILE_FETCH_FAILED',
        lastErrorMessage: getSafeErrorMessage(profileResult),
        platformMetadata: {
          profileFetchFailed: true,
          requestedPlatform: platform
        }
      };

  const connection = await upsertConnectionFromProfile({
    user,
    platform,
    connector,
    profileData,
    tokenData: tokenResult.data
  });

  debugState.connectionSaveSuccess = true;
  debugState.savedConnectionId = String(connection._id || connection.id || '');
  logOAuthCallback(debugState);

  return {
    connection,
    returnUrl: debugState.redirectTarget
  };
};
