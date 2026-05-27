import env from '../../config/env.js';
import BasePlatformConnector, { connectorResult, okResult } from '../BasePlatformConnector.js';

export default class LinkedInConnector extends BasePlatformConnector {
  constructor() {
    super('linkedin', 'LinkedIn');
  }

  getRequiredEnv() {
    return ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'];
  }

  getRequiredScopes() {
    return ['openid', 'profile', 'w_member_social'];
  }

  getCapabilities() {
    return { publish: true, schedule: true, analytics: false, comments: false, replies: false, mediaUpload: false };
  }

  getHelperText() {
    return 'Connect LinkedIn profile/page';
  }

  isConfigured() {
    return Boolean(env.oauth.linkedin.clientId && env.oauth.linkedin.clientSecret);
  }

  getAuthorizationUrl({ state, redirectUri }) {
    if (!this.isConfigured()) return super.getAuthorizationUrl();
    const url = new URL('https://www.linkedin.com/oauth/v2/authorization');
    url.searchParams.set('client_id', env.oauth.linkedin.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', this.getRequiredScopes().join(' '));
    url.searchParams.set('state', state);
    return okResult({ authorizationUrl: url.toString() }, 'Redirect to LinkedIn OAuth.');
  }

  async exchangeCodeForToken({ code, redirectUri }) {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: env.oauth.linkedin.clientId,
      client_secret: env.oauth.linkedin.clientSecret
    });
    const result = await this.requestJson('https://www.linkedin.com/oauth/v2/accessToken', { method: 'POST', body });
    if (!result.ok) return result;
    return okResult({
      accessToken: result.data.access_token,
      expiresIn: result.data.expires_in,
      scopes: this.getRequiredScopes()
    });
  }

  async fetchAccountProfileFromToken(tokenData) {
    const result = await this.requestJson('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.accessToken}` }
    });
    if (!result.ok) return result;
    return okResult({
      accountName: result.data.name || 'LinkedIn Member',
      accountHandle: result.data.email || result.data.sub,
      externalAccountId: result.data.sub,
      accountType: 'profile',
      scopes: tokenData.scopes
    });
  }

  async healthCheck(connection) {
    const base = await super.healthCheck(connection);
    if (base.code !== 'CAPABILITY_UNAVAILABLE') return base;

    const token = this.getAccessToken(connection);
    if (!token) {
      return connectorResult({ code: 'INVALID_CREDENTIALS', message: 'No stored LinkedIn access token was found. Reconnect this account.' });
    }

    const result = await this.requestJson('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!result.ok) return result;
    return okResult({ account: result.data }, 'LinkedIn token verified through the LinkedIn API.');
  }

  validatePublishPayload(payload, connection) {
    const base = super.validatePublishPayload(payload, connection);
    if (!base.ok) return base;
    if (!payload.caption) {
      return connectorResult({ code: 'VALIDATION_FAILED', message: 'LinkedIn publishing requires text.' });
    }
    if (!connection.scopes?.includes('w_member_social')) {
      return connectorResult({ code: 'MISSING_PERMISSIONS', message: 'Missing LinkedIn w_member_social permission.' });
    }
    return okResult({}, 'LinkedIn payload is publishable.');
  }

  async publish(payload, connection) {
    const validation = this.validatePublishPayload(payload, connection);
    if (!validation.ok) return validation;
    const token = this.getAccessToken(connection);
    const author = `urn:li:person:${connection.externalAccountId}`;
    const body = {
      author,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: payload.caption },
          shareMediaCategory: 'NONE'
        }
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
    };
    const control = await this.checkPublishControl(payload);
    if (control) return control;
    const result = await this.requestJson('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': env.oauth.linkedin.apiVersion
      },
      body: JSON.stringify(body),
      signal: payload.abortSignal
    });
    if (!result.ok) return result;
    const id = result.data.id || result.data.value || '';
    return okResult({ providerPostId: id, providerPostUrl: '', rawResponse: result.data }, 'LinkedIn post published through the official API.');
  }
}
