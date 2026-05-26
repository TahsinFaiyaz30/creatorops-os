import env from '../config/env.js';
import BrandProfile from '../models/BrandProfile.js';
import Campaign from '../models/Campaign.js';
import ContentItem from '../models/ContentItem.js';
import MediaAsset from '../models/MediaAsset.js';
import PlatformConnection from '../models/PlatformConnection.js';
import PlatformVariant, { SUPPORTED_PLATFORMS } from '../models/PlatformVariant.js';
import { normalizePlatform } from '../constants/platforms.js';
import { createWorkflowEvent } from './event.service.js';
import { createVariantVersion } from './versioning.service.js';

const PROVIDER_TEMPLATE = 'template-fallback';
const PROVIDER_GEMINI = 'gemini';
const PROVIDER_GROQ = 'groq';

const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';
const GEMINI_FALLBACK_MODELS = ['gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash'];

const platformRules = {
  facebook: {
    name: 'Facebook',
    style: 'community-style, medium caption, engagement-led',
    hook: idea => `Let's make this easier: ${idea}`,
    caption: ({ idea, brandName, tone, targetAudience }) =>
      `${brandName || 'Our team'} is turning "${idea}" into a practical conversation for ${targetAudience || 'the community'}. ${tone ? `Keep it ${tone}.` : 'Keep it helpful, direct, and easy to respond to.'} This is built for teams who want clearer content operations without jumping between disconnected tools.`,
    cta: 'What would you add to this workflow? Comment below or share it with your team.',
    hashtags: ['#CreatorWorkflow', '#ContentOps', '#Community'],
    fitWords: ['community', 'comment', 'share', 'team']
  },
  instagram: {
    name: 'Instagram',
    style: 'short, emotional, visual-first',
    hook: idea => `Stop scrolling: ${idea}`,
    caption: ({ idea, brandName, tone, targetAudience }) =>
      `${brandName ? `${brandName} is ` : ''}turning ${idea.toLowerCase()} into a simple visual moment for ${targetAudience || 'your audience'}. ${tone ? `Keep it ${tone}.` : 'Make it clear, useful, and easy to save.'}`,
    cta: 'Save this, share it with a teammate, and comment with your next content idea.',
    hashtags: ['#CreatorTools', '#ContentStrategy', '#AIAutomation'],
    fitWords: ['visual', 'save', 'share', 'comment']
  },
  linkedin: {
    name: 'LinkedIn',
    style: 'professional, insight-driven, business-focused',
    hook: idea => `A practical content workflow lesson: ${idea}`,
    caption: ({ idea, brandName, tone, targetAudience }) =>
      `${brandName || 'Your team'} can use this idea to create a repeatable workflow instead of another disconnected post. For ${targetAudience || 'creator teams'}, the advantage is simple: clearer ownership, sharper positioning, and fewer approval delays. ${tone ? `The tone should stay ${tone}.` : ''}`,
    cta: 'What would you improve in your current content workflow?',
    hashtags: ['#CreatorEconomy', '#MarketingOps', '#Productivity'],
    fitWords: ['workflow', 'team', 'business', 'productivity']
  },
  tiktok: {
    name: 'TikTok',
    style: 'hook-first, fast, punchy',
    hook: idea => `You need this if ${idea.toLowerCase()}`,
    caption: ({ idea, brandName, targetAudience }) =>
      `POV: ${targetAudience || 'your team'} finally has a fast way to turn "${idea}" into content that actually fits each platform. ${brandName ? `${brandName} keeps it focused and ready to post.` : 'Keep it quick, useful, and easy to follow.'}`,
    cta: 'Watch till the end, follow for more, and comment your next idea.',
    hashtags: ['#CreatorTok', '#ContentHacks', '#AITools'],
    fitWords: ['pov', 'fast', 'follow', 'comment']
  },
  youtube: {
    name: 'YouTube',
    style: 'searchable title and description',
    hook: idea => `How to use ${idea.toLowerCase()} in a creator workflow`,
    caption: ({ idea, brandName, targetAudience }) =>
      `Title idea: How Creator Teams Turn One Idea Into Multi-Platform Content\n\nDescription: In this video, ${brandName || 'the workflow'} shows how "${idea}" becomes platform-ready content with approvals, scheduling, and real account-targeted publishing checks. Built for ${targetAudience || 'creator teams'} who need a repeatable content system.`,
    cta: 'Subscribe for more creator workflow breakdowns and watch the next video.',
    hashtags: ['#CreatorWorkflow', '#ContentSystem', '#MarketingOps'],
    fitWords: ['how', 'video', 'subscribe', 'description']
  },
  youtube_shorts: {
    name: 'YouTube Shorts',
    style: 'search-friendly, clear, script-like',
    hook: idea => `How to turn ${idea.toLowerCase()} into platform-ready content`,
    caption: ({ idea, brandName, targetAudience }) =>
      `Short script: Start with the problem, show how ${brandName || 'the workflow'} handles "${idea}", then give ${targetAudience || 'viewers'} one clear next step. Keep the message searchable, specific, and easy to replay.`,
    cta: 'Subscribe for the next workflow breakdown and watch the next short.',
    hashtags: ['#YouTubeGrowth', '#CreatorWorkflow', '#ContentSystem'],
    fitWords: ['how to', 'script', 'subscribe', 'watch']
  },
  threads: {
    name: 'Threads',
    style: 'short, conversational, discussion-first',
    hook: idea => `A creator ops thought: ${idea}`,
    caption: ({ idea, brandName, targetAudience }) =>
      `${brandName || 'A creator team'} can turn "${idea}" into a full content workflow without losing the human review step. For ${targetAudience || 'teams'}, that matters more than just generating another caption.`,
    cta: 'Would you use this workflow, or change the approval step?',
    hashtags: ['#CreatorOps'],
    fitWords: ['thought', 'workflow', 'would', 'discussion']
  },
  x: {
    name: 'X',
    style: 'concise, punchy, max-short format',
    hook: idea => `One idea. Many platforms.`,
    caption: ({ idea }) =>
      `One idea should not become scattered drafts. ${String(idea || '').slice(0, 95)} Turn it into variants, approvals, and real account checks before posting.`,
    cta: 'Reply with your biggest content bottleneck.',
    hashtags: ['#CreatorOps'],
    fitWords: ['workflow', 'reply', 'idea', 'approval']
  },
  pinterest: {
    name: 'Pinterest',
    style: 'descriptive pin title and keyword-rich description',
    hook: idea => `Creator workflow template for ${idea.toLowerCase()}`,
    caption: ({ idea, brandName }) =>
      `Pin title: Creator Content Workflow System\n\nDescription: Save this ${brandName || 'creator workflow'} idea for planning content across Instagram, TikTok, YouTube, LinkedIn, and more. Use "${idea}" as the starting point for platform-specific drafts, approvals, and scheduling.`,
    cta: 'Save this pin for your next content planning session.',
    hashtags: ['#ContentPlanning', '#CreatorTools', '#Workflow'],
    fitWords: ['pin', 'save', 'planning', 'template']
  },
  wordpress: {
    name: 'WordPress / Blog',
    style: 'article title, intro, and outline',
    hook: idea => `How Creator Teams Can Operationalize ${idea}`,
    caption: ({ idea, brandName, targetAudience }) =>
      `Article intro: ${brandName || 'CreatorOps OS'} shows how "${idea}" can become a repeatable content workflow for ${targetAudience || 'creator teams'}.\n\nOutline:\n1. Start with one raw idea.\n2. Adapt it for each platform.\n3. Review with clear roles.\n4. Schedule through connected accounts.\n5. Track events and versions.`,
    cta: 'Read the full workflow and adapt it for your team.',
    hashtags: [],
    fitWords: ['article', 'outline', 'read', 'workflow']
  },
  shopify: {
    name: 'Shopify',
    style: 'product/content marketing with shop-oriented CTA',
    hook: idea => `Turn content operations into a product-ready workflow`,
    caption: ({ idea, brandName }) =>
      `${brandName || 'This creator workflow'} helps teams turn "${idea}" into content that supports campaigns, product education, and shop updates. Keep the message practical, brand-safe, and ready for a real connected publishing channel.`,
    cta: 'View the campaign workflow and connect it to your next shop update.',
    hashtags: ['#ShopUpdate', '#CreatorStore', '#ContentMarketing'],
    fitWords: ['shop', 'product', 'campaign', 'view']
  }
};

