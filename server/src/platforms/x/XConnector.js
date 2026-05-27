import fs from 'fs/promises';

import env from '../../config/env.js';
import BasePlatformConnector, { connectorResult, okResult } from '../BasePlatformConnector.js';

const normalizeXResult = result => {
  if (result.ok) return result;

  if (result.code === 'HTTP_402' || result.data?.status === 402) {
    return connectorResult({
      code: 'PAYMENT_REQUIRED',
      message:
        'X API rejected this publish request with HTTP 402. Your X developer app needs API credits/billing access for write operations before CreatorOps can publish this post.',
      data: result.data
    });
  }

  return result;
};

export default class XConnector extends BasePlatformConnector {
  constructor() {
    super('x', 'X');
  }

  getRequiredEnv() {
    return ['X_CLIENT_ID', 'X_CLIENT_SECRET'];
  }

  getRequiredScopes() {
    return ['tweet.read', 'tweet.write', 'users.read', 'offline.access', 'media.write'];
  }

  getCapabilities() {
    return { publish: true, schedule: true, analytics: false, comments: false, replies: true, mediaUpload: true };
  }

  getHelperText() {
    return 'Connect X account';
  }

  parseProviderLimitBytes(result) {
    const text = [
      result?.message,
      result?.data?.payload?.detail,
      result?.data?.payload?.title,
      ...(Array.isArray(result?.data?.payload?.errors) ? result.data.payload.errors.map(error => error.detail || error.title || '') : [])
    ].filter(Boolean).join(' ');
    const match = text.match(/(?:max(?:imum)?|limit)[^\d]*(\d+(?:\.\d+)?)\s*(gb|mb|kb|bytes?)/i);
    if (!match) return null;

    const value = Number(match[1]);
    const unit = match[2].toLowerCase();
    if (unit.startsWith('gb')) return Math.floor(value * 1024 * 1024 * 1024);
    if (unit.startsWith('mb')) return Math.floor(value * 1024 * 1024);
    if (unit.startsWith('kb')) return Math.floor(value * 1024);
    return Math.floor(value);
  }

  getMediaCategory(item) {
    if (item.mediaType === 'video') return 'tweet_video';
    if (item.mimeType === 'image/gif') return 'tweet_gif';
    return 'tweet_image';
  }

