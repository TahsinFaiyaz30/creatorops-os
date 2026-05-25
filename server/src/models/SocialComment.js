import mongoose from 'mongoose';

import { SUPPORTED_PLATFORMS } from '../constants/platforms.js';

const { Schema } = mongoose;

const socialCommentSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    publishedPostId: { type: Schema.Types.ObjectId, ref: 'PublishedPost', required: true, index: true },
    platformConnectionId: { type: Schema.Types.ObjectId, ref: 'PlatformConnection', required: true },
    platform: { type: String, enum: SUPPORTED_PLATFORMS, required: true },
    providerCommentId: { type: String, required: true },
    providerThreadId: { type: String, default: '' },
    parentProviderCommentId: { type: String, default: '' },
    isProviderReply: { type: Boolean, default: false, index: true },
    authorName: { type: String, default: '' },
    authorHandle: { type: String, default: '' },
    text: { type: String, default: '' },
    likeCount: { type: Number, default: 0 },
    replyCount: { type: Number, default: 0 },
    isReplied: { type: Boolean, default: false },
    rawProviderData: { type: Schema.Types.Mixed, default: {} },
    source: { type: String, enum: ['real'], default: 'real' },
    providerCreatedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

socialCommentSchema.index({ workspaceId: 1, providerCommentId: 1, platformConnectionId: 1 }, { unique: true });
socialCommentSchema.index({ workspaceId: 1, publishedPostId: 1, parentProviderCommentId: 1 });

const SocialComment = mongoose.model('SocialComment', socialCommentSchema);

export default SocialComment;
