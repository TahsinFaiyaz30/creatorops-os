import BrandProfile from '../models/BrandProfile.js';
import Campaign from '../models/Campaign.js';
import ContentItem from '../models/ContentItem.js';
import ScriptConversation from '../models/ScriptConversation.js';
import { SUPPORTED_PLATFORMS } from '../constants/platforms.js';
import { createWorkflowEvent } from './event.service.js';
import { generateScriptDraft } from './ai.service.js';

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getConversation = async ({ user, conversationId }) => {
  const conversation = await ScriptConversation.findOne({
    _id: conversationId,
    workspaceId: user.workspaceId,
    userId: user._id
  });
  if (!conversation) throw createHttpError('Script conversation not found.', 404);
  return conversation;
};

export const sendScriptMessage = async ({ user, input }) => {
  const message = String(input.message || '').trim();
  if (!message) throw createHttpError('message is required.', 400);

  const platform = SUPPORTED_PLATFORMS.includes(input.platform) ? input.platform : 'youtube_shorts';
  const scriptType = String(input.scriptType || 'reel script').trim();
  const brandProfile = await BrandProfile.findOne({ workspaceId: user.workspaceId });
  const campaign = input.campaignId
    ? await Campaign.findOne({ _id: input.campaignId, workspaceId: user.workspaceId })
    : null;
  if (input.campaignId && !campaign) throw createHttpError('Campaign not found.', 404);

  let conversation = input.conversationId
    ? await getConversation({ user, conversationId: input.conversationId })
    : null;

  if (!conversation) {
    conversation = await ScriptConversation.create({
      workspaceId: user.workspaceId,
      userId: user._id,
      campaignId: campaign?._id || null,
      title: scriptType,
      platform,
      scriptType,
      messages: []
    });
  }

  conversation.messages.push({ role: 'user', content: message });
  const aiResult = await generateScriptDraft({
    userMessage: message,
    conversationHistory: conversation.messages,
    platform,
    scriptType,
    brandProfile,
    campaign
  });

  conversation.messages.push({
    role: 'assistant',
    content: aiResult.assistantMessage,
    structured: aiResult.scriptDraft
  });
  conversation.finalScript = aiResult.scriptDraft;
  conversation.aiProvider = aiResult.aiProvider;
  conversation.platform = platform;
  conversation.scriptType = scriptType;
  conversation.title = aiResult.scriptDraft?.title || conversation.title;
  await conversation.save();

  await createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType: 'script.message_created',
    message: 'AI scripting conversation updated.',
    entityType: 'ScriptConversation',
    entityId: conversation._id,
    metadata: { conversationId: conversation._id, aiProvider: conversation.aiProvider, platform }
  });

  return { conversation, ai: aiResult };
};

export const listScriptConversations = async ({ user }) =>
  ScriptConversation.find({ workspaceId: user.workspaceId, userId: user._id })
    .sort({ updatedAt: -1 })
    .populate('campaignId', 'name goal targetAudience');

export const getScriptConversation = async ({ user, conversationId }) =>
  getConversation({ user, conversationId });

export const convertScriptToContent = async ({ user, conversationId, campaignId }) => {
  const conversation = await getConversation({ user, conversationId });
  const targetCampaignId = campaignId || conversation.campaignId;
  if (!targetCampaignId) throw createHttpError('campaignId is required to convert a script into content.', 400);
  const campaign = await Campaign.findOne({ _id: targetCampaignId, workspaceId: user.workspaceId });
  if (!campaign) throw createHttpError('Campaign not found.', 404);

  const script = conversation.finalScript || {};
  const contentItem = await ContentItem.create({
    workspaceId: user.workspaceId,
    campaignId: campaign._id,
    title: script.title || conversation.title || 'AI script',
    rawIdea: [
      script.hook ? `Hook: ${script.hook}` : '',
      script.voiceover ? `Voiceover: ${script.voiceover}` : '',
      Array.isArray(script.sceneBreakdown) ? `Scenes: ${script.sceneBreakdown.map(scene => scene.description || scene).join(' | ')}` : '',
      script.cta ? `CTA: ${script.cta}` : ''
    ].filter(Boolean).join('\n\n'),
    status: 'draft',
    createdBy: user._id
  });

  await createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType: 'script.converted_to_content',
    message: 'AI script converted into a content item.',
    entityType: 'ContentItem',
    entityId: contentItem._id,
    metadata: { conversationId: conversation._id, contentItemId: contentItem._id, campaignId: campaign._id }
  });

  return { contentItem, conversation };
};
