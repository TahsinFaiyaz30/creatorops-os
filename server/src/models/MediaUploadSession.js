import mongoose from 'mongoose';

import { MEDIA_STORAGE_INTENTS, MEDIA_STORAGE_PROVIDERS, MEDIA_TYPES } from './MediaAsset.js';

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
    storageProvider: {
      type: String,
      enum: MEDIA_STORAGE_PROVIDERS,
      default: 's3',
      index: true
    },
    objectKey: {
      type: String,
      default: '',
      select: false
    },
    multipartUploadId: {
      type: String,
      default: '',
      select: false
    },
    multipartParts: {
      type: [
        {
          partNumber: { type: Number, required: true },
          etag: { type: String, default: '' },
          size: { type: Number, required: true },
          start: { type: Number, required: true },
          end: { type: Number, required: true }
        }
      ],
      default: [],
      select: false
    },
    chunkLease: {
      type: {
        token: { type: String, default: '' },
        startedAt: { type: Date, default: null },
        expiresAt: { type: Date, default: null }
      },
      default: () => ({ token: '', startedAt: null, expiresAt: null }),
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
    /*
     * Carried from upload start onto the finished MediaAsset. The project has to
     * be chosen before the bytes go up, because that is the only moment the
     * uploader has the context; asking afterwards would mean the file sits in the
     * shared library — visible to the whole team — until someone remembers.
     */
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      default: null
    },
    cleanupGroupId: {
      type: String,
      default: '',
      index: true
    },
    storageHardDeleteAt: {
      type: Date,
      default: null,
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
        delete ret.objectKey;
        delete ret.multipartUploadId;
        delete ret.multipartParts;
        delete ret.chunkLease;
        return ret;
      }
    },
    toObject: {
      transform: (_doc, ret) => {
        delete ret.objectKey;
        delete ret.multipartUploadId;
        delete ret.multipartParts;
        delete ret.chunkLease;
        return ret;
      }
    }
  }
);

mediaUploadSessionSchema.index({ workspaceId: 1, uploadedBy: 1, uploadKey: 1 }, { unique: true });
mediaUploadSessionSchema.index({ workspaceId: 1, status: 1, updatedAt: -1 });
mediaUploadSessionSchema.index({ storageIntent: 1, status: 1, storageHardDeleteAt: 1 });
mediaUploadSessionSchema.index({ storageIntent: 1, mediaAssetId: 1, createdAt: 1 });
mediaUploadSessionSchema.index({ storageIntent: 1, status: 1, mediaAssetId: 1, updatedAt: 1 });

const MediaUploadSession = mongoose.model('MediaUploadSession', mediaUploadSessionSchema);

export default MediaUploadSession;