const platformFormatLimits = {
  facebook: { maxCaptionLength: 1200, maxHashtags: 5 },
  instagram: { maxCaptionLength: 500, maxHashtags: 8 },
  tiktok: { maxCaptionLength: 300, maxHashtags: 6 },
  youtube: { maxCaptionLength: 1800, maxHashtags: 8 },
  youtube_shorts: { maxCaptionLength: 420, maxHashtags: 5 },
  threads: { maxCaptionLength: 500, maxHashtags: 2 },
  linkedin: { maxCaptionLength: 1800, maxHashtags: 5 },
  x: { maxCaptionLength: 280, maxHashtags: 2 },
  pinterest: { maxCaptionLength: 500, maxHashtags: 6 },
  wordpress: { maxCaptionLength: 2500, maxHashtags: 0 },
  shopify: { maxCaptionLength: 900, maxHashtags: 4 }
};

const topicHashtagMap = [
  { terms: ['ai', 'automation', 'workflow'], tags: ['#AIAutomation', '#CreatorWorkflow', '#ContentSystem'] },
  { terms: ['coding', 'programming', 'developer'], tags: ['#Coding', '#DeveloperTools', '#TechContent'] },
  { terms: ['product', 'shop', 'ecommerce'], tags: ['#ProductMarketing', '#ShopUpdate', '#Ecommerce'] },
  { terms: ['campus', 'student', 'university'], tags: ['#CampusCreators', '#StudentLife', '#Learning'] },
  { terms: ['brand', 'marketing', 'campaign'], tags: ['#BrandStrategy', '#MarketingOps', '#CampaignPlanning'] },
  { terms: ['movie', 'video', 'film'], tags: ['#VideoStrategy', '#Storytelling', '#CreatorTips'] }
];

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const clampScore = value => Math.max(0, Math.min(100, Math.round(value)));

const normalizeText = value => String(value || '').trim();

const compactText = value => normalizeText(value).replace(/\s+/g, ' ');

const getPlatformLimit = platform => platformFormatLimits[platform] || { maxCaptionLength: 1000, maxHashtags: 5 };

