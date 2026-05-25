import mongoose from 'mongoose';

import { SUPPORTED_PLATFORMS } from '../constants/platforms.js';

const { Schema } = mongoose;

const socialReplySchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    socialCommentId: { type: Schema.Types.ObjectId, ref: 'SocialComment', required: true, index: true },
    platformConnectionId: { type: Schema.Types.ObjectId, ref: 'PlatformConnection', required: true },
    platform: { type: String, enum: SUPPORTED_PLATFORMS, required: true },
    providerReplyId: { type: String, default: '' },
    replyText: { type: String, required: true },
    repliedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    accountSnapshot: { type: Schema.Types.Mixed, default: {} },
    source: { type: String, enum: ['real'], default: 'real' }
  },
  { timestamps: true }
);

const SocialReply = mongoose.model('SocialReply', socialReplySchema);

export default SocialReply;
