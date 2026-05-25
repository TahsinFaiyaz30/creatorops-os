import fs from 'fs/promises';

import env from '../../config/env.js';
import BasePlatformConnector, { connectorResult, okResult } from '../BasePlatformConnector.js';

const MAX_X_IMAGES = 4;
const MAX_X_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_X_GIF_BYTES = 15 * 1024 * 1024;

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
      if (mediaAssets.length > MAX_X_IMAGES) {
        return connectorResult({ code: 'VALIDATION_FAILED', message: `X supports up to ${MAX_X_IMAGES} images per post in this connector.` });
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
      const oversized = mediaAssets.find(asset => {
        const limit = asset.mimeType === 'image/gif' ? MAX_X_GIF_BYTES : MAX_X_IMAGE_BYTES;
        return asset.size > limit;
      });
      if (oversized) {
        const limitMb = oversized.mimeType === 'image/gif' ? 15 : 5;
        return connectorResult({ code: 'VALIDATION_FAILED', message: `X image upload limit exceeded for ${oversized.originalName}. Limit is ${limitMb} MB.` });
      }
    }
    return okResult({}, 'X payload is publishable.');
  }

  async uploadImageMedia(asset, token) {
    if (!asset.localPath) {
      return connectorResult({ code: 'VALIDATION_FAILED', message: 'X media upload requires the stored local image file.' });
    }

    const fileBuffer = await fs.readFile(asset.localPath);
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
      })
    });

    const normalized = normalizeXResult(result);
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
      const uploadResult = await this.uploadImageMedia(asset, token);
      if (!uploadResult.ok) return uploadResult;
      mediaIds.push(uploadResult.data.mediaId);
      mediaUploadResponses.push(uploadResult.data.rawResponse);
    }

    const tweetPayload = { text: payload.caption };
    if (mediaIds.length > 0) {
      tweetPayload.media = { media_ids: mediaIds };
    }

    const result = await this.requestJson('https://api.x.com/2/tweets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tweetPayload)
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
