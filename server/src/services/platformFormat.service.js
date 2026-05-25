import { PLATFORM_LABELS, SUPPORTED_PLATFORMS } from '../constants/platforms.js';
import PlatformFormatRule from '../models/PlatformFormatRule.js';

export const DEFAULT_PLATFORM_FORMAT_RULES = [
  {
    platform: 'facebook',
    displayName: 'Facebook',
    maxCaptionLength: 1200,
    maxHashtags: 5,
    recommendedHashtags: ['#Community', '#CreatorWorkflow'],
    supportsLongText: true,
    supportsShortVideo: true,
    supportsImage: true,
    supportsLinks: true,
    contentStyle: 'community-style post with context and engagement',
    ctaStyle: 'ask for comments, shares, or discussion',
    requirements: ['Clear topic', 'Community angle', 'Engagement CTA']
  },
  {
    platform: 'instagram',
    displayName: 'Instagram',
    maxCaptionLength: 500,
    maxHashtags: 8,
    recommendedHashtags: ['#CreatorTools', '#ContentStrategy', '#AIAutomation'],
    supportsLongText: false,
    supportsShortVideo: true,
    supportsImage: true,
    supportsLinks: false,
    contentStyle: 'visual-first caption with emotional hook',
    ctaStyle: 'save, share, comment',
    requirements: ['Strong hook', 'Visual framing', 'Hashtag set']
  },
  {
    platform: 'tiktok',
    displayName: 'TikTok',
    maxCaptionLength: 300,
    maxHashtags: 6,
    recommendedHashtags: ['#CreatorTok', '#ContentHacks', '#AITools'],
    supportsLongText: false,
    supportsShortVideo: true,
    supportsImage: false,
    supportsLinks: false,
    contentStyle: 'hook-first short script with punchy wording',
    ctaStyle: 'watch, follow, comment',
    requirements: ['First-second hook', 'Short script', 'Fast CTA']
  },
  {
    platform: 'youtube',
    displayName: 'YouTube',
    maxCaptionLength: 1800,
    maxHashtags: 8,
    recommendedHashtags: ['#CreatorWorkflow', '#ContentSystem'],
    supportsLongText: true,
    supportsShortVideo: true,
    supportsImage: false,
    supportsLinks: true,
    contentStyle: 'title and description style with searchable wording',
    ctaStyle: 'subscribe, watch next, comment',
    requirements: ['Searchable title', 'Description context', 'Watch-next CTA']
  },
  {
    platform: 'youtube_shorts',
    displayName: 'YouTube Shorts',
    maxCaptionLength: 420,
    maxHashtags: 5,
    recommendedHashtags: ['#Shorts', '#YouTubeGrowth', '#CreatorWorkflow'],
    supportsLongText: false,
    supportsShortVideo: true,
    supportsImage: false,
    supportsLinks: false,
    contentStyle: 'short title or hook plus script-style caption',
    ctaStyle: 'subscribe, watch next',
    requirements: ['Short hook', 'Script cue', 'Replayable idea']
  },
  {
    platform: 'threads',
    displayName: 'Threads',
    maxCaptionLength: 500,
    maxHashtags: 2,
    recommendedHashtags: ['#CreatorOps'],
    supportsLongText: false,
    supportsShortVideo: false,
    supportsImage: true,
    supportsLinks: true,
    contentStyle: 'conversational short text',
    ctaStyle: 'reply or discuss',
    requirements: ['Conversational tone', 'Discussion prompt']
  },
  {
    platform: 'linkedin',
    displayName: 'LinkedIn',
    maxCaptionLength: 1800,
    maxHashtags: 5,
    recommendedHashtags: ['#CreatorEconomy', '#MarketingOps', '#Productivity'],
    supportsLongText: true,
    supportsShortVideo: true,
    supportsImage: true,
    supportsLinks: true,
    contentStyle: 'professional insight-driven post',
    ctaStyle: 'discussion or business action',
    requirements: ['Business angle', 'Practical insight', 'Discussion CTA']
  },
  {
    platform: 'x',
    displayName: 'X',
    maxCaptionLength: 280,
    maxHashtags: 2,
    recommendedHashtags: ['#CreatorOps'],
    supportsLongText: false,
    supportsShortVideo: true,
    supportsImage: true,
    supportsLinks: true,
    contentStyle: 'short concise post',
    ctaStyle: 'reply, repost, follow',
    requirements: ['Concise point', 'Punchy CTA']
  },
  {
    platform: 'pinterest',
    displayName: 'Pinterest',
    maxCaptionLength: 500,
    maxHashtags: 6,
    recommendedHashtags: ['#ContentPlanning', '#CreatorTools'],
    supportsLongText: false,
    supportsShortVideo: true,
    supportsImage: true,
    supportsLinks: true,
    contentStyle: 'descriptive pin title and search-friendly description',
    ctaStyle: 'save or click through',
    requirements: ['Keyword phrase', 'Descriptive title', 'Save CTA']
  },
  {
    platform: 'blog',
    displayName: 'Blog',
    maxCaptionLength: 2500,
    maxHashtags: 0,
    recommendedHashtags: [],
    supportsLongText: true,
    supportsShortVideo: false,
    supportsImage: true,
    supportsLinks: true,
    contentStyle: 'article title, intro, and outline-style caption',
    ctaStyle: 'read more or subscribe',
    requirements: ['Article title', 'Intro paragraph', 'Outline']
  },
  {
    platform: 'shopify',
    displayName: 'Shopify',
    maxCaptionLength: 900,
    maxHashtags: 4,
    recommendedHashtags: ['#ShopUpdate', '#CreatorStore'],
    supportsLongText: false,
    supportsShortVideo: true,
    supportsImage: true,
    supportsLinks: true,
    contentStyle: 'product or content marketing style',
    ctaStyle: 'view product, shop, or read content',
    requirements: ['Value proposition', 'Product/content angle', 'Shop CTA']
  }
];

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const ensureDefaultPlatformRules = async () => {
  for (const rule of DEFAULT_PLATFORM_FORMAT_RULES) {
    await PlatformFormatRule.updateOne({ platform: rule.platform }, { $setOnInsert: rule }, { upsert: true });
  }
};

