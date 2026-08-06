import env from '../../config/env.js';
import BasePlatformConnector, { connectorResult, okResult, unavailableResult } from '../BasePlatformConnector.js';

export default class TikTokConnector extends BasePlatformConnector {
  constructor() {
    super('tiktok', 'TikTok');
  }

  getRequiredEnv() {
    return ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'];
  }

  getRequiredScopes() {
    return ['user.info.basic', 'video.publish', 'video.upload'];
  }

  getCapabilities() {
    return { publish: true, schedule: true, analytics: false, comments: false, replies: false, mediaUpload: true, delete: false };
  }

  getHelperText() {
    return 'Connect TikTok creator account';
  }

  isConfigured() {
    return Boolean(env.oauth.tiktok.clientKey && env.oauth.tiktok.clientSecret);
  }

  getAuthorizationUrl({ state, redirectUri }) {
    if (!this.isConfigured()) return super.getAuthorizationUrl();
    const url = new URL('https://www.tiktok.com/v2/auth/authorize/');
    url.searchParams.set('client_key', env.oauth.tiktok.clientKey);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', this.getRequiredScopes().join(','));
    url.searchParams.set('state', state);
    return okResult({ authorizationUrl: url.toString() }, 'Redirect to TikTok OAuth.');
  }

  async exchangeCodeForToken({ code, redirectUri }) {
    const body = new URLSearchParams({
      client_key: env.oauth.tiktok.clientKey,
      client_secret: env.oauth.tiktok.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    });
    const result = await this.requestJson('https://open.tiktokapis.com/v2/oauth/token/', { method: 'POST', body });
    if (!result.ok) return result;
    return okResult({
      accessToken: result.data.access_token,
      refreshToken: result.data.refresh_token,
      expiresIn: result.data.expires_in,
      scopes: String(result.data.scope || '').split(',').filter(Boolean)
    });
  }

  async refreshToken(connection) {
    const refreshToken = this.getRefreshToken(connection);
    if (!refreshToken) {
      return connectorResult({ code: 'INVALID_CREDENTIALS', message: 'No stored TikTok refresh token was found. Reconnect this account.' });
    }

    const body = new URLSearchParams({
      client_key: env.oauth.tiktok.clientKey,
      client_secret: env.oauth.tiktok.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    });
    const result = await this.requestJson('https://open.tiktokapis.com/v2/oauth/token/', { method: 'POST', body });
    if (!result.ok) return result;
    return okResult({
      accessToken: result.data.access_token,
      refreshToken: result.data.refresh_token || refreshToken,
      expiresIn: result.data.expires_in,
      scopes: String(result.data.scope || connection.scopes?.join(',') || '').split(',').filter(Boolean)
    }, 'TikTok access token refreshed.');
  }

  async fetchAccountProfileFromToken(tokenData) {
    const result = await this.requestJson('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username', {
      headers: { Authorization: `Bearer ${tokenData.accessToken}` }
    });
    if (!result.ok) return result;
    const user = result.data?.data?.user;
    return okResult({
      accountName: user?.display_name || user?.username || 'TikTok Account',
      accountHandle: user?.username ? `@${user.username}` : user?.open_id || '',
      externalAccountId: user?.open_id || '',
      accountType: 'creator',
      scopes: tokenData.scopes,
      platformMetadata: { unionId: user?.union_id, avatarUrl: user?.avatar_url }
    });
  }

  async healthCheck(connection) {
    const base = await super.healthCheck(connection);
    if (base.code !== 'CAPABILITY_UNAVAILABLE') return base;

    const token = this.getAccessToken(connection);
    if (!token) {
      return connectorResult({ code: 'INVALID_CREDENTIALS', message: 'No stored TikTok access token was found. Reconnect this account.' });
    }

    const result = await this.requestJson('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,username', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!result.ok) return result;
    return okResult({ account: result.data?.data?.user || null }, 'TikTok token verified through the TikTok API.');
  }

  getAccountProfileUrl(connection) {
    /* Falls back to open_id when no username was granted, which is not addressable.
       The `@` stays literal; encoding it to %40 breaks the profile route. */
    const handle = String(connection?.accountHandle || '').trim();
    return handle.startsWith('@') ? `https://www.tiktok.com/@${encodeURIComponent(this.stripHandlePrefix(handle))}` : '';
  }

  async fetchAudienceMetrics(connection) {
    const token = this.getAccessToken(connection);
    if (!token) {
      return connectorResult({ code: 'INVALID_CREDENTIALS', message: 'No stored TikTok access token was found. Reconnect this account.' });
    }
    /* follower_count sits behind user.info.stats, which is granted separately from user.info.basic. */
    const result = await this.requestJson('https://open.tiktokapis.com/v2/user/info/?fields=open_id,follower_count,likes_count,video_count', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!result.ok) return result;
    const user = result.data?.data?.user;
    if (!user || user.follower_count === undefined || user.follower_count === null) {
      return unavailableResult('TikTok did not return a follower count. The user.info.stats scope is required and must be granted on reconnect.');
    }
    return okResult({ followers: Number(user.follower_count), raw: user }, 'TikTok follower count read through the TikTok API.');
  }

  validatePublishPayload(payload, connection) {
    const base = super.validatePublishPayload(payload, connection);
    if (!base.ok) return base;
    const mediaAssets = payload.mediaAssets || [];
    const videos = mediaAssets.filter(asset => asset.mediaType === 'video' && asset.publicUrl);
    if (mediaAssets.length !== 1 || videos.length !== 1) {
      return connectorResult({
        code: 'VALIDATION_FAILED',
        message: 'TikTok Content Posting API requires exactly one video media asset with a public URL. CreatorOps will not silently drop extra or unsupported media.'
      });
    }
    if (!connection.scopes?.some(scope => ['video.publish', 'video.upload'].includes(scope))) {
      return connectorResult({
        code: 'PLATFORM_REVIEW_REQUIRED',
        message: 'TikTok video publishing requires Content Posting API access and approved scopes.'
      });
    }
    return okResult({}, 'TikTok payload is publishable when Content Posting API access is approved.');
  }

  async publish(payload, connection) {
    const validation = this.validatePublishPayload(payload, connection);
    if (!validation.ok) return validation;
    const control = await this.checkPublishControl(payload);
    if (control) return control;
    return connectorResult({
      code: 'PLATFORM_REVIEW_REQUIRED',
      message: 'TikTok publishing requires approved Content Posting API product access. The connector will not fake a publish.'
    });
  }
}
