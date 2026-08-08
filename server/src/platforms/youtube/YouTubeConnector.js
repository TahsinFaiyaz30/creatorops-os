import env from '../../config/env.js';
import { inspectVideoMetadata } from '../../services/mediaMetadata.service.js';
import BasePlatformConnector, { connectorResult, okResult, unavailableResult } from '../BasePlatformConnector.js';

const YOUTUBE_UPLOAD_CHUNK_BYTES = 16 * 1024 * 1024;
const YOUTUBE_SHORTS_MAX_DURATION_SECONDS = 3 * 60;

const parseUploadMaxSize = value => {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
  const text = String(value || '').trim();
  const match = text.match(/^(\d+(?:\.\d+)?)\s*(b|bytes?|kb|kib|mb|mib|gb|gib|tb|tib)?$/i);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = (match[2] || 'bytes').toLowerCase();
  const multipliers = {
    b: 1,
    byte: 1,
    bytes: 1,
    kb: 1024,
    kib: 1024,
    mb: 1024 ** 2,
    mib: 1024 ** 2,
    gb: 1024 ** 3,
    gib: 1024 ** 3,
    tb: 1024 ** 4,
    tib: 1024 ** 4
  };
  const multiplier = multipliers[unit];
  if (!multiplier) return null;
  return Math.floor(amount * multiplier);
};

const parseResponseJsonSafe = async response => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (_error) {
    return { raw: text };
  }
};

const parseUploadedRangeEnd = rangeHeader => {
  const match = String(rangeHeader || '').match(/bytes=0-(\d+)/i);
  return match ? Number(match[1]) : -1;
};

export default class YouTubeConnector extends BasePlatformConnector {
  constructor(platform = 'youtube', displayName = 'YouTube') {
    super(platform, displayName);
  }

  getRequiredEnv() {
    return ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
  }

  getRequiredScopes() {
    return [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/youtube.force-ssl'
    ];
  }

  getMissingScopes(connection, scopes) {
    const granted = new Set(connection?.scopes || []);
    return scopes.filter(scope => !granted.has(scope));
  }

  requireScopes(connection, scopes, action) {
    const missingScopes = this.getMissingScopes(connection, scopes);
    if (!missingScopes.length) return okResult({}, 'Required YouTube scopes are present.');

    return connectorResult({
      code: 'MISSING_PERMISSIONS',
      message: `Reconnect YouTube and grant ${missingScopes.join(', ')} to ${action}. Existing OAuth tokens do not automatically gain scopes added later in Google Cloud.`,
      data: { missingScopes }
    });
  }

  getCapabilities() {
    return { publish: true, schedule: true, analytics: true, comments: true, replies: true, mediaUpload: true, delete: true };
  }

  getHelperText() {
    return this.platform === 'youtube_shorts' ? 'Connect YouTube channel for Shorts' : 'Connect YouTube channel';
  }

  async getMediaUploadPolicy({ mediaItems = [] } = {}) {
    const discovery = await this.requestJson('https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest');
    if (!discovery.ok) {
      return {
        ...discovery,
        data: {
          platform: this.platform,
          displayName: this.displayName,
          source: 'provider_discovery_api',
          policyAvailable: false,
          compressionSupported: false,
          promptForCompression: false,
          mediaChecks: [],
          oversizedMedia: [],
          prompts: []
        }
      };
    }

    const insertMethod = discovery.data?.resources?.videos?.methods?.insert || {};
    const maxBytes = parseUploadMaxSize(insertMethod.mediaUpload?.maxSize);
    const acceptedMimeTypes = insertMethod.mediaUpload?.accept || [];
    const mediaChecks = mediaItems.map(item => {
      const isVideo = item.mediaType === 'video';
      const tooLarge = Boolean(maxBytes && isVideo && Number(item.size || 0) > maxBytes);
      return {
        mediaAssetId: item.mediaAssetId,
        originalName: item.originalName,
        mediaType: item.mediaType,
        mimeType: item.mimeType,
        size: item.size,
        accepted: isVideo && !tooLarge,
        tooLarge,
        maxBytes,
        exactMaxBytesKnown: Boolean(maxBytes),
        compressionAvailable: Boolean(isVideo && maxBytes),
        acceptedMimeTypes,
        message: !isVideo
          ? `${this.displayName} publishing requires video media.`
          : tooLarge
            ? `${this.displayName} discovery API reports this video is too large.`
            : `${this.displayName} discovery API accepted this media size.`
      };
    });
    const oversizedMedia = mediaChecks.filter(item => item.tooLarge);

    return okResult({
      platform: this.platform,
      displayName: this.displayName,
      source: 'provider_discovery_api',
      policyAvailable: Boolean(maxBytes),
      compressionSupported: oversizedMedia.length > 0,
      promptForCompression: oversizedMedia.length > 0,
      mediaChecks,
      oversizedMedia,
      prompts: oversizedMedia.map(item => ({
        mediaAssetId: item.mediaAssetId,
        mediaType: item.mediaType,
        mediaName: item.originalName,
        currentBytes: item.size,
        maxBytes: item.maxBytes,
        reason: `${item.originalName} exceeds the upload size returned by the YouTube discovery API.`
      }))
    }, `${this.displayName} upload policy was read from the YouTube discovery API.`);
  }

