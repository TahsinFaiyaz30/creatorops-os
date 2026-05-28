import env from '../../config/env.js';
import BasePlatformConnector, { connectorResult, okResult } from '../BasePlatformConnector.js';

const THREADS_PROVIDER_SESSION_TYPE = 'threads_container_v1';

const isCreationContainerInvalidResult = result => {
  const text = [
    result?.code,
    result?.message,
    result?.data?.payload?.error?.message,
    result?.data?.payload?.message,
    result?.data?.payload?.title,
    result?.data?.payload?.detail
  ].filter(Boolean).join(' ').toLowerCase();
  return /creation|container|media/.test(text) && /invalid|expired|not found|missing/.test(text);
};

export default class ThreadsConnector extends BasePlatformConnector {
  constructor() {
    super('threads', 'Threads');
  }

  getRequiredEnv() {
    return ['THREADS_APP_ID', 'THREADS_APP_SECRET'];
  }

  getRequiredScopes() {
    return ['threads_basic', 'threads_content_publish', 'threads_manage_replies', 'threads_read_replies'];
  }

  getCapabilities() {
    return { publish: true, schedule: true, analytics: true, comments: true, replies: true, mediaUpload: false, delete: false };
  }

  getHelperText() {
    return 'Connect Threads account';
  }

  isConfigured() {
    return Boolean(env.oauth.threads.appId && env.oauth.threads.appSecret);
  }

  getAuthorizationUrl({ state, redirectUri }) {
    if (!this.isConfigured()) return super.getAuthorizationUrl();
    const url = new URL('https://threads.net/oauth/authorize');
    url.searchParams.set('client_id', env.oauth.threads.appId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', this.getRequiredScopes().join(','));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    return okResult({ authorizationUrl: url.toString() }, 'Redirect to Threads OAuth.');
  }

  async exchangeCodeForToken({ code, redirectUri }) {
    const body = new URLSearchParams({
      client_id: env.oauth.threads.appId,
      client_secret: env.oauth.threads.appSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code
    });
    const result = await this.requestJson('https://graph.threads.net/oauth/access_token', { method: 'POST', body });
    if (!result.ok) return result;
    return okResult({
      accessToken: result.data.access_token,
      expiresIn: result.data.expires_in,
      scopes: this.getRequiredScopes()
    });
  }

  async fetchAccountProfileFromToken(tokenData) {
    const result = await this.requestJson(
      `https://graph.threads.net/v1.0/me?fields=id,username,name&access_token=${encodeURIComponent(tokenData.accessToken)}`
    );
    if (!result.ok) return result;
    return okResult({
      accountName: result.data.name || result.data.username || 'Threads Account',
      accountHandle: result.data.username ? `@${result.data.username}` : result.data.id,
      externalAccountId: result.data.id,
      accountType: 'profile',
      scopes: tokenData.scopes
    });
  }

  async healthCheck(connection) {
    const base = await super.healthCheck(connection);
    if (base.code !== 'CAPABILITY_UNAVAILABLE') return base;

    const token = this.getAccessToken(connection);
    if (!token) {
      return connectorResult({ code: 'INVALID_CREDENTIALS', message: 'No stored Threads access token was found. Reconnect this account.' });
    }

    const result = await this.requestJson(
      `https://graph.threads.net/v1.0/me?fields=id,username,name&access_token=${encodeURIComponent(token)}`
    );
    if (!result.ok) return result;
    return okResult({ account: result.data }, 'Threads token verified through the Threads API.');
  }

  validatePublishPayload(payload, connection) {
    const base = super.validatePublishPayload(payload, connection);
    if (!base.ok) return base;
    if (!payload.caption) {
      return connectorResult({ code: 'VALIDATION_FAILED', message: 'Threads publishing requires text.' });
    }
    return okResult({}, 'Threads payload is publishable.');
  }

  async publish(payload, connection) {
    const validation = this.validatePublishPayload(payload, connection);
    if (!validation.ok) return validation;
    const token = this.getAccessToken(connection);
    const mediaFingerprint = [this.platform, connection.externalAccountId, payload.caption || ''].join(':');
    const savedSession = this.getProviderUploadSession(payload, THREADS_PROVIDER_SESSION_TYPE);
    const savedData = savedSession.mediaFingerprint === mediaFingerprint && savedSession.data && typeof savedSession.data === 'object'
      ? savedSession.data
      : {};
    let containerId = savedData.containerId || '';
    let containerData = savedData.container || null;

    if (!containerId) {
      const createBody = new URLSearchParams({
        access_token: token,
        media_type: 'TEXT',
        text: payload.caption
      });
      const controlBeforeContainer = await this.checkPublishControl(payload);
      if (controlBeforeContainer) return controlBeforeContainer;
      const container = await this.requestJson(`https://graph.threads.net/v1.0/${connection.externalAccountId}/threads`, {
        method: 'POST',
        body: createBody
      });
      if (!container.ok) return container;
      containerId = container.data.id || '';
      containerData = container.data;
      if (!containerId) {
        return connectorResult({ code: 'PROVIDER_RESPONSE_INVALID', message: 'Threads accepted container creation but did not return a creation id.' });
      }
      await this.saveProviderUploadSession(payload, {
        sessionType: THREADS_PROVIDER_SESSION_TYPE,
        mediaFingerprint,
        totalBytes: 0,
        bytesUploaded: 0,
        data: {
          containerId,
          container: containerData,
          createdAt: new Date()
        }
      });
    }

    const controlBeforePublish = await this.checkPublishControl(payload);
    if (controlBeforePublish) return controlBeforePublish;
    const publishBody = new URLSearchParams({ access_token: token, creation_id: containerId });
    const published = await this.requestJson(`https://graph.threads.net/v1.0/${connection.externalAccountId}/threads_publish`, {
      method: 'POST',
      body: publishBody
    });
    if (!published.ok) {
      if (isCreationContainerInvalidResult(published)) {
        await this.saveProviderUploadSession(payload, {
          sessionType: THREADS_PROVIDER_SESSION_TYPE,
          mediaFingerprint: '',
          totalBytes: 0,
          bytesUploaded: 0,
          data: {}
        });
      }
      return published;
    }
    return okResult({
      providerPostId: published.data.id,
      providerPostUrl: '',
      rawResponse: { container: containerData || { id: containerId }, published: published.data }
    }, 'Threads post published through the official API.');
  }
}
