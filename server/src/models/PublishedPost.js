import mongoose from 'mongoose';

import { SUPPORTED_PLATFORMS } from '../constants/platforms.js';

const { Schema } = mongoose;

export const PUBLISHED_POST_STATUSES = ['queued', 'publishing', 'published', 'failed', 'blocked'];
export const PUBLISHED_POST_VISIBILITIES = ['public', 'private', 'friends_only'];

const publishedPostSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    postGroupId: { type: String, default: '', index: true },
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', default: null },
    contentItemId: { type: Schema.Types.ObjectId, ref: 'ContentItem', default: null },
    variantId: { type: Schema.Types.ObjectId, ref: 'PlatformVariant', default: null },
    publishJobId: { type: Schema.Types.ObjectId, ref: 'PublishJob', default: null, index: true },
    mediaAssetIds: [{ type: Schema.Types.ObjectId, ref: 'MediaAsset' }],
    platformConnectionId: { type: Schema.Types.ObjectId, ref: 'PlatformConnection', required: true, index: true },
    platform: { type: String, enum: SUPPORTED_PLATFORMS, required: true },
    accountSnapshot: { type: Schema.Types.Mixed, default: {} },
    caption: { type: String, default: '' },
    visibility: { type: String, enum: PUBLISHED_POST_VISIBILITIES, default: 'public' },
    status: { type: String, enum: PUBLISHED_POST_STATUSES, default: 'queued', index: true },
    providerPostId: { type: String, default: '', index: true },
    providerPostUrl: { type: String, default: '' },
    providerRawResponse: { type: Schema.Types.Mixed, default: null },
    errorCode: { type: String, default: '' },
    errorMessage: { type: String, default: '' },
    lastAnalyticsSyncAt: { type: Date, default: null },
    lastAnalyticsErrorCode: { type: String, default: '' },
    lastAnalyticsErrorMessage: { type: String, default: '' },
    lastCommentsSyncAt: { type: Date, default: null },
    lastCommentsErrorCode: { type: String, default: '' },
    lastCommentsErrorMessage: { type: String, default: '' },
    lastCommentCount: { type: Number, default: 0 },
    publishedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

publishedPostSchema.index({ workspaceId: 1, platform: 1, publishedAt: -1 });
publishedPostSchema.index({ workspaceId: 1, postGroupId: 1 });

const PublishedPost = mongoose.model('PublishedPost', publishedPostSchema);

export default PublishedPost;
