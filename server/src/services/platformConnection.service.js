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
import { resolveTeamContext } from './teamMembership.service.js';

const createHttpError = (message, statusCode, code = '') => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
};

const GOOGLE_POWERED_PLATFORMS = ['youtube', 'youtube_shorts'];
const CREDENTIAL_ERROR_CODES = new Set([
  '401',
  'HTTP_401',
  'UNAUTHORIZED',
  'INVALID_CREDENTIALS',
  'INVALID_GRANT',
  'INVALID_TOKEN',
  'EXPIRED'
]);

const resolveRequestedPlatform = rawPlatform => {
  const platform = normalizePlatform(rawPlatform);
  if (platform === 'google') return 'youtube';
  return platform;
};

export const getStoragePlatform = platform => {
  const normalized = resolveRequestedPlatform(platform);
  return normalized === 'youtube_shorts' ? 'youtube' : normalized;
};

export const getConnectionPlatformsForQuery = platform => {
  const normalized = resolveRequestedPlatform(platform);
  if (GOOGLE_POWERED_PLATFORMS.includes(normalized)) {
    return ['youtube'];
  }
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

const isCredentialError = result => {
  const code = String(result?.code || '').toUpperCase();
  const message = String(result?.message || '').toLowerCase();

  return (
    CREDENTIAL_ERROR_CODES.has(code) ||
    code.includes('401') ||
    code.includes('INVALID_TOKEN') ||
    code.includes('INVALID_GRANT') ||
    message.includes('invalid authentication') ||
    message.includes('access token') ||
    message.includes('expired token') ||
    message.includes('invalid token') ||
    message.includes('oauth')
  );
};

const statusFromHealthResult = (result, currentStatus) => {
  if (result.ok) return 'connected';
  if (result.code === 'MISSING_PERMISSIONS') return 'missing_permissions';
  if (isCredentialError(result)) return 'expired';
  if (currentStatus === 'disconnected') return 'disconnected';
  return 'error';
};

const applyTokenRefresh = (connection, result) => {
  if (result.data.accessToken) connection.encryptedAccessToken = encryptSecret(result.data.accessToken);
  if (result.data.refreshToken) connection.encryptedRefreshToken = encryptSecret(result.data.refreshToken);
  if (result.data.apiSecret) connection.encryptedApiSecret = encryptSecret(result.data.apiSecret);
  if (result.data.appPassword) connection.encryptedAppPassword = encryptSecret(result.data.appPassword);
  if (result.data.expiresIn) connection.tokenExpiresAt = new Date(Date.now() + Number(result.data.expiresIn) * 1000);
  if (Array.isArray(result.data.scopes) && result.data.scopes.length > 0) connection.scopes = result.data.scopes;
};

export const refreshStoredConnectionIfNeeded = async ({ connection, connector, force = false }) => {
  if (!connection || !connector || connection.status !== 'connected') return { refreshed: false };

  const expiresAt = connection.tokenExpiresAt ? new Date(connection.tokenExpiresAt).getTime() : 0;
  const shouldRefresh = force || (expiresAt > 0 && expiresAt <= Date.now() + 60_000);
  if (!shouldRefresh) return { refreshed: false };

  const result = await connector.refreshToken(connection);
  if (!result.ok) {
    if (result.code === 'CAPABILITY_UNAVAILABLE' && expiresAt > 0 && expiresAt <= Date.now()) {
      return {
        refreshed: false,
        result: {
          ok: false,
          code: 'EXPIRED',
          message: `${connector.getDisplayName()} credentials are expired and cannot be refreshed automatically. Reconnect this account.`,
          data: {}
        }
      };
    }

    return { refreshed: false, result };
  }

  applyTokenRefresh(connection, result);
  connection.status = 'connected';
  connection.lastErrorCode = '';
  connection.lastErrorMessage = '';
  await connection.save();
  return { refreshed: true, result };
};

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * Audience (follower / subscriber) sync.
 *
 * Post metrics arrive per post through SocialMetricSnapshot. Follower counts do
 * not belong to a post, so they are read from the provider's account endpoint
 * and cached on the connection. Every failure path is recorded rather than
 * swallowed: a refused field leaves `followers: null` plus the reason, so a
 * brand reading a creator's mean can tell "no followers" from "not readable".
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const syncConnectionAudience = async ({ connection, connector }) => {
  if (!connection || !connector) return null;

  /*
   * A failed read records why it failed but keeps whatever number was last read
   * successfully. Nulling it would let one provider timeout silently shrink a
   * creator's follower mean, and `syncedAt` already says how stale the figure is.
   */
  const applyFailure = (code, message) => {
    const previous = connection.audience?.toObject?.() || connection.audience || {};
    connection.audience = {
      ...previous,
      source: previous.followers === null || previous.followers === undefined ? 'unavailable' : 'stale',
      unavailableCode: code || 'UNAVAILABLE',
      unavailableReason: message || 'Audience size is unavailable for this connection.'
    };
    return connection.audience;
  };

  if (connection.status !== 'connected') {
    applyFailure('NOT_CONNECTED', `This ${connector.getDisplayName()} account is ${connection.status || 'not connected'}.`);
    await connection.save();
    return connection.audience;
  }

  let result;
  try {
    await refreshStoredConnectionIfNeeded({ connection, connector });
    result = await connector.fetchAudienceMetrics(connection);
  } catch (error) {
    result = { ok: false, code: 'SYNC_FAILED', message: error.message || 'Audience sync failed.' };
  }

  if (!result?.ok) {
    applyFailure(result?.code, result?.message);
  } else {
    const followers = result.data?.followers;
    connection.audience = {
      followers: followers === undefined || followers === null ? null : Number(followers),
      subscribers: result.data?.subscribers === undefined || result.data?.subscribers === null ? null : Number(result.data.subscribers),
      lifetimeViews:
        result.data?.lifetimeViews === undefined || result.data?.lifetimeViews === null ? null : Number(result.data.lifetimeViews),
      source: 'real_sync',
      syncedAt: new Date(),
      unavailableCode: '',
      unavailableReason: ''
    };
  }

  connection.audience.syncedAt = connection.audience.syncedAt || new Date();
  await connection.save();
  return connection.audience;
};

/**
 * Best-effort refresh of every connected account in a workspace, optionally
 * narrowed to a platform list. Never throws — a provider outage must not block
 * whatever the caller is really doing (submitting an application, for example).
 */
export const syncWorkspaceAudience = async ({ workspaceId, platforms = null }) => {
  const filter = { workspaceId, status: 'connected' };
  if (Array.isArray(platforms) && platforms.length > 0) {
    filter.platform = { $in: [...new Set(platforms.flatMap(getConnectionPlatformsForQuery))] };
  }

  const connections = await PlatformConnection.find(filter).select(
    '+encryptedAccessToken +encryptedRefreshToken +encryptedApiSecret +encryptedAppPassword'
  );

  return Promise.all(
    connections.map(async connection => {
      const connector = getConnector(connection.platform);
      try {
        const audience = await syncConnectionAudience({ connection, connector });
        return { platform: connection.platform, connectionId: connection._id, audience };
      } catch (error) {
        return { platform: connection.platform, connectionId: connection._id, error: error.message };
      }
    })
  );
};

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
  const connection = await getPlatformConnectionById({ user, connectionId });
  connection.status = 'disconnected';
  connection.updatedBy = user._id;
  await connection.save();
  return sanitizeConnection(connection);
};