  async preflightMediaItem(item, connection) {
    if (!['image', 'video'].includes(item.mediaType)) {
      return {
        mediaAssetId: item.mediaAssetId,
        originalName: item.originalName,
        mediaType: item.mediaType,
        size: item.size,
        accepted: false,
        tooLarge: false,
        compressionAvailable: false,
        message: 'Unsupported media type for X.'
      };
    }

    if (item.mediaType === 'video') {
      return {
        mediaAssetId: item.mediaAssetId,
        originalName: item.originalName,
        mediaType: item.mediaType,
        size: item.size,
        accepted: false,
        tooLarge: false,
        compressionAvailable: false,
        message: 'X video upload is not enabled in this connector.'
      };
    }

    const result = await this.requestJson('https://api.x.com/2/media/upload/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.getAccessToken(connection)}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        media_category: this.getMediaCategory(item),
        media_type: item.mimeType,
        total_bytes: Number(item.size || 0)
      })
    });
    const normalized = normalizeXResult(result);

    if (normalized.ok) {
      return {
        mediaAssetId: item.mediaAssetId,
        originalName: item.originalName,
        mediaType: item.mediaType,
        mimeType: item.mimeType,
        size: item.size,
        accepted: true,
        tooLarge: false,
        maxBytes: null,
        providerAcceptedBytes: normalized.data?.data?.size || item.size,
        providerSessionExpiresInSeconds: normalized.data?.data?.expires_after_secs || null,
        compressionAvailable: true,
        message: 'X provider API accepted this media size for upload initialization.'
      };
    }

    if (this.isFileTooLargeResult(normalized)) {
      const maxBytes = this.parseProviderLimitBytes(normalized);
      return {
        mediaAssetId: item.mediaAssetId,
        originalName: item.originalName,
        mediaType: item.mediaType,
        mimeType: item.mimeType,
        size: item.size,
        accepted: false,
        tooLarge: true,
        maxBytes,
        exactMaxBytesKnown: Boolean(maxBytes),
        compressionAvailable: Boolean(maxBytes),
        message: normalized.message || 'X provider API reported this media is too large.'
      };
    }

    return {
      mediaAssetId: item.mediaAssetId,
      originalName: item.originalName,
      mediaType: item.mediaType,
      mimeType: item.mimeType,
      size: item.size,
      accepted: false,
      tooLarge: false,
      maxBytes: null,
      compressionAvailable: false,
      message: normalized.message || 'X provider API could not preflight this media.'
    };
  }

  async getMediaUploadPolicy({ connection, mediaItems = [] } = {}) {
    const mediaChecks = [];
    for (const item of mediaItems) {
      mediaChecks.push(await this.preflightMediaItem(item, connection));
    }

    const oversizedMedia = mediaChecks.filter(item => item.tooLarge);
    const compressibleOversizedMedia = oversizedMedia.filter(item => item.compressionAvailable && item.maxBytes);
    return okResult({
      platform: this.platform,
      displayName: this.displayName,
      source: 'provider_api_preflight',
      policyAvailable: true,
      compressionSupported: compressibleOversizedMedia.length > 0,
      promptForCompression: compressibleOversizedMedia.length > 0,
      mediaChecks,
      oversizedMedia,
      prompts: compressibleOversizedMedia.map(item => ({
        mediaAssetId: item.mediaAssetId,
        mediaType: item.mediaType,
        mediaName: item.originalName,
        currentBytes: item.size,
        maxBytes: item.maxBytes,
        reason: `${item.originalName} exceeds the exact max size returned by the X provider API.`
      }))
    }, 'X media size was checked with the provider upload initialization API.');
  }

  isConfigured() {
    return Boolean(env.oauth.x.clientId && env.oauth.x.clientSecret);
  }

  getAuthorizationUrl({ state, redirectUri, codeChallenge }) {
    if (!this.isConfigured()) return super.getAuthorizationUrl();
    const url = new URL('https://x.com/i/oauth2/authorize');
    url.searchParams.set('client_id', env.oauth.x.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', this.getRequiredScopes().join(' '));
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return okResult({ authorizationUrl: url.toString() }, 'Redirect to X OAuth.');
  }

  async exchangeCodeForToken({ code, redirectUri, codeVerifier }) {
    const body = new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: env.oauth.x.clientId,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    });
    const basic = Buffer.from(`${env.oauth.x.clientId}:${env.oauth.x.clientSecret}`).toString('base64');
    const result = await this.requestJson('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    });
    if (!result.ok) return result;
    return okResult({
      accessToken: result.data.access_token,
      refreshToken: result.data.refresh_token,
      expiresIn: result.data.expires_in,
      scopes: String(result.data.scope || '').split(/\s+/).filter(Boolean)
    });
  }

  async refreshToken(connection) {
    const refreshToken = this.getRefreshToken(connection);
    if (!refreshToken) {
      return connectorResult({ code: 'INVALID_CREDENTIALS', message: 'No stored X refresh token was found. Reconnect this account.' });
    }

    const body = new URLSearchParams({
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      client_id: env.oauth.x.clientId
    });
    const basic = Buffer.from(`${env.oauth.x.clientId}:${env.oauth.x.clientSecret}`).toString('base64');
    const result = await this.requestJson('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    });
    if (!result.ok) return result;
    return okResult({
      accessToken: result.data.access_token,
      refreshToken: result.data.refresh_token || refreshToken,
      expiresIn: result.data.expires_in,
      scopes: String(result.data.scope || connection.scopes?.join(' ') || '').split(/\s+/).filter(Boolean)
    }, 'X access token refreshed.');
  }

  async fetchAccountProfileFromToken(tokenData) {
    const result = await this.requestJson('https://api.x.com/2/users/me?user.fields=username,name', {
      headers: { Authorization: `Bearer ${tokenData.accessToken}` }
    });
    if (!result.ok) return result;
    const user = result.data?.data;
    return okResult({
      accountName: user?.name || 'X Account',
      accountHandle: user?.username ? `@${user.username}` : user?.id || '',
      externalAccountId: user?.id || '',
      accountType: 'profile',
      scopes: tokenData.scopes
    });
  }

  async healthCheck(connection) {
    const base = await super.healthCheck(connection);
    if (base.code !== 'CAPABILITY_UNAVAILABLE') return base;

    const token = this.getAccessToken(connection);
    if (!token) {
      return connectorResult({ code: 'INVALID_CREDENTIALS', message: 'No stored X access token was found. Reconnect this account.' });
    }

    const result = await this.requestJson('https://api.x.com/2/users/me?user.fields=username,name', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!result.ok) return normalizeXResult(result);
    return okResult({ account: result.data?.data || null }, 'X token verified through the X API.');
  }

  validatePublishPayload(payload, connection) {
    const base = super.validatePublishPayload(payload, connection);
    if (!base.ok) return base;
    if (!payload.caption) return connectorResult({ code: 'VALIDATION_FAILED', message: 'X publishing requires post text.' });
    if (payload.caption.length > 280) return connectorResult({ code: 'VALIDATION_FAILED', message: 'X post text exceeds 280 characters.' });
    if (!connection.scopes?.includes('tweet.write')) {
      return connectorResult({ code: 'MISSING_PERMISSIONS', message: 'Missing X tweet.write scope.' });
    }
    const mediaAssets = payload.mediaAssets || [];
      if (mediaAssets.length > 0) {
      if (!connection.scopes?.includes('media.write')) {
        return connectorResult({
          code: 'MISSING_PERMISSIONS',
          message: 'X image publishing requires the media.write OAuth scope. Reconnect the X account after adding media.write to the app permissions.'
        });
      }
      const videoAsset = mediaAssets.find(asset => asset.mediaType === 'video');
      if (videoAsset) {
        return connectorResult({
          code: 'CAPABILITY_UNAVAILABLE',
          message: 'X video upload requires chunked media upload and is not enabled in this connector yet. Use image or text-only posting.'
        });
      }
      const unsupported = mediaAssets.find(asset => asset.mediaType !== 'image' || !asset.mimeType?.startsWith('image/'));
      if (unsupported) {
        return connectorResult({ code: 'VALIDATION_FAILED', message: 'X media upload currently accepts image assets only.' });
      }
    }
    return okResult({}, 'X payload is publishable.');
  }

  async uploadImageMedia(asset, token, payload) {
    if (!asset.localPath) {
      return connectorResult({ code: 'VALIDATION_FAILED', message: 'X media upload requires the stored local image file.' });
    }

    const controlBeforeRead = await this.checkPublishControl(payload);
    if (controlBeforeRead) return controlBeforeRead;
    const fileBuffer = await fs.readFile(asset.localPath);
    const controlBeforeUpload = await this.checkPublishControl(payload);
    if (controlBeforeUpload) return controlBeforeUpload;
    const mediaCategory = asset.mimeType === 'image/gif' ? 'tweet_gif' : 'tweet_image';
    const result = await this.requestJson('https://api.x.com/2/media/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        media: fileBuffer.toString('base64'),
        media_category: mediaCategory,
        media_type: asset.mimeType
      }),
      signal: payload.abortSignal
    });

    const normalized = normalizeXResult(result);
    if (!normalized.ok && this.isFileTooLargeResult(normalized)) {
      return connectorResult({
        code: 'FILE_TOO_LARGE',
        message: `X rejected ${asset.originalName || 'media'} because the provider API says the file is too large.`,
        data: normalized.data
      });
    }
    if (!normalized.ok) return normalized;
    const mediaId = normalized.data?.data?.id || normalized.data?.data?.media_id || '';
    if (!mediaId) {
      return connectorResult({ code: 'PROVIDER_RESPONSE_INVALID', message: 'X media upload succeeded but did not return a media id.' });
    }

    return okResult({ mediaId, rawResponse: normalized.data }, 'X image uploaded through the official media API.');
  }

  async publish(payload, connection) {
    const validation = this.validatePublishPayload(payload, connection);
    if (!validation.ok) return validation;
    const token = this.getAccessToken(connection);
    const mediaIds = [];
    const mediaUploadResponses = [];

    for (const asset of payload.mediaAssets || []) {
      const uploadResult = await this.uploadImageMedia(asset, token, payload);
      if (!uploadResult.ok) return uploadResult;
      mediaIds.push(uploadResult.data.mediaId);
      mediaUploadResponses.push(uploadResult.data.rawResponse);
    }

    const tweetPayload = { text: payload.caption };
    if (mediaIds.length > 0) {
      tweetPayload.media = { media_ids: mediaIds };
    }

    const controlBeforeTweet = await this.checkPublishControl(payload);
    if (controlBeforeTweet) return controlBeforeTweet;
    const result = await this.requestJson('https://api.x.com/2/tweets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tweetPayload),
      signal: payload.abortSignal
    });
    const normalized = normalizeXResult(result);
    if (!normalized.ok) return normalized;
    const id = normalized.data?.data?.id || '';
    return okResult({
      providerPostId: id,
      providerPostUrl: id ? `https://x.com/i/web/status/${id}` : '',
      rawResponse: {
        tweet: normalized.data,
        mediaUploads: mediaUploadResponses
      }
    }, mediaIds.length > 0 ? 'X post with image media published through the official API.' : 'X post published through the official API.');
  }
}