export const getPlatformRules = async () => {
  await ensureDefaultPlatformRules();
  return PlatformFormatRule.find({ platform: { $in: SUPPORTED_PLATFORMS } }).sort({ platform: 1 });
};

export const getPlatformRule = async platform => {
  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    throw createHttpError('Unsupported platform.', 404);
  }

  await ensureDefaultPlatformRules();
  const rule = await PlatformFormatRule.findOne({ platform });

  if (!rule) {
    throw createHttpError('Platform format rule not found.', 404);
  }

  return rule;
};

export const computePlatformFitScore = variant => {
  const captionLength = String(variant.caption || '').length;
  const hashtagCount = Array.isArray(variant.hashtags) ? variant.hashtags.length : 0;
  let score = 100;

  if (!variant.hook) score -= 20;
  if (!variant.cta) score -= 20;
  if (captionLength < 20) score -= 15;

  return Math.max(0, Math.min(100, score - Math.max(0, hashtagCount - 10) * 3));
};

export const validateVariantForPlatform = async variant => {
  const rule = await getPlatformRule(variant.platform);
  const captionLength = String(variant.caption || '').length;
  const hashtagCount = Array.isArray(variant.hashtags) ? variant.hashtags.length : 0;

  return {
    platform: variant.platform,
    displayName: rule.displayName || PLATFORM_LABELS[variant.platform] || variant.platform,
    valid: captionLength <= rule.maxCaptionLength && hashtagCount <= rule.maxHashtags,
    captionLength,
    maxCaptionLength: rule.maxCaptionLength,
    hashtagCount,
    maxHashtags: rule.maxHashtags,
    platformFitScore: computePlatformFitScore(variant)
  };
};

export const getReadinessChecklist = async variant => {
  const validation = await validateVariantForPlatform(variant);

  return {
    ...validation,
    checklist: {
      hookExists: Boolean(variant.hook),
      ctaExists: Boolean(variant.cta),
      hashtagsWithinLimit: validation.hashtagCount <= validation.maxHashtags,
      captionWithinLimit: validation.captionLength <= validation.maxCaptionLength,
      approvedBeforePublishing: ['approved', 'scheduled', 'published'].includes(variant.status)
    }
  };
};
