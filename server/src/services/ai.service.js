import env from '../config/env.js';
import BrandProfile from '../models/BrandProfile.js';
import Campaign from '../models/Campaign.js';
import ContentItem from '../models/ContentItem.js';
import PlatformVariant, { SUPPORTED_PLATFORMS } from '../models/PlatformVariant.js';
import { createWorkflowEvent } from './event.service.js';
import { createVariantVersion } from './versioning.service.js';

const PROVIDER_TEMPLATE = 'template-fallback';
const PROVIDER_GEMINI = 'gemini';
const PROVIDER_GROQ = 'groq';

const platformRules = {
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
  youtube_shorts: {
    name: 'YouTube Shorts',
    style: 'search-friendly, clear, script-like',
    hook: idea => `How to turn ${idea.toLowerCase()} into platform-ready content`,
    caption: ({ idea, brandName, targetAudience }) =>
      `Short script: Start with the problem, show how ${brandName || 'the workflow'} handles "${idea}", then give ${targetAudience || 'viewers'} one clear next step. Keep the message searchable, specific, and easy to replay.`,
    cta: 'Subscribe for the next workflow breakdown and watch the next short.',
    hashtags: ['#YouTubeGrowth', '#CreatorWorkflow', '#ContentSystem'],
    fitWords: ['how to', 'script', 'subscribe', 'watch']
  }
};

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const clampScore = value => Math.max(0, Math.min(100, Math.round(value)));

const normalizeText = value => String(value || '').trim();

const compactText = value => normalizeText(value).replace(/\s+/g, ' ');

const unique = values => [...new Set(values.filter(Boolean))];

const toArray = value => (Array.isArray(value) ? value : []);

const includesText = (source, search) =>
  normalizeText(source).toLowerCase().includes(normalizeText(search).toLowerCase());

const containsAny = (text, words) => toArray(words).some(word => word && includesText(text, word));

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
  if (platform === 'youtube_shorts') return length < 70 || length > 420 ? 8 : 0;

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
  const caption = compactText(generated.caption);
  const hook = compactText(generated.hook);
  const cta = compactText(generated.cta);
  const hashtags = unique(toArray(generated.hashtags).map(tag => (tag.startsWith('#') ? tag : `#${tag}`)));
  const brandScore = calculateBrandScore({ caption, hook, cta, brandProfile });
  const readinessScore = calculateReadinessScore({ platform, caption, hook, cta, hashtags });
  const warnings = detectWarnings({ platform, caption, hook, cta, hashtags, brandProfile });
  const suggestions = buildSuggestions({ platform, hook, cta, caption, brandProfile });

  return {
    platform,
    caption,
    hook,
    cta,
    hashtags: hashtags.length > 0 ? hashtags : rules.hashtags,
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
    const generated = {
      platform,
      hook: rules.hook(idea),
      caption: rules.caption({ idea, ...brand }),
      cta: brand.ctaStyle ? `${rules.cta} Keep the action ${brand.ctaStyle}.` : rules.cta,
      hashtags: rules.hashtags
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
    'Return strict JSON with a variants array. Each item must include platform, caption, hook, cta, hashtags. No markdown.',
  contentIdea: getContentIdea(contentItem),
  campaign: {
    name: campaign?.name,
    goal: campaign?.goal,
    targetAudience: campaign?.targetAudience
  },
  brandProfile: getBrandContext(brandProfile),
  platforms,
  platformRules
});

const tryGeminiRepurpose = async ({ contentItem, campaign, brandProfile, platforms }) => {
  if (!env.geminiApiKey) return null;

  const prompt = JSON.stringify(buildProviderPrompt({ contentItem, campaign, brandProfile, platforms }));
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.geminiApiKey}`;

  return withTimeout(
    async signal => {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        }),
        signal
      });

      if (!response.ok) {
        throw new Error(`Gemini failed with ${response.status}`);
      }

      const payload = await response.json();
      const text = payload?.candidates?.[0]?.content?.parts?.map(part => part.text).join('') || '';
      return validateProviderVariants({
        variants: parseJsonFromText(text),
        platforms,
        brandProfile,
        provider: PROVIDER_GEMINI
      });
    },
    env.aiTimeoutMs
  );
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
