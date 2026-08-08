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

const getApiHost = url => {
  try {
    return new URL(String(url)).hostname;
  } catch (_error) {
    return 'provider API';
  }
};

const createTimedFetchOptions = ({ fetchOptions, timeoutMs }) => {
  const resolvedTimeoutMs = Number(timeoutMs);
  if (!Number.isFinite(resolvedTimeoutMs) || resolvedTimeoutMs <= 0) {
    return {
      fetchOptions,
      didTimeout: () => false,
      cleanup: () => {}
    };
  }

  const controller = new AbortController();
  const upstreamSignal = fetchOptions.signal;
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, resolvedTimeoutMs);
  timeoutId.unref?.();
  const abortFromUpstream = () => controller.abort(upstreamSignal.reason);

  if (upstreamSignal) {
    if (upstreamSignal.aborted) {
      abortFromUpstream();
    } else {
      upstreamSignal.addEventListener('abort', abortFromUpstream, { once: true });
    }
  }

  return {
    fetchOptions: {
      ...fetchOptions,
      signal: controller.signal
    },
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timeoutId);
      upstreamSignal?.removeEventListener?.('abort', abortFromUpstream);
    }
  };
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
      mediaUpload: false,
      delete: false
    };
  }

  getHelperText() {
    return `Connect ${this.displayName}.`;
  }

  async getMediaUploadPolicy() {
    return okResult({
      platform: this.platform,
      displayName: this.displayName,
      source: 'provider_api_unavailable',
      policyAvailable: false,
      compressionSupported: false,
      promptForCompression: false,
      mediaChecks: [],
      oversizedMedia: [],
      prompts: []
    }, `${this.displayName} does not expose a provider API for media size preflight in this connector.`);
  }

  isFileTooLargeResult(result) {
    const text = [
      result?.code,
      result?.message,
      result?.data?.payload?.error?.message,
      result?.data?.payload?.message,
      result?.data?.payload?.title,
      result?.data?.payload?.detail
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (/quota|rate limit|rate-limit|daily limit|per day|usage limit|usage_limits|user rate/i.test(text)) {
      return false;
    }

    return /file|media|image|video|attachment/.test(text) && /too large|exceeds|size|limit|maximum|max/.test(text);
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
    return unavailableResult(`${this.displayName} does not have a deep credential health check implemented yet.`);
  }

  validatePublishPayload(_payload, connection) {
    if (!this.isConfigured()) return notConfiguredResult(this.displayName);
    if (!connection || connection.status !== 'connected') {
      return connectorResult({
        code: 'NOT_CONNECTED',
        message: 'Connect a real account before publishing.'
      });
    }
    if (Array.isArray(_payload?.mediaAssets) && _payload.mediaAssets.length > 0 && !this.getCapabilities().mediaUpload) {
      return connectorResult({
        code: 'CAPABILITY_UNAVAILABLE',
        message: `${this.displayName} media publishing is not implemented in this connector yet, so CreatorOps will not publish a text-only post while media is selected.`
      });
    }
    return okResult({}, 'Publish payload accepted.');
  }

  async validateTargetMedia() {
    return okResult({}, 'Target media accepted.');
  }

  async publish() {
    return notImplementedResult(`${this.displayName} publishing is not implemented for this connector yet.`);
  }

  async deletePublishedPost() {
    return unavailableResult(`${this.displayName} post deletion is unavailable with the current connector/scopes.`);
  }

  async fetchAnalytics() {
    return unavailableResult(`${this.displayName} analytics are unavailable with the current connector/scopes.`);
  }

  /*
   * Account-level audience size (followers / subscribers), as opposed to
   * per-post metrics. Connectors that cannot read it with their granted scopes
   * keep this default, so the number stays explicitly unavailable rather than
   * silently becoming 0.
   */
  async fetchAudienceMetrics() {
    return unavailableResult(`${this.displayName} does not expose an audience size the current connector/scopes can read.`);
  }

  /**
   * Public web address of the connected account, built from what the provider
   * returned at connect time. Empty when no public URL can be derived — better
   * a plain handle than a link that 404s.
   */
  getAccountProfileUrl() {
    return '';
  }

  /** Handles are stored as the provider writes them, some with a leading `@`. */
  stripHandlePrefix(handle) {
    return String(handle || '').trim().replace(/^@+/, '');
  }

  /**
   * ───────────────────────────────────────────────────────────────────────────
   * The media of a post, read back from the platform that is now hosting it.
   *
   * This workspace deletes its own copy once a post has shipped, which is the
   * whole point of the storage model — but it left every later screen with
   * nothing to show. The platforms still have the file, and a published post
   * already records which one and under what id, so the picture can be borrowed
   * back on demand instead of stored twice.
   *
   * Nothing returned here is ever written to disk or to the database. The URLs
   * belong to the platform, most of them expire, and treating them as anything
   * but a short-lived view would quietly recreate the storage problem.
   *
   * Shape: okResult({ items: [{ kind, url, thumbnailUrl, width, height,
   * durationSeconds }] }) — `url` plays or displays, `thumbnailUrl` is a still.
   * Either may be empty; a connector returns what the platform actually gives.
   * ───────────────────────────────────────────────────────────────────────────
   */
  async fetchPostMedia() {
    return unavailableResult(
      `${this.displayName} does not expose post media the current connector/scopes can read.`
    );
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

  async checkPublishControl(payload) {
    if (typeof payload?.checkPublishControl !== 'function') return null;
    return payload.checkPublishControl();
  }

  getProviderUploadSession(payload, sessionType = '') {
    const session = payload?.providerUploadSession || {};
    if (session.platform && session.platform !== this.platform) return {};
    if (sessionType && session.sessionType && session.sessionType !== sessionType) return {};
    return session;
  }

  getProviderUploadSessionData(payload, sessionType = '') {
    const session = this.getProviderUploadSession(payload, sessionType);
    return session?.data && typeof session.data === 'object' ? session.data : {};
  }

  async saveProviderUploadSession(payload, updates = {}) {
    if (typeof payload?.saveProviderUploadSession !== 'function') return;
    await payload.saveProviderUploadSession({
      platform: this.platform,
      ...updates
    });
  }

  getPayloadMediaBytes(payload) {
    return (payload?.mediaAssets || []).reduce((sum, asset) => sum + Number(asset?.size || 0), 0);
  }

  async reportUploadProgress(payload, progress = {}) {
    if (typeof payload?.onUploadProgress !== 'function') return;
    await payload.onUploadProgress({
      phase: progress.phase || 'provider_ingest',
      bytesUploaded: Number(progress.bytesUploaded || 0),
      totalBytes: Number(progress.totalBytes || 0),
      message: progress.message || ''
    });
  }

  async reportRemoteMediaIngestStart(payload, message = `${this.displayName} is ingesting cloud media.`) {
    const totalBytes = this.getPayloadMediaBytes(payload);
    if (totalBytes <= 0) return;
    await this.reportUploadProgress(payload, {
      phase: 'provider_ingest',
      bytesUploaded: 0,
      totalBytes,
      message
    });
  }

  async reportRemoteMediaIngestComplete(payload, message = `${this.displayName} accepted cloud media.`) {
    const totalBytes = this.getPayloadMediaBytes(payload);
    if (totalBytes <= 0) return;
    await this.reportUploadProgress(payload, {
      phase: 'provider_ingest_complete',
      bytesUploaded: totalBytes,
      totalBytes,
      message
    });
  }

  async requestJson(url, options = {}) {
    const { retryNetworkErrors, timeoutMs = env.providerApiTimeoutMs, ...fetchOptions } = options;
    const method = String(fetchOptions.method || 'GET').toUpperCase();
    const safeToRetry = ['GET', 'HEAD'].includes(method);
    const retries = safeToRetry
      ? Math.max(0, Number.isFinite(Number(retryNetworkErrors)) ? Number(retryNetworkErrors) : 1)
      : 0;
    let response;
    let payload;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const timedFetch = createTimedFetchOptions({ fetchOptions, timeoutMs });
      try {
        response = await fetch(url, timedFetch.fetchOptions);
        payload = await parseJsonSafe(response);
        break;
      } catch (error) {
        const didTimeout = timedFetch.didTimeout();
        if (attempt < retries) continue;
        const host = getApiHost(url);
        return connectorResult({
          code: didTimeout ? 'PROVIDER_TIMEOUT' : 'NETWORK_ERROR',
          message: didTimeout
            ? `${this.displayName} API did not respond from the CreatorOps server within ${Math.round(Number(timeoutMs) / 1000)} seconds (${host}). Retry the action later.`
            : `${this.displayName} API could not be reached from the CreatorOps server (${host}). Retry the action after checking server network access.`,
          data: {
            host,
            method,
            timeoutMs: Number(timeoutMs),
            networkError: error.message || 'fetch failed',
            networkCauseCode: error.cause?.code || ''
          }
        });
      } finally {
        timedFetch.cleanup();
      }
    }

    if (!response.ok) {
      const firstProviderError = Array.isArray(payload?.errors) ? payload.errors[0] : null;
      const statusCode = `HTTP_${response.status}`;
      const providerCode =
        firstProviderError?.code ||
        firstProviderError?.title ||
        payload?.error?.code ||
        payload?.error ||
        statusCode;

      return connectorResult({
        code: String(providerCode),
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