  isConfigured() {
    return Boolean(env.oauth.google.clientId && env.oauth.google.clientSecret);
  }

  getAuthorizationUrl({ state, redirectUri }) {
    if (!this.isConfigured()) return super.getAuthorizationUrl();
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', env.oauth.google.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', this.getRequiredScopes().join(' '));
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('state', state);
    return okResult({ authorizationUrl: url.toString() }, 'Redirect to Google OAuth.');
  }

  async exchangeCodeForToken({ code, redirectUri }) {
    const body = new URLSearchParams({
      client_id: env.oauth.google.clientId,
      client_secret: env.oauth.google.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    });
    const result = await this.requestJson('https://oauth2.googleapis.com/token', { method: 'POST', body });
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
      return connectorResult({ code: 'INVALID_CREDENTIALS', message: 'No stored YouTube refresh token was found. Reconnect this account.' });
    }

    const body = new URLSearchParams({
      client_id: env.oauth.google.clientId,
      client_secret: env.oauth.google.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    });
    const result = await this.requestJson('https://oauth2.googleapis.com/token', { method: 'POST', body });
    if (!result.ok) return result;
    return okResult({
      accessToken: result.data.access_token,
      refreshToken,
      expiresIn: result.data.expires_in,
      scopes: String(result.data.scope || connection.scopes?.join(' ') || '').split(/\s+/).filter(Boolean)
    }, 'YouTube access token refreshed.');
  }

  async fetchAccountProfileFromToken(tokenData) {
    const result = await this.requestJson('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
      headers: { Authorization: `Bearer ${tokenData.accessToken}` }
    });
    if (!result.ok) return result;
    const channel = result.data?.items?.[0];
    if (!channel) {
      return connectorResult({ code: 'MISSING_PERMISSIONS', message: 'No YouTube channel was returned for this Google account.' });
    }
    return okResult({
      accountName: channel.snippet?.title || 'YouTube Channel',
      accountHandle: channel.snippet?.customUrl || channel.id,
      externalAccountId: channel.id,
      accountType: 'channel',
      scopes: tokenData.scopes,
      platformMetadata: { thumbnails: channel.snippet?.thumbnails || {} }
    });
  }

  async healthCheck(connection) {
    const base = await super.healthCheck(connection);
    if (base.code !== 'CAPABILITY_UNAVAILABLE') return base;

    const token = this.getAccessToken(connection);
    if (!token) {
      return connectorResult({ code: 'INVALID_CREDENTIALS', message: 'No stored YouTube access token was found. Reconnect this account.' });
    }

    const result = await this.requestJson('https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!result.ok) return result;
    return okResult({ account: result.data?.items?.[0] || null }, 'YouTube token verified through the YouTube Data API.');
  }

  validatePublishPayload(payload, connection) {
    const base = super.validatePublishPayload(payload, connection);
    if (!base.ok) return base;
    const mediaAssets = payload.mediaAssets || [];
    const videos = mediaAssets.filter(asset => asset.mediaType === 'video');
    if (mediaAssets.length !== 1 || videos.length !== 1) {
      return connectorResult({
        code: 'VALIDATION_FAILED',
        message: `${this.displayName} publishing requires exactly one video media asset. CreatorOps will not silently drop extra or unsupported media.`
      });
    }
    if (!connection.scopes?.includes('https://www.googleapis.com/auth/youtube.upload')) {
      return connectorResult({ code: 'MISSING_PERMISSIONS', message: 'Missing YouTube upload scope.' });
    }
    return okResult({}, 'YouTube payload is publishable.');
  }

  async validateTargetMedia(payload) {
    if (this.platform !== 'youtube_shorts') {
      return okResult({}, 'YouTube standard video target accepted.');
    }

    const video = payload.mediaAssets?.find(asset => asset.mediaType === 'video');
    if (!video) {
      return connectorResult({ code: 'VALIDATION_FAILED', message: 'YouTube Shorts publishing requires a video media asset.' });
    }

    const storedMetadata = {
      width: Number(video.width) || null,
      height: Number(video.height) || null,
      durationSeconds: Number(video.durationSeconds) || null
    };
    const metadata = storedMetadata.width && storedMetadata.height && storedMetadata.durationSeconds
      ? storedMetadata
      : await inspectVideoMetadata(video.publicUrl);

    if (!metadata.width || !metadata.height || !metadata.durationSeconds) {
      return connectorResult({
        code: 'SHORTS_MEDIA_UNVERIFIED',
        message: 'CreatorOps could not verify the video dimensions and duration required for YouTube Shorts.'
      });
    }

    const eligibilityIssues = [];
    if (metadata.width > metadata.height) {
      eligibilityIssues.push(`square or vertical video (selected media is ${metadata.width}x${metadata.height})`);
    }
    if (metadata.durationSeconds > YOUTUBE_SHORTS_MAX_DURATION_SECONDS) {
      const minutes = Math.floor(metadata.durationSeconds / 60);
      const seconds = Math.floor(metadata.durationSeconds % 60);
      eligibilityIssues.push(`a duration of 3 minutes or less (selected media is ${minutes}:${String(seconds).padStart(2, '0')})`);
    }

    if (eligibilityIssues.length) {
      return connectorResult({
        code: 'SHORTS_MEDIA_INELIGIBLE',
        message: `YouTube Shorts requires ${eligibilityIssues.join(' and ')}. This media would publish as a standard YouTube video.`,
        data: metadata
      });
    }

    return okResult({ metadata }, 'Video meets YouTube Shorts shape and duration requirements.');
  }

  providerErrorResult(payload, status) {
    const providerError = payload?.error || {};
    const providerMessage =
      providerError.message ||
      providerError.errors?.[0]?.message ||
      payload?.message ||
      `YouTube API returned HTTP ${status}.`;
    return connectorResult({
      code: providerError.code ? String(providerError.code) : `HTTP_${status}`,
      message: providerMessage,
      data: { status, payload }
    });
  }

  uploadNetworkError(message, error) {
    return connectorResult({
      code: 'NETWORK_ERROR',
      message,
      data: {
        host: 'www.googleapis.com',
        networkError: error?.message || 'fetch failed',
        networkCauseCode: error?.cause?.code || ''
      }
    });
  }

  async startResumableUpload({ token, metadata, video, totalBytes, signal }) {
    let response;
    try {
      response = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Length': String(totalBytes),
          'X-Upload-Content-Type': video.mimeType || 'video/mp4'
        },
        body: JSON.stringify(metadata),
        signal
      });
    } catch (error) {
      return this.uploadNetworkError(`${this.displayName} could not start a resumable upload session. Retry publishing.`, error);
    }

    const payload = await parseResponseJsonSafe(response);
    if (!response.ok) return this.providerErrorResult(payload, response.status);

    const uploadUrl = response.headers.get('location');
    if (!uploadUrl) {
      return connectorResult({
        code: 'PROVIDER_RESPONSE_INVALID',
        message: `${this.displayName} accepted the upload request but did not return a resumable session URL.`,
        data: { payload }
      });
    }

    return okResult({ uploadUrl }, `${this.displayName} resumable upload session started.`);
  }

  async queryUploadOffset({ uploadUrl, token, totalBytes, signal }) {
    let response;
    try {
      response = await fetch(uploadUrl, {
        method: 'PUT',
        redirect: 'manual',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Length': '0',
          'Content-Range': `bytes */${totalBytes}`
        },
        signal
      });
    } catch (error) {
      return this.uploadNetworkError(`${this.displayName} upload was interrupted and its resumable session could not be checked. Retry publishing.`, error);
    }

    if (response.status === 308) {
      return okResult({
        completed: false,
        nextOffset: parseUploadedRangeEnd(response.headers.get('range')) + 1
      }, `${this.displayName} resumable upload can continue.`);
    }

    const payload = await parseResponseJsonSafe(response);
    if (!response.ok) return this.providerErrorResult(payload, response.status);
    return okResult({ completed: true, payload }, `${this.displayName} upload already completed.`);
  }

  getMediaFingerprint(video, totalBytes) {
    return [this.platform, video.objectKey, video.mimeType || '', totalBytes].join(':');
  }

  isReusableUploadSession(session, mediaFingerprint, totalBytes) {
    return Boolean(
      session?.uploadUrl &&
        session.mediaFingerprint === mediaFingerprint &&
        Number(session.totalBytes || 0) === totalBytes
    );
  }

  async saveProviderUploadSession(payload, updates = {}) {
    if (typeof payload?.saveProviderUploadSession !== 'function') return;
    await payload.saveProviderUploadSession({
      platform: this.platform,
      sessionType: 'youtube_resumable',
      ...updates
    });
  }

  async resolveResumableUploadSession({ payload, token, metadata, video, totalBytes, mediaFingerprint, signal }) {
    const existingSession = payload.providerUploadSession || {};

    if (this.isReusableUploadSession(existingSession, mediaFingerprint, totalBytes)) {
      await this.reportUploadProgress(payload, {
        phase: 'initializing',
        bytesUploaded: Number(existingSession.bytesUploaded || 0),
        totalBytes,
        message: `Checking saved ${this.displayName} resumable upload session before resuming.`
      });
      const checkedSession = await this.queryUploadOffset({
        uploadUrl: existingSession.uploadUrl,
        token,
        totalBytes,
        signal
      });
      if (!checkedSession.ok) return checkedSession;
      if (checkedSession.data.completed) return { ...checkedSession, resumed: true };

      const nextOffset = Math.max(0, Number(checkedSession.data.nextOffset || 0));
      await this.saveProviderUploadSession(payload, {
        uploadUrl: existingSession.uploadUrl,
        mediaFingerprint,
        totalBytes,
        bytesUploaded: nextOffset
      });
      return okResult(
        {
          uploadUrl: existingSession.uploadUrl,
          initialOffset: nextOffset
        },
        `${this.displayName} resumable upload session resumed from byte ${nextOffset}.`
      );
    }

    await this.reportUploadProgress(payload, {
      phase: 'initializing',
      bytesUploaded: 0,
      totalBytes,
      message: `Starting ${this.displayName} resumable media upload.`
    });
    const session = await this.startResumableUpload({
      token,
      metadata,
      video,
      totalBytes,
      signal
    });
    if (!session.ok) return session;
    await this.saveProviderUploadSession(payload, {
      uploadUrl: session.data.uploadUrl,
      mediaFingerprint,
      totalBytes,
      bytesUploaded: 0,
      startedAt: new Date()
    });
    return {
      ...session,
      data: {
        ...session.data,
        initialOffset: 0
      }
    };
  }

  async uploadVideoChunks({
    uploadUrl,
    token,
    video,
    totalBytes,
    initialOffset = 0,
    onUploadProgress,
    onProviderSessionProgress,
    checkPublishControl,
    signal
  }) {
    let offset = Math.max(0, Number(initialOffset || 0));

    while (offset < totalBytes) {
      if (typeof checkPublishControl === 'function') {
        const controlResult = await checkPublishControl();
        if (controlResult) return controlResult;
      }

      const chunkBytes = Math.min(YOUTUBE_UPLOAD_CHUNK_BYTES, totalBytes - offset);
      const lastByte = offset + chunkBytes - 1;
      let response;
      try {
        response = await fetch(uploadUrl, {
          method: 'PUT',
          redirect: 'manual',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Length': String(chunkBytes),
            'Content-Type': video.mimeType || 'video/mp4',
            'Content-Range': `bytes ${offset}-${lastByte}/${totalBytes}`
          },
          body: await video.createReadStream({ start: offset, end: lastByte }),
          duplex: 'half',
          signal
        });
      } catch (error) {
        if (typeof checkPublishControl === 'function') {
          const controlResult = await checkPublishControl();
          if (controlResult) return controlResult;
        }
        const session = await this.queryUploadOffset({ uploadUrl, token, totalBytes, signal });
        if (!session.ok) return session;
        if (session.data.completed) return session;
        offset = session.data.nextOffset;
        if (typeof onProviderSessionProgress === 'function') {
          await onProviderSessionProgress({ bytesUploaded: offset, totalBytes });
        }
        continue;
      }

      if (response.status === 308) {
        offset = parseUploadedRangeEnd(response.headers.get('range')) + 1;
        if (typeof onProviderSessionProgress === 'function') {
          await onProviderSessionProgress({ bytesUploaded: offset, totalBytes });
        }
        if (typeof onUploadProgress === 'function') {
          await onUploadProgress({ phase: 'uploading', bytesUploaded: offset, totalBytes });
        }
        continue;
      }

      const payload = await parseResponseJsonSafe(response);
      if (!response.ok) return this.providerErrorResult(payload, response.status);
      if (typeof onProviderSessionProgress === 'function') {
        await onProviderSessionProgress({ bytesUploaded: totalBytes, totalBytes });
      }
      if (typeof onUploadProgress === 'function') {
        await onUploadProgress({ phase: 'uploaded', bytesUploaded: totalBytes, totalBytes });
      }
      return okResult({ payload }, `${this.displayName} video upload completed.`);
    }

    return connectorResult({
      code: 'PROVIDER_RESPONSE_INVALID',
      message: `${this.displayName} upload ended without a final provider response.`
    });
  }

  async publish(payload, connection) {
    const validation = this.validatePublishPayload(payload, connection);
    if (!validation.ok) return validation;
    const targetValidation = await this.validateTargetMedia(payload, connection);
    if (!targetValidation.ok) return targetValidation;
    const video = payload.mediaAssets.find(asset => asset.mediaType === 'video');
    if (!video?.objectKey || typeof video.createReadStream !== 'function') {
      return connectorResult({ code: 'VALIDATION_FAILED', message: 'YouTube upload requires verified cloud media.' });
    }
    const token = this.getAccessToken(connection);
    const totalBytes = Number(video.size || 0);
    const mediaFingerprint = this.getMediaFingerprint(video, totalBytes);
    const privacyStatus = payload.visibility === 'public' ? 'public' : 'private';
    const metadata = {
      snippet: {
        title: payload.caption?.split('\n')[0]?.slice(0, 95) || 'CreatorOps upload',
        description: payload.caption || '',
        categoryId: '22'
      },
      status: { privacyStatus }
    };

    const session = await this.resolveResumableUploadSession({
      payload,
      token,
      metadata,
      video,
      totalBytes,
      mediaFingerprint,
      signal: payload.abortSignal
    });
    if (!session.ok) return session;
    if (session.data.completed) {
      const completedPayload = session.data.payload || {};
      await this.saveProviderUploadSession(payload, {
        uploadUrl: '',
        mediaFingerprint,
        totalBytes,
        bytesUploaded: totalBytes
      });
      return okResult({
        providerPostId: completedPayload.id,
        providerPostUrl: completedPayload.id ? `https://www.youtube.com/watch?v=${completedPayload.id}` : '',
        rawResponse: completedPayload
      }, `${this.displayName} upload had already completed on the provider.`);
    }

    const upload = await this.uploadVideoChunks({
      uploadUrl: session.data.uploadUrl,
      token,
      video,
      totalBytes,
      initialOffset: session.data.initialOffset || 0,
      onUploadProgress: payload.onUploadProgress,
      onProviderSessionProgress: progress =>
        this.saveProviderUploadSession(payload, {
          uploadUrl: session.data.uploadUrl,
          mediaFingerprint,
          totalBytes,
          ...progress
        }),
      checkPublishControl: payload.checkPublishControl,
      signal: payload.abortSignal
    });
    if (!upload.ok) return upload;
    const result = upload.data.payload || {};
    return okResult({
      providerPostId: result.id,
      providerPostUrl: result.id ? `https://www.youtube.com/watch?v=${result.id}` : '',
      rawResponse: result
    }, 'Video uploaded to YouTube through the official API.');
  }

  async deletePublishedPost(connection, providerPostId) {
    const scopeCheck = this.requireScopes(
      connection,
      ['https://www.googleapis.com/auth/youtube.force-ssl'],
      'delete YouTube videos'
    );
    if (!scopeCheck.ok) return scopeCheck;
    if (!providerPostId) {
      return connectorResult({ code: 'VALIDATION_FAILED', message: `${this.displayName} deletion requires a provider video id.` });
    }
    const result = await this.requestJson(
      `https://www.googleapis.com/youtube/v3/videos?id=${encodeURIComponent(providerPostId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.getAccessToken(connection)}` }
      }
    );
    if (!result.ok) return result;
    return okResult({ providerPostId }, `${this.displayName} video deleted through the official YouTube Data API.`);
  }

  async fetchComments(connection, providerPostId) {
    const scopeCheck = this.requireScopes(
      connection,
      ['https://www.googleapis.com/auth/youtube.force-ssl'],
      'sync and reply to YouTube comments'
    );
    if (!scopeCheck.ok) return scopeCheck;

    const token = this.getAccessToken(connection);
    const authHeaders = { Authorization: `Bearer ${token}` };
    const result = await this.requestJson(
      `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&videoId=${encodeURIComponent(providerPostId)}&maxResults=100&order=time&textFormat=plainText`,
      { headers: authHeaders }
    );
    if (!result.ok) return result;

    const comments = [];
    for (const thread of result.data?.items || []) {
      const topLevelComment = thread.snippet?.topLevelComment;
      if (!topLevelComment?.id) continue;

      comments.push(this.mapYouTubeComment(topLevelComment, {
        providerThreadId: thread.id,
        replyCount: Number(thread.snippet?.totalReplyCount || 0)
      }));

      if (Number(thread.snippet?.totalReplyCount || 0) > 0) {
        const repliesResult = await this.fetchCommentReplies({
          parentId: topLevelComment.id,
          providerThreadId: thread.id,
          headers: authHeaders
        });
        if (!repliesResult.ok) return repliesResult;
        comments.push(...repliesResult.data);
      }
    }

    return okResult(comments, `YouTube returned ${comments.length} real comment/reply record${comments.length === 1 ? '' : 's'}.`);
  }

  async fetchCommentReplies({ parentId, providerThreadId, headers }) {
    const replies = [];
    let pageToken = '';

    do {
      const url = new URL('https://www.googleapis.com/youtube/v3/comments');
      url.searchParams.set('part', 'snippet');
      url.searchParams.set('parentId', parentId);
      url.searchParams.set('maxResults', '100');
      url.searchParams.set('textFormat', 'plainText');
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const result = await this.requestJson(url.toString(), { headers });
      if (!result.ok) return result;

      replies.push(
        ...(result.data?.items || []).map(comment =>
          this.mapYouTubeComment(comment, {
            providerThreadId,
            parentProviderCommentId: parentId,
            isProviderReply: true
          })
        )
      );
      pageToken = result.data?.nextPageToken || '';
    } while (pageToken);

    return okResult(replies);
  }

  mapYouTubeComment(comment, options = {}) {
    const snippet = comment.snippet || {};
    return {
      providerCommentId: comment.id,
      providerThreadId: options.providerThreadId || '',
      parentProviderCommentId: options.parentProviderCommentId || '',
      isProviderReply: Boolean(options.isProviderReply),
      authorName: snippet.authorDisplayName || '',
      authorHandle: snippet.authorChannelUrl || snippet.authorChannelId?.value || '',
      text: snippet.textDisplay || snippet.textOriginal || '',
      likeCount: Number(snippet.likeCount || 0),
      replyCount: Number(options.replyCount || 0),
      providerCreatedAt: snippet.publishedAt ? new Date(snippet.publishedAt) : null,
      rawProviderData: comment
    };
  }

  async replyToComment(connection, providerCommentId, replyText) {
    const scopeCheck = this.requireScopes(
      connection,
      ['https://www.googleapis.com/auth/youtube.force-ssl'],
      'reply to YouTube comments'
    );
    if (!scopeCheck.ok) return scopeCheck;

    const token = this.getAccessToken(connection);
    const result = await this.requestJson('https://www.googleapis.com/youtube/v3/comments?part=snippet', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        snippet: {
          parentId: providerCommentId,
          textOriginal: replyText
        }
      })
    });
    if (!result.ok) return result;
    return okResult({ providerReplyId: result.data?.id || '', rawResponse: result.data });
  }

  getAccountProfileUrl(connection) {
    /* customUrl (`@handle`) is the friendlier address; channel id always resolves.
       The `@` stays literal — encoding it to %40 is what YouTube redirects away from. */
    const handle = String(connection?.accountHandle || '').trim();
    if (handle.startsWith('@')) return `https://www.youtube.com/@${encodeURIComponent(this.stripHandlePrefix(handle))}`;
    return connection?.externalAccountId
      ? `https://www.youtube.com/channel/${encodeURIComponent(connection.externalAccountId)}`
      : '';
  }

  async fetchAudienceMetrics(connection) {
    const scopeCheck = this.requireScopes(
      connection,
      ['https://www.googleapis.com/auth/youtube.readonly'],
      'read YouTube channel subscriber counts'
    );
    if (!scopeCheck.ok) return scopeCheck;

    const token = this.getAccessToken(connection);
    if (!token) {
      return connectorResult({ code: 'INVALID_CREDENTIALS', message: 'No stored YouTube access token was found. Reconnect this account.' });
    }

    const result = await this.requestJson('https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!result.ok) return result;

    const statistics = result.data?.items?.[0]?.statistics;
    if (!statistics) {
      return unavailableResult('YouTube did not return channel statistics for this account.');
    }
    /* hiddenSubscriberCount channels legitimately have no readable number. */
    const subscribers = statistics.hiddenSubscriberCount ? null : Number(statistics.subscriberCount || 0);
    if (subscribers === null) {
      return unavailableResult('This YouTube channel hides its subscriber count, so the number cannot be read.');
    }
    return okResult({
      followers: subscribers,
      subscribers,
      lifetimeViews: Number(statistics.viewCount || 0),
      raw: statistics
    }, 'YouTube subscriber count read through the YouTube Data API.');
  }

  /*
   * Media read back from YouTube. Nothing here is stored: this workspace
   * deletes its own copy once a post ships, and these URLs are the platform's
   * own and mostly expire. See BasePlatformConnector.fetchPostMedia.
   */
  async fetchPostMedia(connection, providerPostId) {
    if (!providerPostId) {
      return connectorResult({ code: 'VALIDATION_FAILED', message: 'YouTube media lookup requires a provider video id.' });
    }

    const scopeCheck = this.requireScopes(
      connection,
      ['https://www.googleapis.com/auth/youtube.readonly'],
      'read YouTube video media'
    );
    if (!scopeCheck.ok) return scopeCheck;

    const token = this.getAccessToken(connection);
    const result = await this.requestJson(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${encodeURIComponent(providerPostId)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!result.ok) return result;

    const video = result.data?.items?.[0];
    if (!video) {
      return connectorResult({
        code: 'NOT_FOUND',
        message: 'YouTube did not return this video. It may be private, deleted, or not owned by this account.'
      });
    }

    const thumbnails = video.snippet?.thumbnails || {};
    const best =
      thumbnails.maxres || thumbnails.standard || thumbnails.high || thumbnails.medium || thumbnails.default || {};

    /* The file itself is never downloadable, so the player embed is what plays. */
    return okResult({
      items: [
        {
          kind: 'video',
          embed: true,
          url: `https://www.youtube.com/embed/${encodeURIComponent(providerPostId)}`,
          thumbnailUrl: best.url || '',
          width: best.width || null,
          height: best.height || null,
          durationSeconds: null
        }
      ]
    });
  }

  async fetchAnalytics(connection, providerPostId) {
    if (!providerPostId) {
      return connectorResult({ code: 'VALIDATION_FAILED', message: 'YouTube analytics sync requires a provider video id.' });
    }

    const scopeCheck = this.requireScopes(
      connection,
      ['https://www.googleapis.com/auth/youtube.readonly'],
      'sync YouTube video statistics'
    );
    if (!scopeCheck.ok) return scopeCheck;

    const token = this.getAccessToken(connection);
    const result = await this.requestJson(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(providerPostId)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!result.ok) return result;

    const video = result.data?.items?.[0];
    if (!video) {
      return connectorResult({
        code: 'NOT_FOUND',
        message: 'YouTube did not return statistics for this video. It may be private, deleted, not owned by this account, or not processed yet.'
      });
    }

    const statistics = video.statistics || {};
    return okResult({
      likes: Number(statistics.likeCount || 0),
      reactions: Number(statistics.likeCount || 0),
      comments: Number(statistics.commentCount || 0),
      shares: 0,
      views: Number(statistics.viewCount || 0),
      saves: 0,
      rawResponse: result.data,
      unavailableFields: ['shares', 'saves']
    }, 'YouTube video statistics synced through the YouTube Data API.');
  }
}
