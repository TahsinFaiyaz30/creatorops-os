import mongoose from 'mongoose';

import { SUPPORTED_PLATFORMS } from '../constants/platforms.js';

const { Schema } = mongoose;

export const PUBLISH_JOB_STATUSES = ['queued', 'publishing', 'published', 'failed', 'blocked', 'cancelled'];

const accountSnapshotSchema = new Schema(
  {
    platform: { type: String, default: '' },
    accountName: { type: String, default: '' },
    accountHandle: { type: String, default: '' },
    externalAccountId: { type: String, default: '' },
    accountType: { type: String, default: '' }
  },
  { _id: false }
);

const publishJobSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true
    },
    postGroupId: {
      type: String,
      default: '',
      index: true
    },
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      default: null
    },
    contentItemId: {
      type: Schema.Types.ObjectId,
      ref: 'ContentItem',
      default: null
    },
    variantId: {
      type: Schema.Types.ObjectId,
      ref: 'PlatformVariant',
      default: null
    },
    mediaAssetIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'MediaAsset'
      }
    ],
    platformConnectionId: {
      type: Schema.Types.ObjectId,
      ref: 'PlatformConnection',
      required: true,
      index: true
    },
    platform: {
      type: String,
      enum: SUPPORTED_PLATFORMS,
      required: true
    },
    accountSnapshot: {
      type: accountSnapshotSchema,
      default: () => ({})
    },
    caption: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: PUBLISH_JOB_STATUSES,
      default: 'queued',
      index: true
    },
    scheduledAt: {
      type: Date,
      default: () => new Date(),
      index: true
    },
    providerPostId: {
      type: String,
      default: ''
    },
    providerPostUrl: {
      type: String,
      default: ''
    },
    providerRawResponse: {
      type: Schema.Types.Mixed,
      default: null
    },
    errorCode: {
      type: String,
      default: ''
    },
    errorMessage: {
      type: String,
      default: ''
    },
    retryCount: {
      type: Number,
      default: 0
    },
    lastAttemptAt: {
      type: Date,
      default: null
    },
    publishedAt: {
      type: Date,
      default: null
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true }
);

publishJobSchema.index({ workspaceId: 1, status: 1, scheduledAt: 1 });
publishJobSchema.index({ workspaceId: 1, campaignId: 1 });
publishJobSchema.index({ workspaceId: 1, postGroupId: 1 });

const PublishJob = mongoose.model('PublishJob', publishJobSchema);

export default PublishJob;