const shortenText = (value, maxLength) => {
  const text = compactText(value);
  if (!maxLength || text.length <= maxLength) return text;
  if (maxLength <= 3) return text.slice(0, maxLength);

  const slice = text.slice(0, maxLength - 3);
  const lastSpace = slice.lastIndexOf(' ');
  const trimmed = slice.slice(0, lastSpace > maxLength * 0.6 ? lastSpace : slice.length).trim();
  return `${trimmed}...`;
};

const fitCaptionToPlatform = (platform, caption) => {
  const { maxCaptionLength } = getPlatformLimit(platform);
  return shortenText(caption, maxCaptionLength);
};

const unique = values => [...new Set(values.filter(Boolean))];

const toArray = value => (Array.isArray(value) ? value : []);

const includesText = (source, search) =>
  normalizeText(source).toLowerCase().includes(normalizeText(search).toLowerCase());

const containsAny = (text, words) => toArray(words).some(word => word && includesText(text, word));

export const generateHashtagSuggestions = ({ topic = '', platform = '', targetAudience = '', campaignGoal = '', tone = '' }) => {
  const context = `${topic} ${targetAudience} ${campaignGoal} ${tone}`.toLowerCase();
  const platformDefaults = platformRules[platform]?.hashtags || [];
  const topicTags = topicHashtagMap
    .filter(entry => entry.terms.some(term => context.includes(term)))
    .flatMap(entry => entry.tags);
  const audienceTags = targetAudience
    ? targetAudience
        .split(/[,\s]+/)
        .map(word => word.replace(/[^a-z0-9]/gi, ''))
        .filter(word => word.length > 3)
        .slice(0, 2)
        .map(word => `#${word[0].toUpperCase()}${word.slice(1)}`)
    : [];
  const { maxCaptionLength, maxHashtags } = getPlatformLimit(platform);
  return unique([...topicTags, ...platformDefaults, ...audienceTags]).slice(0, maxHashtags);
};

const getBrandContext = brandProfile => ({
  brandName: normalizeText(brandProfile?.brandName),
  tone: normalizeText(brandProfile?.tone),
  targetAudience: normalizeText(brandProfile?.targetAudience),
  bannedWords: toArray(brandProfile?.bannedWords),
  ctaStyle: normalizeText(brandProfile?.ctaStyle),
  preferredPlatforms: toArray(brandProfile?.preferredPlatforms)
});

const getContentIdea = contentItem => compactText(contentItem?.rawIdea || contentItem?.title || 'share a useful creator workflow');

const selectPlatforms = ({ campaign, brandProfile, platforms }) => {
  const requestedPlatforms = toArray(platforms);
  const campaignPlatforms = toArray(campaign?.platforms);
  const brandPlatforms = toArray(brandProfile?.preferredPlatforms);
  const candidates =
    requestedPlatforms.length > 0
      ? requestedPlatforms
      : campaignPlatforms.length > 0
        ? campaignPlatforms
        : brandPlatforms.length > 0
          ? brandPlatforms
          : SUPPORTED_PLATFORMS;

  return unique(candidates).filter(platform => SUPPORTED_PLATFORMS.includes(platform));
};

const isGenericCaption = caption => {
  const lower = normalizeText(caption).toLowerCase();
  const genericPhrases = ['check this out', 'new post', 'great content', 'amazing opportunity', 'don\'t miss out'];
  return lower.length < 35 || genericPhrases.some(phrase => lower.includes(phrase));
};

const captionLengthPenalty = (platform, caption) => {
  const length = normalizeText(caption).length;

  if (platform === 'instagram') return length < 45 || length > 360 ? 8 : 0;
  if (platform === 'linkedin') return length < 120 || length > 1200 ? 8 : 0;
  if (platform === 'tiktok') return length < 35 || length > 260 ? 8 : 0;
  if (platform === 'facebook') return length < 80 || length > 1200 ? 8 : 0;
  if (platform === 'youtube') return length < 120 || length > 1800 ? 8 : 0;
  if (platform === 'youtube_shorts') return length < 70 || length > 420 ? 8 : 0;
  if (platform === 'threads') return length < 30 || length > 500 ? 8 : 0;
  if (platform === 'x') return length < 25 || length > 280 ? 8 : 0;
  if (platform === 'pinterest') return length < 70 || length > 500 ? 8 : 0;
  if (platform === 'wordpress') return length < 180 || length > 2500 ? 8 : 0;
  if (platform === 'shopify') return length < 80 || length > 900 ? 8 : 0;

  return 0;
};

const detectWarnings = ({ platform, caption, hook, cta, hashtags, brandProfile }) => {
  const warnings = [];
  const fullText = `${caption} ${hook} ${cta} ${toArray(hashtags).join(' ')}`;
  const bannedWords = toArray(brandProfile?.bannedWords).filter(word => containsAny(fullText, [word]));
  const rules = platformRules[platform];

  if (bannedWords.length > 0) {
    warnings.push(`Banned words detected: ${bannedWords.join(', ')}`);
  }

  if (!normalizeText(cta)) {
    warnings.push('CTA is missing.');
  }

  if (!rules || !containsAny(`${caption} ${hook} ${cta}`, rules.fitWords)) {
    warnings.push('Platform fit is weak.');
  }

  if (isGenericCaption(caption)) {
    warnings.push('Caption is too generic.');
  }

  if (captionLengthPenalty(platform, caption) > 0) {
    warnings.push('Caption length may not fit the platform well.');
  }

  const { maxCaptionLength, maxHashtags } = getPlatformLimit(platform);
  if (normalizeText(caption).length > maxCaptionLength) {
    warnings.push(`Caption exceeds ${maxCaptionLength} characters for ${rules?.name || platform}.`);
  }
  if (toArray(hashtags).length > maxHashtags) {
    warnings.push(`Too many hashtags for ${rules?.name || platform}.`);
  }

  return warnings;
};

