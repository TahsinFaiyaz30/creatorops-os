import env from '../../config/env.js';
import BasePlatformConnector, { connectorResult, okResult, unavailableResult } from '../BasePlatformConnector.js';

const SHOPIFY_API_VERSION = '2024-10';

export default class ShopifyConnector extends BasePlatformConnector {
  constructor() {
    super('shopify', 'Shopify');
  }

  getRequiredEnv() {
    return ['SHOPIFY_SHOP_DOMAIN', 'SHOPIFY_ADMIN_ACCESS_TOKEN'];
  }

  getRequiredScopes() {
    return ['write_content', 'read_content'];
  }

  getCapabilities() {
    return { publish: true, schedule: true, analytics: false, comments: false, replies: false, mediaUpload: false };
  }

  getHelperText() {
    return 'Connect Shopify store content';
  }

  isConfigured() {
    return Boolean(env.oauth.shopify.shopDomain && env.oauth.shopify.adminAccessToken);
  }

  async createConnectionFromEnv() {
    if (!this.isConfigured()) return super.getAuthorizationUrl();
    const result = await this.requestJson(`https://${env.oauth.shopify.shopDomain}/admin/api/${SHOPIFY_API_VERSION}/shop.json`, {
      headers: { 'X-Shopify-Access-Token': env.oauth.shopify.adminAccessToken }
    });
    if (!result.ok) return result;
    const shop = result.data.shop || {};
    return okResult({
      apiSecret: env.oauth.shopify.adminAccessToken,
      accountName: shop.name || env.oauth.shopify.shopDomain,
      accountHandle: env.oauth.shopify.shopDomain,
      externalAccountId: String(shop.id || env.oauth.shopify.shopDomain),
      accountType: 'shop',
      scopes: this.getRequiredScopes(),
      platformMetadata: { shopDomain: env.oauth.shopify.shopDomain }
    }, 'Shopify Admin API token verified.');
  }

  getAuthorizationUrl({ state, redirectUri }) {
    if (!env.oauth.shopify.shopDomain || !env.oauth.shopify.apiKey || !env.oauth.shopify.apiSecret) {
      return super.getAuthorizationUrl();
    }
    const url = new URL(`https://${env.oauth.shopify.shopDomain}/admin/oauth/authorize`);
    url.searchParams.set('client_id', env.oauth.shopify.apiKey);
    url.searchParams.set('scope', this.getRequiredScopes().join(','));
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    return okResult({ authorizationUrl: url.toString() }, 'Redirect to Shopify OAuth.');
  }

  validatePublishPayload(payload, connection) {
    const base = super.validatePublishPayload(payload, connection);
    if (!base.ok) return base;
    if (!payload.caption) return connectorResult({ code: 'VALIDATION_FAILED', message: 'Shopify content publishing requires article content.' });
    return okResult({}, 'Shopify payload is publishable.');
  }

  async healthCheck(connection) {
    const base = await super.healthCheck(connection);
    if (base.code !== 'CAPABILITY_UNAVAILABLE') return base;

    const shopDomain = connection.platformMetadata?.shopDomain;
    const token = this.getApiSecret(connection);

    if (!shopDomain || !token) {
      return connectorResult({ code: 'INVALID_CREDENTIALS', message: 'Stored Shopify credentials are incomplete. Reconnect this shop.' });
    }

    const result = await this.requestJson(`https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/shop.json`, {
      headers: { 'X-Shopify-Access-Token': token }
    });
    if (!result.ok) return result;
    return okResult({ account: result.data?.shop || {} }, 'Shopify Admin API token verified.');
  }

  async publish(payload, connection) {
    const validation = this.validatePublishPayload(payload, connection);
    if (!validation.ok) return validation;
    const shopDomain = connection.platformMetadata.shopDomain;
    const token = this.getApiSecret(connection);
    const controlBeforeBlogs = await this.checkPublishControl(payload);
    if (controlBeforeBlogs) return controlBeforeBlogs;
    const blogs = await this.requestJson(`https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/blogs.json`, {
      headers: { 'X-Shopify-Access-Token': token },
      signal: payload.abortSignal
    });
    if (!blogs.ok) return blogs;
    const blog = blogs.data?.blogs?.[0];
    if (!blog) {
      return connectorResult({ code: 'MISSING_CONFIGURATION', message: 'No Shopify blog exists for article publishing.' });
    }
    const title = payload.caption.split('\n')[0].slice(0, 120) || 'CreatorOps article';
    const controlBeforeArticle = await this.checkPublishControl(payload);
    if (controlBeforeArticle) return controlBeforeArticle;
    const result = await this.requestJson(`https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/blogs/${blog.id}/articles.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        article: {
          title,
          body_html: payload.caption,
          published: false
        }
      }),
      signal: payload.abortSignal
    });
    if (!result.ok) return result;
    return okResult({
      providerPostId: String(result.data?.article?.id || ''),
      providerPostUrl: result.data?.article?.admin_graphql_api_id || '',
      rawResponse: result.data
    }, 'Shopify blog article draft created through the Admin API.');
  }

  async fetchAnalytics() {
    return unavailableResult('Shopify content analytics are not available from this connector.');
  }
}
