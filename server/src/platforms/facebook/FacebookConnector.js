import env from '../../config/env.js';
import BasePlatformConnector, { connectorResult, okResult, unavailableResult } from '../BasePlatformConnector.js';

const GRAPH_VERSION = 'v20.0';

export default class FacebookConnector extends BasePlatformConnector {
  constructor() {
    super('facebook', 'Facebook');
  }

  getRequiredEnv() {
    return ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'];
  }

  getRequiredScopes() {
    return ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'];
  }

  getCapabilities() {
    return { publish: true, schedule: true, analytics: true, comments: true, replies: true, mediaUpload: true };
  }

  getHelperText() {
    return 'Connect Facebook Page';
  }

  isConfigured() {
    return Boolean(env.oauth.facebook.appId && env.oauth.facebook.appSecret);
  }

  getAuthorizationUrl({ state, redirectUri }) {
    if (!this.isConfigured()) return super.getAuthorizationUrl();
    const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
    url.searchParams.set('client_id', env.oauth.facebook.appId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('scope', this.getRequiredScopes().join(','));
    return okResult({ authorizationUrl: url.toString() }, 'Redirect to Facebook OAuth.');
  }

  async exchangeCodeForToken({ code, redirectUri }) {
    const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
    url.searchParams.set('client_id', env.oauth.facebook.appId);
    url.searchParams.set('client_secret', env.oauth.facebook.appSecret);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('code', code);
    const result = await this.requestJson(url);
    if (!result.ok) return result;
    return okResult({
      accessToken: result.data.access_token,
      expiresIn: result.data.expires_in,
      scopes: this.getRequiredScopes()
    });
  }

  async fetchAccountProfileFromToken(tokenData) {
    const pages = await this.requestJson(
      `https://graph.facebook.com/${GRAPH_VERSION}/me/accounts?fields=id,name,access_token,tasks&access_token=${encodeURIComponent(tokenData.accessToken)}`
    );
    if (!pages.ok) return pages;
    const page = pages.data?.data?.[0];
    if (!page) {
      return connectorResult({
        code: 'MISSING_PERMISSIONS',
        message: 'No Facebook Page was returned. Grant Page access and required permissions.'
      });
    }
    return okResult({
      accountName: page.name,
      accountHandle: page.name,
      externalAccountId: page.id,
      accountType: 'page',
      accessToken: page.access_token || tokenData.accessToken,
      scopes: tokenData.scopes,
      platformMetadata: { tasks: page.tasks || [] }
    });
  }

  validatePublishPayload(payload, connection) {
    const base = super.validatePublishPayload(payload, connection);
    if (!base.ok) return base;
    if (!payload.caption && !payload.mediaAssets?.length) {
      return connectorResult({ code: 'VALIDATION_FAILED', message: 'Facebook publishing requires caption text or media.' });
    }
    return okResult({}, 'Facebook payload is publishable.');
  }

  async publish(payload, connection) {
    const validation = this.validatePublishPayload(payload, connection);
    if (!validation.ok) return validation;
    const token = this.getAccessToken(connection);
    const pageId = connection.externalAccountId;
    const image = payload.mediaAssets?.find(asset => asset.mediaType === 'image' && asset.publicUrl);
    const endpoint = image
      ? `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/photos`
      : `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/feed`;
    const body = new URLSearchParams();
    body.set('access_token', token);
    if (image) body.set('url', image.publicUrl);
    body.set(image ? 'caption' : 'message', payload.caption || '');
    const result = await this.requestJson(endpoint, { method: 'POST', body });
    if (!result.ok) return result;
    const postId = result.data.post_id || result.data.id;
    return okResult({
      providerPostId: postId,
      providerPostUrl: postId ? `https://www.facebook.com/${postId}` : '',
      rawResponse: result.data
    }, 'Facebook post published through the official API.');
  }

  async fetchAnalytics(connection, providerPostId) {
    const token = this.getAccessToken(connection);
    const result = await this.requestJson(
      `https://graph.facebook.com/${GRAPH_VERSION}/${providerPostId}?fields=reactions.summary(true),comments.summary(true),shares&access_token=${encodeURIComponent(token)}`
    );
    if (!result.ok) return result;
    return okResult({
      likes: result.data?.reactions?.summary?.total_count || 0,
      reactions: result.data?.reactions?.summary?.total_count || 0,
      comments: result.data?.comments?.summary?.total_count || 0,
      shares: result.data?.shares?.count || 0,
      views: 0,
      saves: 0,
      raw: result.data
    });
  }

  async fetchComments(connection, providerPostId) {
    const token = this.getAccessToken(connection);
    const result = await this.requestJson(
      `https://graph.facebook.com/${GRAPH_VERSION}/${providerPostId}/comments?fields=id,from,message,like_count,comment_count,created_time&access_token=${encodeURIComponent(token)}`
    );
    if (!result.ok) return result;
    return okResult((result.data?.data || []).map(comment => ({
      providerCommentId: comment.id,
      authorName: comment.from?.name || '',
      authorHandle: comment.from?.id || '',
      text: comment.message || '',
      likeCount: comment.like_count || 0,
      replyCount: comment.comment_count || 0,
      providerCreatedAt: comment.created_time ? new Date(comment.created_time) : null,
      rawProviderData: comment
    })));
  }

  async replyToComment(connection, providerCommentId, replyText) {
    if (!replyText) return connectorResult({ code: 'VALIDATION_FAILED', message: 'Reply text is required.' });
    const token = this.getAccessToken(connection);
    const body = new URLSearchParams({ access_token: token, message: replyText });
    const result = await this.requestJson(`https://graph.facebook.com/${GRAPH_VERSION}/${providerCommentId}/comments`, {
      method: 'POST',
      body
    });
    if (!result.ok) return result;
    return okResult({ providerReplyId: result.data?.id || '', rawResponse: result.data });
  }
}