const buildSuggestions = ({ platform, hook, cta, caption, brandProfile }) => {
  const suggestions = [];
  const rules = platformRules[platform];

  if (!normalizeText(hook) || normalizeText(hook).length < 18) {
    suggestions.push('Improve the hook with a clearer first-second promise.');
  }

  if (!normalizeText(cta) || !containsAny(cta, ['save', 'share', 'comment', 'discuss', 'follow', 'subscribe', 'watch'])) {
    suggestions.push('Use a stronger CTA tied to the platform behavior.');
  }

  if (rules && !containsAny(`${caption} ${hook} ${cta}`, rules.fitWords)) {
    suggestions.push(`Adjust wording to better fit ${rules.name}.`);
  } else {
    suggestions.push(`Keep the ${rules?.name || platform} format tight and platform-specific.`);
  }

  const { maxCaptionLength } = getPlatformLimit(platform);
  if (normalizeText(caption).length > maxCaptionLength * 0.9) {
    suggestions.push(`Keep this under ${maxCaptionLength} characters for ${rules?.name || platform}.`);
  }

  if (brandProfile?.tone && !containsAny(`${caption} ${hook}`, brandProfile.tone.split(/[,\s]+/))) {
    suggestions.push('Reflect the brand tone more explicitly.');
  }

  return unique(suggestions).slice(0, 4);
};

export const calculateBrandScore = ({ caption, hook, cta, brandProfile }) => {
  const brand = getBrandContext(brandProfile);
  const fullText = `${caption} ${hook} ${cta}`;
  let score = 80;

  if (brand.tone && containsAny(fullText, brand.tone.split(/[,\s]+/))) {
    score += 6;
  }

  if (brand.targetAudience && includesText(fullText, brand.targetAudience)) {
    score += 7;
  } else if (brand.targetAudience && containsAny(fullText, brand.targetAudience.split(/[,\s]+/))) {
    score += 4;
  }

  if (brand.ctaStyle && containsAny(cta, brand.ctaStyle.split(/[,\s]+/))) {
    score += 5;
  }

  if (containsAny(fullText, brand.bannedWords)) {
    score -= 25;
  }

  if (isGenericCaption(caption)) {
    score -= 12;
  }

  return clampScore(score);
};

export const calculateReadinessScore = ({ platform, caption, hook, cta, hashtags }) => {
  const rules = platformRules[platform];
  let score = 75;

  if (normalizeText(hook)) score += 7;
  if (normalizeText(cta)) score += 7;
  if (toArray(hashtags).length > 0) score += 5;
  if (rules && containsAny(`${caption} ${hook} ${cta}`, rules.fitWords)) score += 6;

  score -= captionLengthPenalty(platform, caption);

  if (isGenericCaption(caption)) {
    score -= 10;
  }

  return clampScore(score);
};

const normalizeGeneratedVariant = ({ platform, generated, brandProfile, provider }) => {
  const rules = platformRules[platform];
  const { maxCaptionLength, maxHashtags } = getPlatformLimit(platform);
  const rawCaption = compactText(generated.caption);
  const caption = fitCaptionToPlatform(platform, rawCaption);
  const hook = compactText(generated.hook);
  const cta = compactText(generated.cta);
  const hashtags = unique(toArray(generated.hashtags).map(tag => (tag.startsWith('#') ? tag : `#${tag}`))).slice(0, maxHashtags);
  const brandScore = calculateBrandScore({ caption, hook, cta, brandProfile });
  const readinessScore = calculateReadinessScore({ platform, caption, hook, cta, hashtags });
  const warnings = detectWarnings({ platform, caption, hook, cta, hashtags, brandProfile });
  const suggestions = buildSuggestions({ platform, hook, cta, caption, brandProfile });
  const fallbackHashtags = (rules.hashtags || []).slice(0, maxHashtags);
  const platformNotes = unique([
    rules?.style ? `${rules.name || platform} style: ${rules.style}.` : '',
    generated.platformNotes,
    normalizeText(caption).length > maxCaptionLength ? `Caption should stay under ${maxCaptionLength} characters.` : ''
  ]).filter(Boolean);

  return {
    platform,
    caption,
    hook,
    cta,
    hashtags: hashtags.length > 0 ? hashtags : fallbackHashtags,
    platformNotes,
    brandScore,
    readinessScore,
    warnings,
    suggestions,
    aiProvider: provider,
    status: 'draft'
  };
};

export const templateFallbackRepurpose = ({ contentItem, brandProfile, platforms }) => {
  const idea = getContentIdea(contentItem);
  const brand = getBrandContext(brandProfile);

  return platforms.map(platform => {
    const rules = platformRules[platform];
    const hashtags = generateHashtagSuggestions({
      topic: idea,
      platform,
      targetAudience: brand.targetAudience,
      campaignGoal: '',
      tone: brand.tone
    });
    const generated = {
      platform,
      hook: rules.hook(idea),
      caption: rules.caption({ idea, ...brand }),
      cta: brand.ctaStyle ? `${rules.cta} Keep the action ${brand.ctaStyle}.` : rules.cta,
      hashtags,
      platformNotes: `${rules.name} caption follows ${rules.style} formatting.`
    };

    return normalizeGeneratedVariant({
      platform,
      generated,
      brandProfile: brand,
      provider: PROVIDER_TEMPLATE
    });
  });
};

