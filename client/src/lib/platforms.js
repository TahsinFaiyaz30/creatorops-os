export const platformOptions = [
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

export const platformLabels = {
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

export const platformCaptionLimits = {
  facebook: 1200,
  instagram: 500,
  tiktok: 300,
  youtube: 1800,
  youtube_shorts: 420,
  threads: 500,
  linkedin: 1800,
  x: 280,
  pinterest: 500,
  wordpress: 2500,
  shopify: 900
};

export const formatPlatform = platform => platformLabels[platform] || platform;

export const getPlatformCaptionLimit = platform => platformCaptionLimits[platform] || 1000;
