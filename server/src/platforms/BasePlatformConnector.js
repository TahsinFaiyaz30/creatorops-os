import env from '../config/env.js';
import { decryptSecret } from '../services/encryption.service.js';

export const connectorResult = ({ ok = false, code = 'UNKNOWN', message = '', data = {} }) => ({
  ok,
  code,
  message,
  data
});

export const okResult = (data = {}, message = 'OK') =>
  connectorResult({ ok: true, code: 'OK', message, data });

export const notConfiguredResult = platform =>
  connectorResult({
    code: 'NOT_CONFIGURED',
    message: `${platform} credentials are not configured on the server.`
  });

export const missingPermissionsResult = scopes =>
  connectorResult({
    code: 'MISSING_PERMISSIONS',
    message: `Missing required platform permission(s): ${scopes.join(', ')}`,
    data: { missingScopes: scopes }
  });

export const unavailableResult = message =>
  connectorResult({
    code: 'CAPABILITY_UNAVAILABLE',
    message
  });

export const notImplementedResult = message =>
  connectorResult({
    code: 'NOT_IMPLEMENTED',
    message
  });

const parseJsonSafe = async response => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (_error) {
    return { raw: text };
  }
};

export default class BasePlatformConnector {
  constructor(platform, displayName) {
    this.platform = platform;
    this.displayName = displayName;
  }

  getPlatform() {
    return this.platform;
  }

  getDisplayName() {
    return this.displayName;
  }

  getRequiredEnv() {
    return [];
  }

  getRequiredScopes() {
    return [];
  }

  getCapabilities() {
    return {
      publish: false,
      schedule: true,
      analytics: false,
      comments: false,
      replies: false,
      mediaUpload: false
    };
  }

  getHelperText() {
    return `Connect ${this.displayName}.`;
  }

  isConfigured() {
    return this.getRequiredEnv().every(key => Boolean(process.env[key]));
  }

  getAuthorizationUrl() {
    return notConfiguredResult(this.displayName);
  }

  async exchangeCodeForToken() {
    return notImplementedResult(`${this.displayName} OAuth token exchange is not implemented.`);
  }

  async refreshToken() {
    return unavailableResult(`${this.displayName} token refresh is unavailable for this connection.`);
  }

  async fetchAccountProfile() {
    return unavailableResult(`${this.displayName} account profile lookup is unavailable.`);
  }

  async healthCheck(connection) {
    if (!this.isConfigured()) return notConfiguredResult(this.displayName);
    if (connection.status !== 'connected') {
      return connectorResult({
        code: connection.status?.toUpperCase() || 'DISCONNECTED',
        message: `Connection is ${connection.status || 'not connected'}.`
      });
    }
    return okResult({ status: connection.status }, 'Connection metadata is present.');
  }

  validatePublishPayload(_payload, connection) {
    if (!this.isConfigured()) return notConfiguredResult(this.displayName);
    if (!connection || connection.status !== 'connected') {
      return connectorResult({
        code: 'NOT_CONNECTED',
        message: 'Connect a real account before publishing.'
      });
    }
    return okResult({}, 'Publish payload accepted.');
  }

  async publish() {
    return notImplementedResult(`${this.displayName} publishing is not implemented for this connector yet.`);
  }

  async fetchAnalytics() {
    return unavailableResult(`${this.displayName} analytics are unavailable with the current connector/scopes.`);
  }

  async fetchComments() {
    return unavailableResult(`${this.displayName} comments are unavailable with the current connector/scopes.`);
  }

  async replyToComment() {
    return unavailableResult(`${this.displayName} comment replies are unavailable with the current connector/scopes.`);
  }

  getAccessToken(connection) {
    return decryptSecret(connection.encryptedAccessToken);
  }

  getRefreshToken(connection) {
    return decryptSecret(connection.encryptedRefreshToken);
  }

  getApiSecret(connection) {
    return decryptSecret(connection.encryptedApiSecret);
  }

  getAppPassword(connection) {
    return decryptSecret(connection.encryptedAppPassword);
  }

  getPublicBaseUrl() {
    return env.publicBaseUrl;
  }

  async requestJson(url, options = {}) {
    const response = await fetch(url, options);
    const payload = await parseJsonSafe(response);

    if (!response.ok) {
      const firstProviderError = Array.isArray(payload?.errors) ? payload.errors[0] : null;
      return connectorResult({
        code: firstProviderError?.code || firstProviderError?.title || payload?.error?.code || payload?.error || `HTTP_${response.status}`,
        message:
          firstProviderError?.detail ||
          firstProviderError?.message ||
          payload?.error?.message ||
          payload?.message ||
          `Platform API returned HTTP ${response.status}.`,
        data: { status: response.status, payload }
      });
    }

    return okResult(payload, 'Platform API request succeeded.');
  }
}