export const deleteConnection = async ({ user, connectionId }) => {
  const connection = await getPlatformConnectionById({ user, connectionId });
  await connection.deleteOne();
  return sanitizeConnection(connection);
};

export const healthCheckConnection = async ({ user, connectionId }) => {
  const connection = await getPlatformConnectionById({ user, connectionId, includeSecrets: true });
  const connector = getConnector(connection.platform);
  let result = await connector.healthCheck(connection);
  let refreshed = false;

  if (!result.ok && isCredentialError(result)) {
    const refreshAttempt = await refreshStoredConnectionIfNeeded({ connection, connector, force: true });
    if (refreshAttempt.result?.ok) {
      refreshed = true;
      result = await connector.healthCheck(connection);
    } else if (refreshAttempt.result?.code !== 'CAPABILITY_UNAVAILABLE') {
      result = refreshAttempt.result;
    }
  }

  connection.lastHealthCheckAt = new Date();
  connection.lastErrorCode = result.ok ? '' : result.code;
  connection.lastErrorMessage = result.ok ? '' : result.message;
  connection.status = statusFromHealthResult(result, connection.status);
  await connection.save();

  /* A verified token is the right moment to re-read the account's follower count. */
  if (result.ok) {
    await syncConnectionAudience({ connection, connector }).catch(() => {});
  }
  return {
    connection: sanitizeConnection(connection),
    result: {
      ...result,
      data: {
        ...(result.data || {}),
        refreshed
      }
    }
  };
};

export const refreshConnection = async ({ user, connectionId }) => {
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
  applyTokenRefresh(connection, result);
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

  /*
   * ───────────────────────────────────────────────────────────────────────────
   * Recover who started this flow, and which workspace they started it in.
   *
   * This used to be one query — `User.findOne({ _id, workspaceId })` — matching
   * the state's workspace against the User document's own. Those are different
   * things: `User.workspaceId` is the account's PERSONAL workspace and never
   * changes, while the state stores whatever workspace the request was acting
   * in, because `auth.middleware` reassigns `user.workspaceId` to the active
   * team for the duration of a request.
   *
   * Inside a team the two therefore disagree, the query matched nothing, and
   * every connection attempt died on "OAuth user context was not found" — which
   * is why this only ever failed for a team, and only for the owner or a member
   * with accounts.manage, since nobody else can reach the button.
   *
   * So: find the user by id, then re-derive the workspace through the same
   * membership check the middleware uses. Re-checking matters because a
   * round-trip to Google is unauthenticated and takes as long as the person
   * takes — they may have been removed from the team in between, and the token
   * must not land in a workspace they no longer belong to.
   * ───────────────────────────────────────────────────────────────────────────
   */
  const user = await User.findById(oauthState.userId);

  if (!user) {
    logOAuthCallback(debugState);
    throw attachReturnUrl(createHttpError('OAuth user context was not found.', 404), debugState.redirectTarget);
  }

  const context = await resolveTeamContext({
    userId: user._id,
    workspaceId: oauthState.workspaceId,
    homeWorkspaceId: user.workspaceId
  });

  if (!context) {
    logOAuthCallback(debugState);
    throw attachReturnUrl(
      createHttpError(
        'You no longer have access to the workspace this connection was started in.',
        403,
        'WORKSPACE_ACCESS_DENIED'
      ),
      debugState.redirectTarget
    );
  }

  /* The connection belongs to the workspace the flow began in, not to whichever
     workspace the User document happens to name. */
  user.workspaceId = context.workspaceId;
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