const parseJsonFromText = text => {
  const cleaned = normalizeText(text).replace(/^```json\s*/i, '').replace(/```$/i, '');
  const firstBracket = cleaned.indexOf('[');
  const firstBrace = cleaned.indexOf('{');
  const startIndexes = [firstBracket, firstBrace].filter(index => index >= 0);
  const start = startIndexes.length ? Math.min(...startIndexes) : 0;
  const lastBracket = cleaned.lastIndexOf(']');
  const lastBrace = cleaned.lastIndexOf('}');
  const end = Math.max(lastBracket, lastBrace);
  const jsonText = end >= start ? cleaned.slice(start, end + 1) : cleaned;

  return JSON.parse(jsonText);
};

const validateProviderVariants = ({ variants, platforms, brandProfile, provider }) => {
  const rawVariants = Array.isArray(variants) ? variants : variants?.variants;

  if (!Array.isArray(rawVariants)) {
    throw new Error('Provider response did not include variants array.');
  }

  const normalized = rawVariants
    .filter(variant => platforms.includes(variant.platform))
    .map(variant =>
      normalizeGeneratedVariant({
        platform: variant.platform,
        generated: variant,
        brandProfile,
        provider
      })
    );

  if (normalized.length !== platforms.length) {
    throw new Error('Provider response did not include all requested platforms.');
  }

  return normalized;
};

const withTimeout = async (promiseFactory, timeoutMs) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await promiseFactory(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
};

const buildProviderPrompt = ({ contentItem, campaign, brandProfile, platforms }) => ({
  instruction:
    `Return strict JSON with a variants array. Each item must include platform, caption, hook, cta, hashtags. Use only these exact platform values: ${platforms.join(', ')}. No markdown. Captions must obey platformLimits exactly, especially X at 280 characters.`,
  contentIdea: getContentIdea(contentItem),
  campaign: {
    name: campaign?.name,
    goal: campaign?.goal,
    targetAudience: campaign?.targetAudience
  },
  brandProfile: getBrandContext(brandProfile),
  platforms,
  platformLimits: Object.fromEntries(platforms.map(platform => [platform, getPlatformLimit(platform)])),
  platformRules
});

const getGeminiModelCandidates = () => {
  const model = env.geminiModel || DEFAULT_GEMINI_MODEL;
  return unique([model, DEFAULT_GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS]);
};

const callGeminiModel = async ({ model, prompt, platforms, brandProfile }) =>
  withTimeout(
    async signal => {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': env.geminiApiKey
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ]
        }),
        signal
      });

      if (!response.ok) {
        throw new Error(`Gemini failed with ${response.status}`);
      }

      const payload = await response.json();
      const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (!text) {
        throw new Error('Gemini response did not include text.');
      }

      return validateProviderVariants({
        variants: parseJsonFromText(text),
        platforms,
        brandProfile,
        provider: PROVIDER_GEMINI
      });
    },
    env.aiTimeoutMs
  );

const tryGeminiRepurpose = async ({ contentItem, campaign, brandProfile, platforms }) => {
  if (!(process.env.GEMINI_API_KEY || env.geminiApiKey)) return null;

  const prompt = JSON.stringify(buildProviderPrompt({ contentItem, campaign, brandProfile, platforms }));

  for (const model of getGeminiModelCandidates()) {
    try {
      return await callGeminiModel({ model, prompt, platforms, brandProfile });
    } catch (_error) {
      continue;
    }
  }

  return null;
};

const tryGroqRepurpose = async ({ contentItem, campaign, brandProfile, platforms }) => {
  if (!env.groqApiKey) return null;

  const prompt = JSON.stringify(buildProviderPrompt({ contentItem, campaign, brandProfile, platforms }));

  return withTimeout(
    async signal => {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.groqApiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.4
        }),
        signal
      });

      if (!response.ok) {
        throw new Error(`Groq failed with ${response.status}`);
      }

      const payload = await response.json();
      const text = payload?.choices?.[0]?.message?.content || '';
      return validateProviderVariants({
        variants: parseJsonFromText(text),
        platforms,
        brandProfile,
        provider: PROVIDER_GROQ
      });
    },
    env.aiTimeoutMs
  );
};

const tryProviderRepurpose = async ({ contentItem, campaign, brandProfile, platforms }) => {
  const providerPreference = env.aiProvider;
  const providerOrder =
    providerPreference === PROVIDER_GEMINI
      ? [PROVIDER_GEMINI]
      : providerPreference === PROVIDER_GROQ
        ? [PROVIDER_GROQ]
        : [PROVIDER_GEMINI, PROVIDER_GROQ];

  for (const provider of providerOrder) {
    try {
      const result =
        provider === PROVIDER_GEMINI
          ? await tryGeminiRepurpose({ contentItem, campaign, brandProfile, platforms })
          : await tryGroqRepurpose({ contentItem, campaign, brandProfile, platforms });

      if (result) {
        return result;
      }
    } catch (_error) {
      continue;
    }
  }

  return null;
};

