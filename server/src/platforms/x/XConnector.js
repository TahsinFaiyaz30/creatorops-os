import env from '../../config/env.js';
import BasePlatformConnector, { connectorResult, okResult } from '../BasePlatformConnector.js';

const X_PROVIDER_SESSION_TYPE = 'x_chunked_media_v2';
const X_MEDIA_UPLOAD_CHUNK_BYTES = 4 * 1024 * 1024;
const X_MEDIA_PROCESSING_MAX_POLLS = 30;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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
    return { publish: true, schedule: true, analytics: false, comments: false, replies: true, mediaUpload: true, delete: true };
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

  getMediaAssetKey(asset) {
    return String(asset?._id || asset?.mediaAssetId || asset?.objectKey || asset?.originalName || '');
  }

  getMediaFingerprint(asset) {
    return [
      this.platform,
      this.getMediaAssetKey(asset),
      asset?.objectKey || '',
      asset?.mimeType || '',
      asset?.sha256 || '',
      Number(asset?.size || 0)
    ].join(':');
  }

  getPostMediaFingerprint(assets = []) {
    return assets.map(asset => this.getMediaFingerprint(asset)).join('|');
  }

  getChunkSize(totalBytes) {
    const minimumChunkSize = Math.max(1, Number(X_MEDIA_UPLOAD_CHUNK_BYTES));
    const chunkSizeForSegmentLimit = Math.ceil(Number(totalBytes || 0) / 1000);
    return Math.max(minimumChunkSize, chunkSizeForSegmentLimit);
  }

  isProviderMediaReferenceInvalid(result) {
    const text = [
      result?.code,
      result?.message,
      result?.data?.payload?.title,
      result?.data?.payload?.detail,
      result?.data?.payload?.message,
      ...(Array.isArray(result?.data?.payload?.errors) ? result.data.payload.errors.map(error => error.detail || error.title || '') : [])
    ].filter(Boolean).join(' ').toLowerCase();
    return /media/.test(text) && /invalid|expired|not found|not_found|missing/.test(text);
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
      const unsupported = mediaAssets.find(asset =>
        !['image', 'video'].includes(asset.mediaType) || !asset.mimeType || !/^(image|video)\//.test(asset.mimeType)
      );
      if (unsupported) {
        return connectorResult({ code: 'VALIDATION_FAILED', message: 'X media upload accepts image or video assets only.' });
      }
      const nonImageAssets = mediaAssets.filter(asset => asset.mediaType === 'video' || asset.mimeType === 'image/gif');
      if (nonImageAssets.length > 0 && mediaAssets.length > 1) {
        return connectorResult({
          code: 'VALIDATION_FAILED',
          message: 'X posts can attach one video or animated GIF, or up to 4 still images. Split mixed or multi-video media sets before publishing.'
        });
      }
      if (mediaAssets.length > 4) {
        return connectorResult({
          code: 'VALIDATION_FAILED',
          message: 'X image publishing supports up to 4 images per post. Split larger media sets before publishing.'
        });
      }
    }
    return okResult({}, 'X payload is publishable.');
  }

  async initializeChunkedMediaUpload(asset, token) {
    const result = await this.requestJson('https://api.x.com/2/media/upload/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        media_category: this.getMediaCategory(asset),
        media_type: asset.mimeType,
        total_bytes: Number(asset.size || 0)
      })
    });
    const normalized = normalizeXResult(result);
    if (!normalized.ok) {
      if (mediaIds.length > 0 && this.isProviderMediaReferenceInvalid(normalized)) {
        await this.saveXUploadSession(payload, {
          postFingerprint,
          totalBytes: totalUploadBytes,
          bytesUploaded: 0,
          data: { uploads: {} }
        });
      }
      return normalized;
    }
    const mediaId = normalized.data?.data?.id || normalized.data?.data?.media_id || '';
    if (!mediaId) {
      return connectorResult({
        code: 'PROVIDER_RESPONSE_INVALID',
        message: 'X media upload initialization succeeded but did not return a media id.',
        data: normalized.data
      });
    }
    return okResult({
      providerMediaId: mediaId,
      rawResponse: normalized.data,
      processingInfo: normalized.data?.data?.processing_info || null,
      expiresAfterSeconds: normalized.data?.data?.expires_after_secs || null
    }, 'X chunked media upload initialized.');
  }

  async appendChunkedMediaUpload({ mediaId, token, chunk, segmentIndex }) {
    const result = await this.requestJson(`https://api.x.com/2/media/upload/${encodeURIComponent(mediaId)}/append`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        media: chunk.toString('base64'),
        segment_index: segmentIndex
      })
    });
    return normalizeXResult(result);
  }

  async finalizeChunkedMediaUpload({ mediaId, token }) {
    const result = await this.requestJson(`https://api.x.com/2/media/upload/${encodeURIComponent(mediaId)}/finalize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    const normalized = normalizeXResult(result);
    if (!normalized.ok) return normalized;
    return okResult({
      rawResponse: normalized.data,
      processingInfo: normalized.data?.data?.processing_info || null
    }, 'X chunked media upload finalized.');
  }

  async getChunkedMediaUploadStatus({ mediaId, token }) {
    const result = await this.requestJson(`https://api.x.com/2/media/upload?media_id=${encodeURIComponent(mediaId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      retryNetworkErrors: 1
    });
    const normalized = normalizeXResult(result);
    if (!normalized.ok) return normalized;
    return okResult({
      rawResponse: normalized.data,
      processingInfo: normalized.data?.data?.processing_info || null
    }, 'X media processing status checked.');
  }

  async waitForChunkedMediaProcessing({ mediaId, token, processingInfo, payload, progressContext = {} }) {
    let currentInfo = processingInfo;
    for (let attempt = 0; attempt < X_MEDIA_PROCESSING_MAX_POLLS; attempt += 1) {
      const state = currentInfo?.state;
      if (!state || state === 'succeeded') {
        return okResult({ processingInfo: currentInfo }, 'X media processing completed.');
      }
      if (state === 'failed') {
        return connectorResult({
          code: 'PROVIDER_MEDIA_PROCESSING_FAILED',
          message: 'X media processing failed after upload.',
          data: { processingInfo: currentInfo }
        });
      }

      const control = await this.checkPublishControl(payload);
      if (control) return control;
      const waitSeconds = Math.min(10, Math.max(1, Number(currentInfo?.check_after_secs || 1)));
      await this.reportUploadProgress(payload, {
        phase: 'uploading',
        bytesUploaded: Number(progressContext.bytesUploaded || 0),
        totalBytes: Number(progressContext.totalBytes || 0),
        message: `X is processing uploaded media (${currentInfo?.progress_percent || 0}%).`
      });
      await sleep(waitSeconds * 1000);

      const status = await this.getChunkedMediaUploadStatus({ mediaId, token });
      if (!status.ok) return status;
      currentInfo = status.data.processingInfo;
    }

    return connectorResult({
      code: 'PROVIDER_MEDIA_PROCESSING_TIMEOUT',
      message: 'X media processing did not finish in time. Retry from Publishing to continue checking the saved media upload.',
      data: { mediaId, processingInfo: currentInfo }
    });
  }

  async saveXUploadSession(payload, { postFingerprint, totalBytes, bytesUploaded, data }) {
    await this.saveProviderUploadSession(payload, {
      sessionType: X_PROVIDER_SESSION_TYPE,
      mediaFingerprint: postFingerprint,
      totalBytes,
      bytesUploaded,
      data
    });
  }

  getReusableXUploadData(payload, postFingerprint) {
    const session = this.getProviderUploadSession(payload, X_PROVIDER_SESSION_TYPE);
    if (session.mediaFingerprint !== postFingerprint) return { uploads: {} };
    return session.data && typeof session.data === 'object' ? session.data : { uploads: {} };
  }

  async uploadImageMedia(asset, token, payload, progressContext = {}) {
    if (!asset.objectKey || typeof asset.readBuffer !== 'function') {
      return connectorResult({ code: 'VALIDATION_FAILED', message: 'X media upload requires verified cloud media.' });
    }

    const totalUploadBytes = Number(progressContext.totalBytes || asset.size || 0);
    const uploadedBefore = Number(progressContext.uploadedBefore || 0);
    const postFingerprint = progressContext.postFingerprint || this.getPostMediaFingerprint(payload.mediaAssets || []);
    const sessionData = progressContext.sessionData || { uploads: {} };
    sessionData.uploads = sessionData.uploads || {};
    const assetKey = this.getMediaAssetKey(asset);
    const mediaFingerprint = this.getMediaFingerprint(asset);
    const totalBytes = Number(asset.size || 0);
    const chunkSize = this.getChunkSize(totalBytes);
    let uploadState = sessionData.uploads[assetKey];

    if (!uploadState || uploadState.mediaFingerprint !== mediaFingerprint || Number(uploadState.totalBytes || 0) !== totalBytes) {
      uploadState = {
        mediaAssetId: assetKey,
        mediaFingerprint,
        providerMediaId: '',
        mediaCategory: this.getMediaCategory(asset),
        mimeType: asset.mimeType || '',
        totalBytes,
        bytesUploaded: 0,
        nextSegmentIndex: 0,
        chunkSize,
        finalized: false,
        rawResponse: null,
        processingInfo: null
      };
      sessionData.uploads[assetKey] = uploadState;
    }

    if (uploadState.finalized && uploadState.providerMediaId) {
      if (!uploadState.processedAt) {
        const processed = await this.waitForChunkedMediaProcessing({
          mediaId: uploadState.providerMediaId,
          token,
          processingInfo: uploadState.processingInfo,
          payload,
          progressContext: {
            bytesUploaded: uploadedBefore + totalBytes,
            totalBytes: totalUploadBytes
          }
        });
        if (!processed.ok) return processed;
        uploadState.processingInfo = processed.data.processingInfo;
        uploadState.processedAt = new Date();
        await this.saveXUploadSession(payload, {
          postFingerprint,
          totalBytes: totalUploadBytes,
          bytesUploaded: uploadedBefore + totalBytes,
          data: sessionData
        });
      }
      await this.reportUploadProgress(payload, {
        phase: progressContext.isLastAsset ? 'uploaded' : 'uploading',
        bytesUploaded: uploadedBefore + totalBytes,
        totalBytes: totalUploadBytes,
        message: `Reusing saved X media upload for ${asset.originalName || 'media'}.`
      });
      return okResult({ mediaId: uploadState.providerMediaId, rawResponse: uploadState.rawResponse }, 'Reused saved X media upload.');
    }

    const controlBeforeInitialize = await this.checkPublishControl(payload);
    if (controlBeforeInitialize) return controlBeforeInitialize;
    await this.reportUploadProgress(payload, {
      phase: 'initializing',
      bytesUploaded: uploadedBefore + Number(uploadState.bytesUploaded || 0),
      totalBytes: totalUploadBytes,
      message: uploadState.providerMediaId
        ? `Resuming X media upload for ${asset.originalName || 'media'}.`
        : `Starting X chunked media upload for ${asset.originalName || 'media'}.`
    });

    if (!uploadState.providerMediaId) {
      const initialized = await this.initializeChunkedMediaUpload(asset, token);
      if (!initialized.ok && this.isFileTooLargeResult(initialized)) {
        return connectorResult({
          code: 'FILE_TOO_LARGE',
          message: `X rejected ${asset.originalName || 'media'} because the provider API says the file is too large.`,
          data: initialized.data
        });
      }
      if (!initialized.ok) return initialized;
      uploadState.providerMediaId = initialized.data.providerMediaId;
      uploadState.rawResponse = initialized.data.rawResponse;
      uploadState.processingInfo = initialized.data.processingInfo;
      uploadState.expiresAfterSeconds = initialized.data.expiresAfterSeconds;
      uploadState.startedAt = new Date();
      await this.saveXUploadSession(payload, {
        postFingerprint,
        totalBytes: totalUploadBytes,
        bytesUploaded: uploadedBefore,
        data: sessionData
      });
    }

    let offset = Math.max(0, Number(uploadState.bytesUploaded || 0));
    let segmentIndex = Math.max(0, Number(uploadState.nextSegmentIndex || Math.floor(offset / chunkSize)));

    while (offset < totalBytes) {
      const controlBeforeChunk = await this.checkPublishControl(payload);
      if (controlBeforeChunk) return controlBeforeChunk;

      const end = Math.min(offset + chunkSize, totalBytes) - 1;
      const chunk = await asset.readBuffer({ start: offset, end });
      await this.reportUploadProgress(payload, {
        phase: 'uploading',
        bytesUploaded: uploadedBefore + offset,
        totalBytes: totalUploadBytes,
        message: `Uploading ${asset.originalName || 'media'} to X from byte ${offset}.`
      });
      const appended = await this.appendChunkedMediaUpload({
        mediaId: uploadState.providerMediaId,
        token,
        chunk,
        segmentIndex
      });
      if (!appended.ok && this.isFileTooLargeResult(appended)) {
        return connectorResult({
          code: 'FILE_TOO_LARGE',
          message: `X rejected ${asset.originalName || 'media'} because the provider API says the file is too large.`,
          data: appended.data
        });
      }
      if (!appended.ok) return appended;

      offset = end + 1;
      segmentIndex += 1;
      uploadState.bytesUploaded = offset;
      uploadState.nextSegmentIndex = segmentIndex;
      uploadState.updatedAt = new Date();
      await this.saveXUploadSession(payload, {
        postFingerprint,
        totalBytes: totalUploadBytes,
        bytesUploaded: uploadedBefore + offset,
        data: sessionData
      });
      await this.reportUploadProgress(payload, {
        phase: 'uploading',
        bytesUploaded: uploadedBefore + offset,
        totalBytes: totalUploadBytes,
        message: `Uploading ${asset.originalName || 'media'} to X: ${Math.floor((offset / totalBytes) * 100)}% complete.`
      });
    }

    const controlBeforeFinalize = await this.checkPublishControl(payload);
    if (controlBeforeFinalize) return controlBeforeFinalize;
    const finalized = await this.finalizeChunkedMediaUpload({ mediaId: uploadState.providerMediaId, token });
    if (!finalized.ok) return finalized;
    uploadState.rawResponse = finalized.data.rawResponse;
    uploadState.processingInfo = finalized.data.processingInfo;
    uploadState.bytesUploaded = totalBytes;
    uploadState.nextSegmentIndex = segmentIndex;
    uploadState.finalized = true;
    uploadState.finalizedAt = new Date();
    await this.saveXUploadSession(payload, {
      postFingerprint,
      totalBytes: totalUploadBytes,
      bytesUploaded: uploadedBefore + totalBytes,
      data: sessionData
    });

    const processed = await this.waitForChunkedMediaProcessing({
      mediaId: uploadState.providerMediaId,
      token,
      processingInfo: uploadState.processingInfo,
      payload,
      progressContext: {
        bytesUploaded: uploadedBefore + totalBytes,
        totalBytes: totalUploadBytes
      }
    });
    if (!processed.ok) return processed;
    uploadState.processingInfo = processed.data.processingInfo;
    uploadState.processedAt = new Date();
    await this.saveXUploadSession(payload, {
      postFingerprint,
      totalBytes: totalUploadBytes,
      bytesUploaded: uploadedBefore + totalBytes,
      data: sessionData
    });

    await this.reportUploadProgress(payload, {
      phase: progressContext.isLastAsset ? 'uploaded' : 'uploading',
      bytesUploaded: uploadedBefore + totalBytes,
      totalBytes: totalUploadBytes,
      message: `X accepted ${asset.originalName || 'media'}.`
    });

    return okResult({ mediaId: uploadState.providerMediaId, rawResponse: uploadState.rawResponse }, 'X media uploaded through the official chunked media API.');
  }

  async publish(payload, connection) {
    const validation = this.validatePublishPayload(payload, connection);
    if (!validation.ok) return validation;
    const token = this.getAccessToken(connection);
    const mediaIds = [];
    const mediaUploadResponses = [];
    const uploadAssets = payload.mediaAssets || [];
    const totalUploadBytes = uploadAssets.reduce((sum, asset) => sum + Number(asset.size || 0), 0);
    const postFingerprint = this.getPostMediaFingerprint(uploadAssets);
    const sessionData = this.getReusableXUploadData(payload, postFingerprint);
    let uploadedBefore = 0;

    for (let index = 0; index < uploadAssets.length; index += 1) {
      const asset = uploadAssets[index];
      const uploadResult = await this.uploadImageMedia(asset, token, payload, {
        uploadedBefore,
        totalBytes: totalUploadBytes,
        postFingerprint,
        sessionData,
        isLastAsset: index === uploadAssets.length - 1
      });
      if (!uploadResult.ok) return uploadResult;
      mediaIds.push(uploadResult.data.mediaId);
      mediaUploadResponses.push(uploadResult.data.rawResponse);
      uploadedBefore += Number(asset.size || 0);
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

  async deletePublishedPost(connection, providerPostId) {
    if (!providerPostId) {
      return connectorResult({ code: 'VALIDATION_FAILED', message: 'X deletion requires a provider post id.' });
    }
    const result = await this.requestJson(`https://api.x.com/2/tweets/${encodeURIComponent(providerPostId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.getAccessToken(connection)}` }
    });
    const normalized = normalizeXResult(result);
    if (!normalized.ok) return normalized;
    return okResult({ providerPostId, rawResponse: normalized.data }, 'X post deleted through the official API.');
  }
}
