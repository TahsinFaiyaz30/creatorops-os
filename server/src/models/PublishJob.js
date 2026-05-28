import mongoose from 'mongoose';

import { SUPPORTED_PLATFORMS } from '../constants/platforms.js';

const { Schema } = mongoose;

export const PUBLISH_JOB_STATUSES = ['queued', 'publishing', 'paused', 'published', 'failed', 'blocked', 'cancelled'];
export const PUBLISH_VISIBILITIES = ['public', 'private', 'friends_only'];

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

const providerUploadSchema = new Schema(
  {
    phase: { type: String, default: '' },
    bytesUploaded: { type: Number, default: 0, min: 0 },
    totalBytes: { type: Number, default: 0, min: 0 },
    percent: { type: Number, default: 0, min: 0, max: 100 },
    bytesPerSecond: { type: Number, default: 0, min: 0 },
    message: { type: String, default: '' },
    updatedAt: { type: Date, default: null }
  },
  { _id: false }
);

const providerUploadSessionSchema = new Schema(
  {
    platform: { type: String, default: '' },
    sessionType: { type: String, default: '' },
    uploadUrl: { type: String, default: '' },
    mediaFingerprint: { type: String, default: '' },
    totalBytes: { type: Number, default: 0, min: 0 },
    bytesUploaded: { type: Number, default: 0, min: 0 },
    data: { type: Schema.Types.Mixed, default: () => ({}) },
    startedAt: { type: Date, default: null },
    updatedAt: { type: Date, default: null }
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
    groupTargetCount: {
      type: Number,
      default: 1,
      min: 1
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
    visibility: {
      type: String,
      enum: PUBLISH_VISIBILITIES,
      default: 'public'
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
    processingStage: {
      type: String,
      default: 'queued'
    },
    processingMessage: {
      type: String,
      default: ''
    },
    processingStageUpdatedAt: {
      type: Date,
      default: null
    },
    providerUpload: {
      type: providerUploadSchema,
      default: () => ({})
    },
    providerUploadSession: {
      type: providerUploadSessionSchema,
      default: () => ({}),
      select: false
    },
    publishControl: {
      action: {
        type: String,
        enum: ['', 'pause_requested', 'cancel_requested'],
        default: ''
      },
      requestedAt: {
        type: Date,
        default: null
      },
      requestedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },
      message: {
        type: String,
        default: ''
      }
    },
    mediaProcessing: {
      compressOnOversize: { type: Boolean, default: false },
      compressBeforeUpload: { type: Boolean, default: false },
      lastCompressionStatus: { type: String, default: '' },
      lastCompressionMessage: { type: String, default: '' },
      lastCompressedAt: { type: Date, default: null }
    },
    lastAttemptAt: {
      type: Date,
      default: null
    },
    publishedAt: {
      type: Date,
      default: null
    },
    temporaryMediaExpiresAt: {
      type: Date,
      default: null
    },
    temporaryMediaExpiredAt: {
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
publishJobSchema.index({ workspaceId: 1, postGroupId: 1, platformConnectionId: 1, platform: 1 });
publishJobSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.providerUploadSession;
    return ret;
  }
});
publishJobSchema.set('toObject', {
  transform: (_doc, ret) => {
    delete ret.providerUploadSession;
    return ret;
  }
});

const PublishJob = mongoose.model('PublishJob', publishJobSchema);

export default PublishJob;