export const repurposeContent = async ({ contentItem, campaign, brandProfile, platforms }) => {
  const selectedPlatforms = selectPlatforms({ campaign, brandProfile, platforms });

  if (selectedPlatforms.length === 0) {
    throw createHttpError('No supported platforms were found for this content item.', 400);
  }

  const providerVariants = await tryProviderRepurpose({
    contentItem,
    campaign,
    brandProfile,
    platforms: selectedPlatforms
  });

  return (
    providerVariants ||
    templateFallbackRepurpose({
      contentItem,
      brandProfile,
      platforms: selectedPlatforms
    })
  );
};

const saveGeneratedVariant = async ({ user, contentItem, campaign, variantData }) => {
  const existingVariant = await PlatformVariant.findOne({
    workspaceId: user.workspaceId,
    contentItemId: contentItem._id,
    platform: variantData.platform
  });

  const payload = {
    workspaceId: user.workspaceId,
    campaignId: campaign._id,
    contentItemId: contentItem._id,
    ...variantData,
    status: 'draft'
  };

  const variant = existingVariant
    ? Object.assign(existingVariant, payload)
    : new PlatformVariant(payload);

  await variant.save();

  await createVariantVersion({
    user,
    contentItem,
    variant,
    changeNote: existingVariant ? 'AI regenerated existing platform variant' : 'AI generated platform variant'
  });

  return variant;
};

export const generateAndSaveVariants = async ({ user, contentItemId, platforms }) => {
  if (!contentItemId) {
    throw createHttpError('contentItemId is required.', 400);
  }

  const contentItem = await ContentItem.findOne({
    _id: contentItemId,
    workspaceId: user.workspaceId
  });

  if (!contentItem) {
    throw createHttpError('Content item not found.', 404);
  }

  const campaign = await Campaign.findOne({
    _id: contentItem.campaignId,
    workspaceId: user.workspaceId
  });

  if (!campaign) {
    throw createHttpError('Campaign not found.', 404);
  }

  const brandProfile = await BrandProfile.findOne({
    workspaceId: user.workspaceId
  });

  const generatedVariants = await repurposeContent({
    contentItem,
    campaign,
    brandProfile,
    platforms
  });

  const savedVariants = [];

  for (const variantData of generatedVariants) {
    savedVariants.push(
      await saveGeneratedVariant({
        user,
        contentItem,
        campaign,
        variantData
      })
    );
  }

  if (contentItem.status === 'idea') {
    contentItem.status = 'draft';
    await contentItem.save();
  }

  const provider = savedVariants.every(variant => variant.aiProvider === savedVariants[0]?.aiProvider)
    ? savedVariants[0]?.aiProvider || PROVIDER_TEMPLATE
    : 'mixed';

  await createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType: 'ai.variants_generated',
    message: 'AI generated platform variants',
    entityType: 'ContentItem',
    entityId: contentItem._id,
    metadata: {
      contentItemId: contentItem._id,
      campaignId: campaign._id,
      provider,
      platformCount: savedVariants.length,
      platforms: savedVariants.map(variant => variant.platform)
    }
  });

  return {
    contentItem,
    variants: savedVariants,
    provider,
    platformCount: savedVariants.length
  };
};

export const optimizeVariant = async ({ user, variantId, changeNote = '' }) => {
  if (!variantId) {
    throw createHttpError('variantId is required.', 400);
  }

  const variant = await PlatformVariant.findOne({
    _id: variantId,
    workspaceId: user.workspaceId
  });

  if (!variant) {
    throw createHttpError('Platform variant not found.', 404);
  }

  const contentItem = await ContentItem.findOne({
    _id: variant.contentItemId,
    workspaceId: user.workspaceId
  });

  if (!contentItem) {
    throw createHttpError('Content item not found.', 404);
  }

  const brandProfile = await BrandProfile.findOne({
    workspaceId: user.workspaceId
  });

  const optimized = normalizeGeneratedVariant({
    platform: variant.platform,
    generated: {
      caption: `${variant.caption} ${brandProfile?.tone ? `Tone check: keep this ${brandProfile.tone}.` : 'Tighten the message and make the value clear.'}`,
      hook: variant.hook || platformRules[variant.platform].hook(getContentIdea(contentItem)),
      cta: variant.cta || platformRules[variant.platform].cta,
      hashtags: variant.hashtags?.length ? variant.hashtags : platformRules[variant.platform].hashtags
    },
    brandProfile,
    provider: PROVIDER_TEMPLATE
  });

  Object.assign(variant, optimized);
  await variant.save();

  const version = await createVariantVersion({
    user,
    contentItem,
    variant,
    changeNote: changeNote || 'AI optimized platform variant'
  });

  await createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType: 'ai.variant_optimized',
    message: 'AI optimized platform variant',
    entityType: 'PlatformVariant',
    entityId: variant._id,
    metadata: {
      contentItemId: contentItem._id,
      variantId: variant._id,
      provider: variant.aiProvider,
      platform: variant.platform,
      versionNumber: version.versionNumber
    }
  });

  return {
    variant,
    version
  };
};

