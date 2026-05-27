import dotenv from 'dotenv';

dotenv.config();

const parseClientUrls = () => {
  const primary = process.env.CLIENT_URL || 'http://localhost:3000';
  const rawUrls = process.env.CLIENT_URLS || primary;
  const extractedUrls = rawUrls.match(/https?:\/\/[^\s,\])]+/g);
  const urls = (extractedUrls || rawUrls.split(','))
    .map(url => url.trim().replace(/^[\[(]+|[\])]+$/g, ''))
    .filter(Boolean)
    .map(url => {
      try {
        return new URL(url).origin;
      } catch (_error) {
        return '';
      }
    })
    .filter(Boolean);

  return [...new Set([primary, ...(urls.length ? urls : [])])];
};

const clientUrls = parseClientUrls();

const parseBoolean = value => ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/creatorops_os',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrl: process.env.CLIENT_URL || clientUrls[0],
  clientUrls,
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:5000',
  mediaUploadLimitBytes: process.env.MEDIA_UPLOAD_LIMIT_BYTES ? Number(process.env.MEDIA_UPLOAD_LIMIT_BYTES) : undefined,
  mediaStorage: {
    provider: 's3',
    signedUrlExpiresSeconds: Math.max(60, Number(process.env.MEDIA_SIGNED_URL_EXPIRES_SECONDS || 60 * 60 * 6)),
    s3: {
      endpoint: process.env.MEDIA_S3_ENDPOINT || process.env.S3_ENDPOINT || process.env.R2_ENDPOINT || process.env.CLOUDFLARE_R2_ENDPOINT || '',
      region: process.env.MEDIA_S3_REGION || process.env.S3_REGION || process.env.R2_REGION || process.env.CLOUDFLARE_R2_REGION || 'auto',
      bucket: process.env.MEDIA_S3_BUCKET || process.env.S3_BUCKET || process.env.R2_BUCKET || process.env.CLOUDFLARE_R2_BUCKET || '',
      accessKeyId: process.env.MEDIA_S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.MEDIA_S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
      publicBaseUrl: (process.env.MEDIA_S3_PUBLIC_BASE_URL || process.env.S3_PUBLIC_BASE_URL || process.env.R2_PUBLIC_BASE_URL || process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL || '').replace(/\/+$/, ''),
      keyPrefix: (process.env.MEDIA_S3_KEY_PREFIX || process.env.S3_KEY_PREFIX || process.env.R2_KEY_PREFIX || process.env.CLOUDFLARE_R2_KEY_PREFIX || '').replace(/^\/+|\/+$/g, ''),
      forcePathStyle: parseBoolean(process.env.MEDIA_S3_FORCE_PATH_STYLE || process.env.S3_FORCE_PATH_STYLE || process.env.R2_FORCE_PATH_STYLE || process.env.CLOUDFLARE_R2_FORCE_PATH_STYLE || 'true')
    }
  },
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
  groqApiKey: process.env.GROQ_API_KEY || '',
  aiProvider: (process.env.AI_PROVIDER || 'auto').toLowerCase(),
  aiFallback: process.env.AI_FALLBACK || 'template',
  aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS || 8000),
  oauth: {
    meta: {
      appId: process.env.META_APP_ID || '',
      appSecret: process.env.META_APP_SECRET || '',
      redirectUri: process.env.META_REDIRECT_URI || 'http://localhost:5000/api/oauth/meta/callback'
    },
    facebook: {
      appId: process.env.FACEBOOK_APP_ID || process.env.META_APP_ID || '',
      appSecret: process.env.FACEBOOK_APP_SECRET || process.env.META_APP_SECRET || '',
      redirectUri: process.env.FACEBOOK_REDIRECT_URI || 'http://localhost:5000/api/oauth/facebook/callback'
    },
    instagram: {
      appId: process.env.INSTAGRAM_APP_ID || process.env.META_APP_ID || '',
      appSecret: process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET || '',
      redirectUri: process.env.INSTAGRAM_REDIRECT_URI || 'http://localhost:5000/api/oauth/instagram/callback'
    },
    threads: {
      appId: process.env.THREADS_APP_ID || '',
      appSecret: process.env.THREADS_APP_SECRET || '',
      redirectUri: process.env.THREADS_REDIRECT_URI || 'http://localhost:5000/api/oauth/threads/callback'
    },
    tiktok: {
      clientKey: process.env.TIKTOK_CLIENT_KEY || '',
      clientSecret: process.env.TIKTOK_CLIENT_SECRET || '',
      redirectUri: process.env.TIKTOK_REDIRECT_URI || 'http://localhost:5000/api/oauth/tiktok/callback'
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/oauth/google/callback'
    },
    linkedin: {
      clientId: process.env.LINKEDIN_CLIENT_ID || '',
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
      redirectUri: process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:5000/api/oauth/linkedin/callback',
      apiVersion: process.env.LINKEDIN_API_VERSION || '202405'
    },
    x: {
      clientId: process.env.X_CLIENT_ID || '',
      clientSecret: process.env.X_CLIENT_SECRET || '',
      redirectUri: process.env.X_REDIRECT_URI || 'http://127.0.0.1:5000/api/oauth/x/callback'
    },
    pinterest: {
      clientId: process.env.PINTEREST_CLIENT_ID || '',
      clientSecret: process.env.PINTEREST_CLIENT_SECRET || '',
      redirectUri: process.env.PINTEREST_REDIRECT_URI || 'http://localhost:5000/api/oauth/pinterest/callback'
    },
    wordpress: {
      baseUrl: process.env.WORDPRESS_BASE_URL || '',
      username: process.env.WORDPRESS_USERNAME || '',
      appPassword: process.env.WORDPRESS_APP_PASSWORD || ''
    },
    shopify: {
      shopDomain: process.env.SHOPIFY_SHOP_DOMAIN || '',
      adminAccessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || '',
      apiKey: process.env.SHOPIFY_API_KEY || '',
      apiSecret: process.env.SHOPIFY_API_SECRET || '',
      redirectUri: process.env.SHOPIFY_REDIRECT_URI || 'http://localhost:5000/api/oauth/shopify/callback'
    }
  }
};

export const validateEnv = () => {
  const missing = [];

  if (!env.mongoUri) missing.push('MONGO_URI');
  if (!env.jwtSecret) missing.push('JWT_SECRET');
  if (env.mediaStorage.provider === 's3') {
    if (!env.mediaStorage.s3.bucket) missing.push('MEDIA_S3_BUCKET');
    if (!env.mediaStorage.s3.accessKeyId) missing.push('MEDIA_S3_ACCESS_KEY_ID');
    if (!env.mediaStorage.s3.secretAccessKey) missing.push('MEDIA_S3_SECRET_ACCESS_KEY');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

export default env;
