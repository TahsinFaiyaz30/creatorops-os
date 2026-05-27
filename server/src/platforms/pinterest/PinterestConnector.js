import env from '../../config/env.js';
import BasePlatformConnector, { connectorResult, okResult } from '../BasePlatformConnector.js';

export default class PinterestConnector extends BasePlatformConnector {
  constructor() {
    super('pinterest', 'Pinterest');
  }

  getRequiredEnv() {
    return ['PINTEREST_CLIENT_ID', 'PINTEREST_CLIENT_SECRET'];
  }

  getRequiredScopes() {
    return ['user_accounts:read', 'boards:read', 'pins:read', 'pins:write'];
  }

  getCapabilities() {
    return { publish: true, schedule: true, analytics: true, comments: false, replies: false, mediaUpload: true };
  }

  getHelperText() {
    return 'Connect Pinterest account/board';
  }

  isConfigured() {
    return Boolean(env.oauth.pinterest.clientId && env.oauth.pinterest.clientSecret);
  }

  getAuthorizationUrl({ state, redirectUri }) {
    if (!this.isConfigured()) return super.getAuthorizationUrl();
    const url = new URL('https://www.pinterest.com/oauth/');
    url.searchParams.set('client_id', env.oauth.pinterest.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', this.getRequiredScopes().join(','));
    url.searchParams.set('state', state);
    return okResult({ authorizationUrl: url.toString() }, 'Redirect to Pinterest OAuth.');
  }

  async exchangeCodeForToken({ code, redirectUri }) {
    const basic = Buffer.from(`${env.oauth.pinterest.clientId}:${env.oauth.pinterest.clientSecret}`).toString('base64');
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri
    });
    const result = await this.requestJson('https://api.pinterest.com/v5/oauth/token', {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}` },
      body
    });
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
      return connectorResult({ code: 'INVALID_CREDENTIALS', message: 'No stored Pinterest refresh token was found. Reconnect this account.' });
    }

    const basic = Buffer.from(`${env.oauth.pinterest.clientId}:${env.oauth.pinterest.clientSecret}`).toString('base64');
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    });
    const result = await this.requestJson('https://api.pinterest.com/v5/oauth/token', {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}` },
      body
    });
    if (!result.ok) return result;
    return okResult({
      accessToken: result.data.access_token,
      refreshToken: result.data.refresh_token || refreshToken,
      expiresIn: result.data.expires_in,
      scopes: String(result.data.scope || connection.scopes?.join(',') || '').split(',').filter(Boolean)
    }, 'Pinterest access token refreshed.');
  }

  async fetchAccountProfileFromToken(tokenData) {
    const result = await this.requestJson('https://api.pinterest.com/v5/user_account', {
      headers: { Authorization: `Bearer ${tokenData.accessToken}` }
    });
    if (!result.ok) return result;
    return okResult({
      accountName: result.data.username || 'Pinterest Account',
      accountHandle: result.data.username || '',
      externalAccountId: result.data.account_type ? result.data.username : result.data.id || result.data.username || '',
      accountType: 'profile',
      scopes: tokenData.scopes,
      platformMetadata: result.data
    });
  }

  async healthCheck(connection) {
    const base = await super.healthCheck(connection);
    if (base.code !== 'CAPABILITY_UNAVAILABLE') return base;

    const token = this.getAccessToken(connection);
    if (!token) {
      return connectorResult({ code: 'INVALID_CREDENTIALS', message: 'No stored Pinterest access token was found. Reconnect this account.' });
    }

    const result = await this.requestJson('https://api.pinterest.com/v5/user_account', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!result.ok) return result;
    return okResult({ account: result.data }, 'Pinterest token verified through the Pinterest API.');
  }

  validatePublishPayload(payload, connection) {
    const base = super.validatePublishPayload(payload, connection);
    if (!base.ok) return base;
    const image = payload.mediaAssets?.find(asset => asset.mediaType === 'image' && asset.publicUrl);
    if (!image) return connectorResult({ code: 'VALIDATION_FAILED', message: 'Pinterest pin creation requires an image with a public URL.' });
    if (!connection.platformMetadata?.boardId) {
      return connectorResult({ code: 'MISSING_CONFIGURATION', message: 'Pinterest publishing requires a boardId in connection metadata.' });
    }
    return okResult({}, 'Pinterest payload is publishable.');
  }

  async publish(payload, connection) {
    const validation = this.validatePublishPayload(payload, connection);
    if (!validation.ok) return validation;
    const image = payload.mediaAssets.find(asset => asset.mediaType === 'image' && asset.publicUrl);
    const control = await this.checkPublishControl(payload);
    if (control) return control;
    const result = await this.requestJson('https://api.pinterest.com/v5/pins', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.getAccessToken(connection)}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        board_id: connection.platformMetadata.boardId,
        title: payload.caption?.split('\n')[0]?.slice(0, 95) || 'CreatorOps pin',
        description: payload.caption || '',
        media_source: {
          source_type: 'image_url',
          url: image.publicUrl
        }
      }),
      signal: payload.abortSignal
    });
    if (!result.ok) return result;
    return okResult({
      providerPostId: result.data.id,
      providerPostUrl: result.data.link || '',
      rawResponse: result.data
    }, 'Pinterest pin created through the official API.');
  }
}