const getComposeMediaWarnings = ({ connection, mediaAssets }) => {
  const warnings = [];
  const suggestions = [];
  const hasImage = mediaAssets.some(asset => asset.mediaType === 'image');
  const hasVideo = mediaAssets.some(asset => asset.mediaType === 'video');

  if (['youtube', 'youtube_shorts'].includes(connection.platform) && !hasVideo) {
    warnings.push(`${platformRules[connection.platform]?.name || 'YouTube'} publishing requires a video media asset.`);
    suggestions.push('Upload a video before publishing to YouTube, or deselect YouTube for image-only posts.');
  }

  if (connection.platform === 'tiktok' && !hasVideo) {
    warnings.push('TikTok publishing usually requires a video media asset.');
    suggestions.push('Upload a short video before publishing to TikTok.');
  }

  if (connection.platform === 'x' && hasImage && !connection.scopes?.includes('media.write')) {
    warnings.push('X image publishing requires the media.write OAuth scope on this connection.');
    suggestions.push('Enable media.write in the X app and reconnect the X account before posting images.');
  }

  return { warnings, suggestions };
};

const normalizeConnectionTargets = ({ connectionIds = [], connectionTargets = [] }) => {
  if (Array.isArray(connectionTargets) && connectionTargets.length > 0) {
    return connectionTargets
      .map(target => ({
        connectionId: target.connectionId || target.platformConnectionId || target.id,
        platform: target.platform ? normalizePlatform(target.platform) : ''
      }))
      .filter(target => target.connectionId);
  }

  return (Array.isArray(connectionIds) ? connectionIds : [])
    .map(connectionId => ({ connectionId, platform: '' }))
    .filter(target => target.connectionId);
};

const resolveComposeTargetPlatform = ({ connection, platform }) => {
  const requestedPlatform = platform || connection.platform;
  if (requestedPlatform === connection.platform) return requestedPlatform;
  if (connection.platform === 'youtube' && requestedPlatform === 'youtube_shorts') return requestedPlatform;
  throw createHttpError('Selected platform target does not match the connected account.', 400);
};

export const customizeCaptions = async ({ user, baseCaption, connectionIds = [], connectionTargets = [], mediaAssetIds = [] }) => {
  if (!baseCaption || !String(baseCaption).trim()) {
    throw createHttpError('baseCaption is required.', 400);
  }

  const targets = normalizeConnectionTargets({ connectionIds, connectionTargets });

  if (targets.length === 0) {
    throw createHttpError('connectionIds is required.', 400);
  }

  const uniqueConnectionIds = unique(targets.map(target => String(target.connectionId)));

  const connections = await PlatformConnection.find({
    _id: { $in: uniqueConnectionIds },
    workspaceId: user.workspaceId,
    status: 'connected'
  });

  if (connections.length !== uniqueConnectionIds.length) {
    throw createHttpError('One or more connected platform accounts were not found.', 404);
  }

  const connectionById = new Map(connections.map(connection => [String(connection._id), connection]));
  const resolvedTargets = targets.map(target => {
    const connection = connectionById.get(String(target.connectionId));
    const platform = resolveComposeTargetPlatform({ connection, platform: target.platform });
    return { ...target, connection, platform };
  });

  const brandProfile = await BrandProfile.findOne({ workspaceId: user.workspaceId });
  const mediaAssets = Array.isArray(mediaAssetIds) && mediaAssetIds.length > 0
    ? await MediaAsset.find({
        _id: { $in: mediaAssetIds },
        workspaceId: user.workspaceId
      })
    : [];
  if (Array.isArray(mediaAssetIds) && mediaAssetIds.length > 0 && mediaAssets.length !== mediaAssetIds.length) {
    throw createHttpError('One or more media assets were not found in this workspace.', 404);
  }
  const platforms = unique(resolvedTargets.map(target => target.platform));
  const pseudoContentItem = {
    title: 'Compose caption',
    rawIdea: baseCaption
  };
  const generated = await repurposeContent({
    contentItem: pseudoContentItem,
    campaign: null,
    brandProfile,
    platforms
  });
  const byPlatform = Object.fromEntries(generated.map(variant => [variant.platform, variant]));

  return {
    results: resolvedTargets.map(target => {
      const { connection, platform } = target;
      const variant = byPlatform[platform];
      const limits = getPlatformLimit(platform);
      const mediaGuidance = getComposeMediaWarnings({ connection: { ...connection.toObject(), platform }, mediaAssets });
      const warnings = unique([...(variant.warnings || []), ...mediaGuidance.warnings]);
      const suggestions = unique([...(variant.suggestions || []), ...mediaGuidance.suggestions]);
      return {
        connectionId: connection._id,
        platform,
        accountHandle: connection.accountHandle,
        caption: variant.caption,
        hashtags: variant.hashtags,
        hook: variant.hook,
        cta: variant.cta,
        brandScore: variant.brandScore,
        readinessScore: variant.readinessScore,
        warnings,
        suggestions,
        characterCount: variant.caption.length,
        maxCaptionLength: limits.maxCaptionLength,
        maxHashtags: limits.maxHashtags,
        platformNotes: variant.platformNotes || [],
        aiProvider: variant.aiProvider
      };
    })
  };
};

