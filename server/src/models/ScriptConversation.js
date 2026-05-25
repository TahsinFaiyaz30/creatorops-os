import mongoose from 'mongoose';

import { SUPPORTED_PLATFORMS } from '../constants/platforms.js';

const { Schema } = mongoose;

const scriptMessageSchema = new Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, default: '' },
    structured: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: () => new Date() }
  },
  { _id: false }
);

const scriptConversationSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', default: null, index: true },
    title: { type: String, default: 'Script conversation' },
    platform: { type: String, enum: SUPPORTED_PLATFORMS, default: 'youtube_shorts' },
    scriptType: { type: String, default: 'reel script' },
    messages: { type: [scriptMessageSchema], default: [] },
    finalScript: { type: Schema.Types.Mixed, default: {} },
    aiProvider: { type: String, default: 'template-fallback' }
  },
  { timestamps: true }
);

scriptConversationSchema.index({ workspaceId: 1, userId: 1, createdAt: -1 });
scriptConversationSchema.index({ workspaceId: 1, campaignId: 1, createdAt: -1 });

const ScriptConversation = mongoose.model('ScriptConversation', scriptConversationSchema);

export default ScriptConversation;
