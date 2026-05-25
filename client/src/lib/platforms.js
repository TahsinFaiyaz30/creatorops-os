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
  'blog',
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
  blog: 'Blog',
  shopify: 'Shopify'
};

export const formatPlatform = platform => platformLabels[platform] || platform;
