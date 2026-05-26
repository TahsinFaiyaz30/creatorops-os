import env from '../../config/env.js';
import BasePlatformConnector, { connectorResult, okResult } from '../BasePlatformConnector.js';

export default class WordPressConnector extends BasePlatformConnector {
  constructor() {
    super('wordpress', 'WordPress / Blog');
  }

  getRequiredEnv() {
    return ['WORDPRESS_BASE_URL', 'WORDPRESS_USERNAME', 'WORDPRESS_APP_PASSWORD'];
  }

  getRequiredScopes() {
    return ['WordPress application password with post/comment permissions'];
  }

  getCapabilities() {
    return { publish: true, schedule: true, analytics: false, comments: true, replies: true, mediaUpload: false };
  }

  getHelperText() {
    return 'Connect WordPress site';
  }

  isConfigured() {
    return Boolean(env.oauth.wordpress.baseUrl && env.oauth.wordpress.username && env.oauth.wordpress.appPassword);
  }

  async createConnectionFromEnv() {
    if (!this.isConfigured()) return super.getAuthorizationUrl();
    const auth = Buffer.from(`${env.oauth.wordpress.username}:${env.oauth.wordpress.appPassword}`).toString('base64');
    const result = await this.requestJson(`${env.oauth.wordpress.baseUrl.replace(/\/$/, '')}/wp-json/wp/v2/users/me`, {
      headers: { Authorization: `Basic ${auth}` }
    });
    if (!result.ok) return result;
    return okResult({
      accessToken: '',
      appPassword: env.oauth.wordpress.appPassword,
      accountName: result.data.name || env.oauth.wordpress.baseUrl,
      accountHandle: env.oauth.wordpress.baseUrl,
      externalAccountId: String(result.data.id || env.oauth.wordpress.username),
      accountType: 'blog',
      scopes: this.getRequiredScopes(),
      platformMetadata: {
        baseUrl: env.oauth.wordpress.baseUrl.replace(/\/$/, ''),
        username: env.oauth.wordpress.username
      }
    }, 'WordPress application password verified through the REST API.');
  }

  validatePublishPayload(payload, connection) {
    const base = super.validatePublishPayload(payload, connection);
    if (!base.ok) return base;
    if (!payload.caption) return connectorResult({ code: 'VALIDATION_FAILED', message: 'WordPress publishing requires post content.' });
    return okResult({}, 'WordPress payload is publishable.');
  }

  async publish(payload, connection) {
    const validation = this.validatePublishPayload(payload, connection);
    if (!validation.ok) return validation;
    const auth = Buffer.from(`${connection.platformMetadata.username}:${this.getAppPassword(connection)}`).toString('base64');
    const baseUrl = connection.platformMetadata.baseUrl;
    const title = payload.caption.split('\n')[0].slice(0, 120) || 'CreatorOps post';
    const result = await this.requestJson(`${baseUrl}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title,
        content: payload.caption,
        status: 'draft'
      })
    });
    if (!result.ok) return result;
    return okResult({
      providerPostId: String(result.data.id || ''),
      providerPostUrl: result.data.link || '',
      rawResponse: result.data
    }, 'WordPress draft created through the REST API.');
  }

  async fetchComments(connection, providerPostId) {
    const auth = Buffer.from(`${connection.platformMetadata.username}:${this.getAppPassword(connection)}`).toString('base64');
    const result = await this.requestJson(`${connection.platformMetadata.baseUrl}/wp-json/wp/v2/comments?post=${providerPostId}`, {
      headers: { Authorization: `Basic ${auth}` }
    });
    if (!result.ok) return result;
    return okResult((Array.isArray(result.data) ? result.data : []).map(comment => {
      const parentId = comment.parent ? String(comment.parent) : '';
      return {
        providerCommentId: String(comment.id),
        providerThreadId: parentId || String(comment.id),
        parentProviderCommentId: parentId,
        isProviderReply: Boolean(parentId),
        authorName: comment.author_name || '',
        authorHandle: comment.author_url || '',
        text: comment.content?.rendered || '',
        likeCount: 0,
        replyCount: 0,
        providerCreatedAt: comment.date ? new Date(comment.date) : null,
        rawProviderData: comment
      };
    }));
  }

  async replyToComment(connection, providerCommentId, replyText) {
    const auth = Buffer.from(`${connection.platformMetadata.username}:${this.getAppPassword(connection)}`).toString('base64');
    const result = await this.requestJson(`${connection.platformMetadata.baseUrl}/wp-json/wp/v2/comments`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parent: providerCommentId,
        content: replyText
      })
    });
    if (!result.ok) return result;
    return okResult({ providerReplyId: String(result.data.id || ''), rawResponse: result.data });
  }
}
