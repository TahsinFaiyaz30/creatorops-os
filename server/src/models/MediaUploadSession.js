import mongoose from 'mongoose';

import { MEDIA_STORAGE_INTENTS, MEDIA_TYPES } from './MediaAsset.js';

const { Schema } = mongoose;

export const MEDIA_UPLOAD_SESSION_STATUSES = ['uploading', 'paused', 'completed', 'cancelled', 'failed'];

const mediaUploadSessionSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    uploadKey: {
      type: String,
      required: true,
      index: true
    },
    originalName: {
      type: String,
      required: true
    },
    mimeType: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true,
      min: 0
    },
    mediaType: {
      type: String,
      enum: MEDIA_TYPES,
      required: true
    },
    expectedSha256: {
      type: String,
      required: true
    },
    actualSha256: {
      type: String,
      default: ''
    },
    bytesReceived: {
      type: Number,
      default: 0,
      min: 0
    },
    localPath: {
      type: String,
      required: true,
      select: false
    },
    publicUrl: {
      type: String,
      default: ''
    },
    storageIntent: {
      type: String,
      enum: MEDIA_STORAGE_INTENTS,
      default: 'library'
    },
    cleanupGroupId: {
      type: String,
      default: '',
      index: true
    },
    cropMetadata: {
      type: Schema.Types.Mixed,
      default: null
    },
    status: {
      type: String,
      enum: MEDIA_UPLOAD_SESSION_STATUSES,
      default: 'uploading',
      index: true
    },
    failureReason: {
      type: String,
      default: ''
    },
    mediaAssetId: {
      type: Schema.Types.ObjectId,
      ref: 'MediaAsset',
      default: null
    },
    completedAt: {
      type: Date,
      default: null
    },
    cancelledAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.localPath;
        return ret;
      }
    },
    toObject: {
      transform: (_doc, ret) => {
        delete ret.localPath;
        return ret;
      }
    }
  }
);

mediaUploadSessionSchema.index({ workspaceId: 1, uploadedBy: 1, uploadKey: 1 }, { unique: true });
mediaUploadSessionSchema.index({ workspaceId: 1, status: 1, updatedAt: -1 });

const MediaUploadSession = mongoose.model('MediaUploadSession', mediaUploadSessionSchema);

export default MediaUploadSession;