const buildTemplateScriptDraft = ({ userMessage, platform, scriptType, brandProfile, campaign }) => {
  const brand = getBrandContext(brandProfile);
  const topic = compactText(userMessage || campaign?.goal || 'creator workflow');
  const platformName = platformRules[platform]?.name || platform;
  const hook = platform === 'tiktok' || platform === 'youtube_shorts'
    ? `Stop scrolling: here is the fastest way to understand ${topic}.`
    : `Here is a practical creator workflow for ${topic}.`;
  const scenes = [
    {
      label: 'Scene 1',
      description: 'Open with the problem and a visual proof point.',
      dialogue: hook
    },
    {
      label: 'Scene 2',
      description: 'Show the product, process, or campaign benefit in one concrete example.',
      dialogue: `${brand.brandName || 'This workflow'} helps ${brand.targetAudience || 'the audience'} get from idea to action.`
    },
    {
      label: 'Scene 3',
      description: 'Close with a clear next action and platform-native CTA.',
      dialogue: platform === 'linkedin' ? 'What would you improve in this workflow?' : 'Follow, save, or comment with the next topic.'
    }
  ];

  return {
    title: `${platformName} ${scriptType}: ${topic.slice(0, 70)}`,
    hook,
    sceneBreakdown: scenes,
    dialogue: scenes.map(scene => scene.dialogue).join('\n'),
    voiceover: scenes.map(scene => `${scene.label}: ${scene.dialogue}`).join('\n'),
    cta: platformRules[platform]?.cta || 'Comment with your next content idea.',
    estimatedDuration: ['youtube', 'wordpress'].includes(platform) ? '3-6 minutes' : '30-45 seconds',
    platform,
    productionNotes: [
      `Optimize for ${platformName}.`,
      brand.tone ? `Keep tone ${brand.tone}.` : 'Keep the tone clear and useful.',
      campaign?.goal ? `Tie the script to campaign goal: ${campaign.goal}.` : 'Keep the story focused on one outcome.'
    ]
  };
};

const validateScriptDraft = (payload, fallback) => ({
  title: compactText(payload?.title || fallback.title),
  hook: compactText(payload?.hook || fallback.hook),
  sceneBreakdown: Array.isArray(payload?.sceneBreakdown) && payload.sceneBreakdown.length ? payload.sceneBreakdown : fallback.sceneBreakdown,
  dialogue: compactText(payload?.dialogue || fallback.dialogue),
  voiceover: compactText(payload?.voiceover || fallback.voiceover),
  cta: compactText(payload?.cta || fallback.cta),
  estimatedDuration: compactText(payload?.estimatedDuration || fallback.estimatedDuration),
  platform: payload?.platform || fallback.platform,
  productionNotes: Array.isArray(payload?.productionNotes) && payload.productionNotes.length ? payload.productionNotes : fallback.productionNotes,
  hookOptions: Array.isArray(payload?.hookOptions) ? payload.hookOptions.slice(0, 5) : [fallback.hook]
});

const tryProviderScriptDraft = async ({ userMessage, conversationHistory, platform, scriptType, brandProfile, campaign, fallback }) => {
  const prompt = JSON.stringify({
    instruction: 'Return strict JSON for a creator video/script assistant. Include title, hook, sceneBreakdown, dialogue, voiceover, cta, estimatedDuration, platform, productionNotes, hookOptions. No markdown.',
    userMessage,
    conversationHistory: conversationHistory?.slice(-8),
    platform,
    scriptType,
    brandProfile: getBrandContext(brandProfile),
    campaign: campaign ? { name: campaign.name, goal: campaign.goal, targetAudience: campaign.targetAudience } : null
  });

  if ([PROVIDER_GEMINI, 'auto'].includes(env.aiProvider) && (process.env.GEMINI_API_KEY || env.geminiApiKey)) {
    for (const model of getGeminiModelCandidates()) {
      try {
        const result = await withTimeout(async signal => {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': process.env.GEMINI_API_KEY || env.geminiApiKey
            },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
            signal
          });
          if (!response.ok) throw new Error(`Gemini failed with ${response.status}`);
          const payload = await response.json();
          const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          return validateScriptDraft(parseJsonFromText(text), fallback);
        }, env.aiTimeoutMs);
        return { scriptDraft: result, aiProvider: PROVIDER_GEMINI };
      } catch (_error) {
        continue;
      }
    }
  }

  if ([PROVIDER_GROQ, 'auto'].includes(env.aiProvider) && env.groqApiKey) {
    try {
      const result = await withTimeout(async signal => {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.groqApiKey}`
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            temperature: 0.5
          }),
          signal
        });
        if (!response.ok) throw new Error(`Groq failed with ${response.status}`);
        const payload = await response.json();
        return validateScriptDraft(parseJsonFromText(payload?.choices?.[0]?.message?.content || ''), fallback);
      }, env.aiTimeoutMs);
      return { scriptDraft: result, aiProvider: PROVIDER_GROQ };
    } catch (_error) {
      return null;
    }
  }

  return null;
};

export const generateScriptDraft = async ({ userMessage, conversationHistory = [], platform = 'youtube_shorts', scriptType = 'reel script', brandProfile = null, campaign = null }) => {
  const fallback = buildTemplateScriptDraft({ userMessage, platform, scriptType, brandProfile, campaign });
  const providerResult = await tryProviderScriptDraft({
    userMessage,
    conversationHistory,
    platform,
    scriptType,
    brandProfile,
    campaign,
    fallback
  });
  const scriptDraft = providerResult?.scriptDraft || fallback;
  const aiProvider = providerResult?.aiProvider || PROVIDER_TEMPLATE;
  return {
    assistantMessage: `Drafted a ${scriptType} for ${platformRules[platform]?.name || platform}.`,
    scriptDraft,
    aiProvider
  };
};
