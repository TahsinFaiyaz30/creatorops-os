import fs from 'fs/promises';

import env from '../../config/env.js';
import BasePlatformConnector, { connectorResult, okResult } from '../BasePlatformConnector.js';

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
    return { publish: true, schedule: true, analytics: true, comments: true, replies: true, mediaUpload: true };
  }

  getHelperText() {
    return this.platform === 'youtube_shorts' ? 'Connect YouTube channel for Shorts' : 'Connect YouTube channel';
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

  validatePublishPayload(payload, connection) {
    const base = super.validatePublishPayload(payload, connection);
    if (!base.ok) return base;
    const video = payload.mediaAssets?.find(asset => asset.mediaType === 'video');
    if (!video) {
      return connectorResult({ code: 'VALIDATION_FAILED', message: 'YouTube publishing requires a video media asset.' });
    }
    if (!connection.scopes?.includes('https://www.googleapis.com/auth/youtube.upload')) {
      return connectorResult({ code: 'MISSING_PERMISSIONS', message: 'Missing YouTube upload scope.' });
    }
    return okResult({}, 'YouTube payload is publishable.');
  }

  async publish(payload, connection) {
    const validation = this.validatePublishPayload(payload, connection);
    if (!validation.ok) return validation;
    const video = payload.mediaAssets.find(asset => asset.mediaType === 'video');
    if (!video?.localPath) {
      return connectorResult({ code: 'VALIDATION_FAILED', message: 'YouTube upload requires the stored local video file.' });
    }
    const token = this.getAccessToken(connection);
    const fileBuffer = await fs.readFile(video.localPath);
    const privacyStatus = payload.visibility === 'public' ? 'public' : 'private';
    const metadata = {
      snippet: {
        title: payload.caption?.split('\n')[0]?.slice(0, 95) || 'CreatorOps upload',
        description: payload.caption || '',
        categoryId: '22'
      },
      status: { privacyStatus }
    };
    const boundary = `creatorops-${Date.now()}`;
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Type: ${video.mimeType || 'video/mp4'}\r\n\r\n`),
      fileBuffer,
      Buffer.from(`\r\n--${boundary}--`)
    ]);
    const result = await this.requestJson('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body
    });
    if (!result.ok) return result;
    return okResult({
      providerPostId: result.data.id,
      providerPostUrl: result.data.id ? `https://www.youtube.com/watch?v=${result.data.id}` : '',
      rawResponse: result.data
    }, 'Video uploaded to YouTube through the official API.');
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
