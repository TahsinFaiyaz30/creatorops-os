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
  'blog',
  'shopify'
];

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
  blog: 'Blog',
  shopify: 'Shopify'
};

export const adapterByPlatform = {
  facebook: 'FacebookAdapterSimulator',
  instagram: 'InstagramAdapterSimulator',
  tiktok: 'TikTokAdapterSimulator',
  youtube: 'YouTubeAdapterSimulator',
  youtube_shorts: 'YouTubeShortsAdapterSimulator',
  threads: 'ThreadsAdapterSimulator',
  linkedin: 'LinkedInAdapterSimulator',
  x: 'XAdapterSimulator',
  pinterest: 'PinterestAdapterSimulator',
  blog: 'BlogAdapterSimulator',
  shopify: 'ShopifyAdapterSimulator'
};

export const normalizePlatforms = platforms =>
  (Array.isArray(platforms) ? platforms : []).filter(platform => SUPPORTED_PLATFORMS.includes(platform));
