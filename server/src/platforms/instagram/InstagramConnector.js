import env from '../../config/env.js';
import BasePlatformConnector, { connectorResult, okResult } from '../BasePlatformConnector.js';

const GRAPH_VERSION = 'v20.0';

export default class InstagramConnector extends BasePlatformConnector {
  constructor() {
    super('instagram', 'Instagram');
  }

  getRequiredEnv() {
    return ['INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET'];
  }

  getRequiredScopes() {
    return ['instagram_basic', 'instagram_content_publish', 'instagram_manage_comments', 'pages_show_list'];
  }

  getCapabilities() {
    return { publish: true, schedule: true, analytics: true, comments: true, replies: true, mediaUpload: true, delete: false };
  }

  getHelperText() {
    return 'Connect Instagram professional account';
  }

  isConfigured() {
    return Boolean(env.oauth.instagram.appId && env.oauth.instagram.appSecret);
  }

  getAuthorizationUrl({ state, redirectUri }) {
    if (!this.isConfigured()) return super.getAuthorizationUrl();
    const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
    url.searchParams.set('client_id', env.oauth.instagram.appId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('scope', this.getRequiredScopes().join(','));
    return okResult({ authorizationUrl: url.toString() }, 'Redirect to Meta OAuth for Instagram.');
  }

  async exchangeCodeForToken({ code, redirectUri }) {
    const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
    url.searchParams.set('client_id', env.oauth.instagram.appId);
    url.searchParams.set('client_secret', env.oauth.instagram.appSecret);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('code', code);
    const result = await this.requestJson(url);
    if (!result.ok) return result;
    const longLived = await this.requestJson(
      `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(env.oauth.instagram.appId)}&client_secret=${encodeURIComponent(env.oauth.instagram.appSecret)}&fb_exchange_token=${encodeURIComponent(result.data.access_token)}`
    );
    const tokenData = longLived.ok ? longLived.data : result.data;
    return okResult({
      accessToken: tokenData.access_token,
      expiresIn: tokenData.expires_in,
      scopes: this.getRequiredScopes()
    });
  }

  async fetchAccountProfileFromToken(tokenData) {
    const pages = await this.requestJson(
      `https://graph.facebook.com/${GRAPH_VERSION}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name}&access_token=${encodeURIComponent(tokenData.accessToken)}`
    );
    if (!pages.ok) return pages;
    const page = (pages.data?.data || []).find(item => item.instagram_business_account);
    const account = page?.instagram_business_account;
    if (!account) {
      return connectorResult({
        code: 'MISSING_PERMISSIONS',
        message: 'No Instagram professional account was returned. Connect a Business or Creator account to a Facebook Page.'
      });
    }
    return okResult({
      accountName: account.name || account.username || 'Instagram Account',
      accountHandle: account.username ? `@${account.username}` : account.id,
      externalAccountId: account.id,
      accountType: 'business',
      accessToken: page.access_token || tokenData.accessToken,
      scopes: tokenData.scopes,
      platformMetadata: { pageId: page.id, pageName: page.name }
    });
  }

  validatePublishPayload(payload, connection) {
    const base = super.validatePublishPayload(payload, connection);
    if (!base.ok) return base;
    const mediaAssets = payload.mediaAssets || [];
    const supportedMedia = mediaAssets.filter(asset => asset.publicUrl && ['image', 'video'].includes(asset.mediaType));
    if (mediaAssets.length !== 1 || supportedMedia.length !== 1) {
      return connectorResult({
        code: 'VALIDATION_FAILED',
        message: 'Instagram Graph publishing requires exactly one uploaded image or video with a public URL. CreatorOps will not silently drop extra media.'
      });
    }
    return okResult({}, 'Instagram payload is publishable.');
  }

  async healthCheck(connection) {
    const base = await super.healthCheck(connection);
    if (base.code !== 'CAPABILITY_UNAVAILABLE') return base;

    const token = this.getAccessToken(connection);
    if (!token) {
      return connectorResult({ code: 'INVALID_CREDENTIALS', message: 'No stored Instagram access token was found. Reconnect this account.' });
    }

    const result = await this.requestJson(
      `https://graph.facebook.com/${GRAPH_VERSION}/${connection.externalAccountId}?fields=id,username,name&access_token=${encodeURIComponent(token)}`
    );
    if (!result.ok) return result;
    return okResult({ account: result.data }, 'Instagram token verified through the Graph API.');
  }

  async publish(payload, connection) {
    const validation = this.validatePublishPayload(payload, connection);
    if (!validation.ok) return validation;
    const token = this.getAccessToken(connection);
    const media = payload.mediaAssets.find(asset => asset.publicUrl && ['image', 'video'].includes(asset.mediaType));
    const createBody = new URLSearchParams({
      access_token: token,
      caption: payload.caption || ''
    });
    createBody.set(media.mediaType === 'video' ? 'video_url' : 'image_url', media.publicUrl);
    if (media.mediaType === 'video') createBody.set('media_type', 'REELS');
    const controlBeforeContainer = await this.checkPublishControl(payload);
    if (controlBeforeContainer) return controlBeforeContainer;
    await this.reportRemoteMediaIngestStart(payload, 'Instagram is ingesting cloud media from CreatorOps.');
    const container = await this.requestJson(`https://graph.facebook.com/${GRAPH_VERSION}/${connection.externalAccountId}/media`, {
      method: 'POST',
      body: createBody,
      signal: payload.abortSignal
    });
    if (!container.ok) return container;
    const controlBeforePublish = await this.checkPublishControl(payload);
    if (controlBeforePublish) return controlBeforePublish;
    const publishBody = new URLSearchParams({
      access_token: token,
      creation_id: container.data.id
    });
    const published = await this.requestJson(`https://graph.facebook.com/${GRAPH_VERSION}/${connection.externalAccountId}/media_publish`, {
      method: 'POST',
      body: publishBody,
      signal: payload.abortSignal
    });
    if (!published.ok) return published;
    await this.reportRemoteMediaIngestComplete(payload, 'Instagram accepted the cloud media.');
    return okResult({
      providerPostId: published.data?.id || '',
      providerPostUrl: '',
      rawResponse: { container: container.data, published: published.data }
    }, 'Instagram media published through the official API.');
  }

  async fetchAnalytics(connection, providerPostId) {
    const token = this.getAccessToken(connection);
    const result = await this.requestJson(
      `https://graph.facebook.com/${GRAPH_VERSION}/${providerPostId}/insights?metric=comments,likes,saved,shares,views&access_token=${encodeURIComponent(token)}`
    );
    if (!result.ok) return result;
    const metrics = Object.fromEntries((result.data?.data || []).map(item => [item.name, item.values?.[0]?.value || 0]));
    return okResult({
      likes: metrics.likes || 0,
      reactions: metrics.likes || 0,
      comments: metrics.comments || 0,
      shares: metrics.shares || 0,
      views: metrics.views || 0,
      saves: metrics.saved || 0,
      raw: result.data
    });
  }

  async fetchComments(connection, providerPostId) {
    const token = this.getAccessToken(connection);
    const result = await this.requestJson(
      `https://graph.facebook.com/${GRAPH_VERSION}/${providerPostId}/comments?fields=id,username,text,like_count,timestamp,replies{id,username,text,like_count,timestamp}&access_token=${encodeURIComponent(token)}`
    );
    if (!result.ok) return result;
    const comments = [];
    for (const comment of result.data?.data || []) {
      comments.push(this.mapInstagramComment(comment));
      comments.push(
        ...(comment.replies?.data || []).map(reply =>
          this.mapInstagramComment(reply, {
            providerThreadId: comment.id,
            parentProviderCommentId: comment.id,
            isProviderReply: true
          })
        )
      );
    }
    return okResult(comments);
  }

  mapInstagramComment(comment, options = {}) {
    return {
      providerCommentId: comment.id,
      providerThreadId: options.providerThreadId || comment.id,
      parentProviderCommentId: options.parentProviderCommentId || '',
      isProviderReply: Boolean(options.isProviderReply),
      authorName: comment.username || '',
      authorHandle: comment.username ? `@${comment.username}` : '',
      text: comment.text || '',
      likeCount: comment.like_count || 0,
      replyCount: comment.replies?.data?.length || 0,
      providerCreatedAt: comment.timestamp ? new Date(comment.timestamp) : null,
      rawProviderData: comment
    };
  }

  async replyToComment(connection, providerCommentId, replyText) {
    const token = this.getAccessToken(connection);
    const body = new URLSearchParams({ access_token: token, message: replyText });
    const result = await this.requestJson(`https://graph.facebook.com/${GRAPH_VERSION}/${providerCommentId}/replies`, {
      method: 'POST',
      body
    });
    if (!result.ok) return result;
    return okResult({ providerReplyId: result.data?.id || '', rawResponse: result.data });
  }
}
