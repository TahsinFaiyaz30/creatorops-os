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

export const platformDetails = {
  facebook: {
    contentStyle: 'Community-style post with context and an engagement prompt.',
    ctaStyle: 'Ask for comments, shares, or discussion.',
    requirements: ['Clear topic', 'Community angle', 'Engagement CTA']
  },
  instagram: {
    contentStyle: 'Visual-first caption with an emotional hook.',
    ctaStyle: 'Save, share, or comment.',
    requirements: ['Strong hook', 'Visual framing', 'Hashtag set']
  },
  tiktok: {
    contentStyle: 'Hook-first short script with punchy wording.',
    ctaStyle: 'Watch, follow, or comment.',
    requirements: ['First-second hook', 'Short script', 'Fast CTA']
  },
  youtube: {
    contentStyle: 'Searchable title and description style.',
    ctaStyle: 'Subscribe, watch next, or comment.',
    requirements: ['Video media', 'Searchable title', 'Description context']
  },
  youtube_shorts: {
    contentStyle: 'Short title or hook plus script-style caption.',
    ctaStyle: 'Subscribe or watch next.',
    requirements: ['Short video', 'Short hook', 'Replayable idea']
  },
  threads: {
    contentStyle: 'Conversational short text.',
    ctaStyle: 'Reply or discuss.',
    requirements: ['Conversational tone', 'Discussion prompt']
  },
  linkedin: {
    contentStyle: 'Professional insight-driven post.',
    ctaStyle: 'Discussion or business action.',
    requirements: ['Business angle', 'Practical insight', 'Discussion CTA']
  },
  x: {
    contentStyle: 'Short concise post.',
    ctaStyle: 'Reply, repost, or follow.',
    requirements: ['Under 280 characters', 'Concise point', 'Punchy CTA']
  },
  pinterest: {
    contentStyle: 'Descriptive pin title and search-friendly description.',
    ctaStyle: 'Save or click through.',
    requirements: ['Keyword phrase', 'Descriptive title', 'Save CTA']
  },
  wordpress: {
    contentStyle: 'Article title, intro, and outline-style caption.',
    ctaStyle: 'Read more or subscribe.',
    requirements: ['Article title', 'Intro paragraph', 'Outline']
  },
  shopify: {
    contentStyle: 'Product or content marketing style.',
    ctaStyle: 'View product, shop, or read content.',
    requirements: ['Value proposition', 'Product/content angle', 'Shop CTA']
  }
};

export const getPlatformDetails = platform => platformDetails[platform] || {
  contentStyle: 'Platform-specific caption.',
  ctaStyle: 'Clear next action.',
  requirements: ['Hook', 'Caption', 'CTA']
};

export const platformCapabilities = {
  facebook: { multiMedia: true, maxMedia: 10, types: ['image', 'video'] },
  instagram: { multiMedia: true, maxMedia: 10, types: ['image', 'video'] },
  tiktok: { multiMedia: true, maxMedia: 35, types: ['image', 'video'] },
  youtube: { multiMedia: false, maxMedia: 1, types: ['video'] },
  youtube_shorts: { multiMedia: false, maxMedia: 1, types: ['video'] },
  threads: { multiMedia: true, maxMedia: 10, types: ['image', 'video'] },
  linkedin: { multiMedia: true, maxMedia: 9, types: ['image', 'video'] },
  x: { multiMedia: true, maxMedia: 4, types: ['image', 'video'] },
  pinterest: { multiMedia: false, maxMedia: 1, types: ['image', 'video'] },
  wordpress: { multiMedia: true, maxMedia: 99, types: ['image', 'video'] },
  shopify: { multiMedia: true, maxMedia: 99, types: ['image', 'video'] },
};
