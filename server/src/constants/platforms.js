export const SUPPORTED_PLATFORMS = [
  'facebook',
  'instagram',
  'tiktok',
  'youtube',
  'youtube_shorts',
  'threads',
  'linkedin',
  'x',
  'pinterest',
  'wordpress',
  'shopify'
];

export const PLATFORM_ALIASES = {
  blog: 'wordpress',
  twitter: 'x'
};

export const PLATFORM_LABELS = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  youtube_shorts: 'YouTube Shorts',
  threads: 'Threads',
  linkedin: 'LinkedIn',
  x: 'X',
  pinterest: 'Pinterest',
  wordpress: 'WordPress / Blog',
  shopify: 'Shopify'
};

export const PLATFORM_CONNECTION_MODES = ['oauth', 'api_key', 'app_password', 'admin_token'];

export const PLATFORM_ACCOUNT_TYPES = [
  'page',
  'profile',
  'business',
  'creator',
  'channel',
  'organization',
  'board',
  'blog',
  'shop'
];

export const PLATFORM_CONNECTION_STATUSES = [
  'not_configured',
  'connecting',
  'connected',
  'expired',
  'missing_permissions',
  'disconnected',
  'blocked',
  'error'
];

export const normalizePlatform = platform => PLATFORM_ALIASES[platform] || platform;

export const normalizePlatforms = platforms =>
  [
    ...new Set(
      (Array.isArray(platforms) ? platforms : [])
        .map(platform => normalizePlatform(platform))
        .filter(platform => SUPPORTED_PLATFORMS.includes(platform))
    )
  ];
