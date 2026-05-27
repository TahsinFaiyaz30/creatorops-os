import mongoose from 'mongoose';

const { Schema } = mongoose;

export const MEDIA_TYPES = ['image', 'video'];
export const MEDIA_STATUSES = ['uploaded', 'ready', 'failed'];
export const MEDIA_STORAGE_INTENTS = ['library', 'temporary_publish'];

const mediaAssetSchema = new Schema(
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
      required: true
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
      required: true
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
    mediaType: {
      type: String,
      enum: MEDIA_TYPES,
      required: true
    },
    width: {
      type: Number,
      default: null
    },
    height: {
      type: Number,
      default: null
    },
    durationSeconds: {
      type: Number,
      default: null
    },
    aspectRatioOriginal: {
      type: Number,
      default: null
    },
    cropMetadata: {
      aspectRatio: { type: String, default: '9:16' },
      objectFit: { type: String, default: 'cover' },
      positionX: { type: Number, default: 50 },
      positionY: { type: Number, default: 50 },
      cropX: { type: Number, default: 0 },
      cropY: { type: Number, default: 0 },
      zoom: { type: Number, default: 1 },
      croppedAreaPixels: {
        x: { type: Number, default: null },
        y: { type: Number, default: null },
        width: { type: Number, default: null },
        height: { type: Number, default: null }
      },
      croppedAreaPercentages: {
        x: { type: Number, default: null },
        y: { type: Number, default: null },
        width: { type: Number, default: null },
        height: { type: Number, default: null }
      }
    },
    status: {
      type: String,
      enum: MEDIA_STATUSES,
      default: 'ready'
    },
    storageIntent: {
      type: String,
      enum: MEDIA_STORAGE_INTENTS,
      default: 'library',
      index: true
    },
    cleanupGroupId: {
      type: String,
      default: '',
      index: true
    },
    cleanupAt: {
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

mediaAssetSchema.index({ workspaceId: 1, createdAt: -1 });

const MediaAsset = mongoose.model('MediaAsset', mediaAssetSchema);

export default MediaAsset;
