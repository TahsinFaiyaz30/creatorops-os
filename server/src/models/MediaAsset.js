import mongoose from 'mongoose';

const { Schema } = mongoose;

export const MEDIA_TYPES = ['image', 'video'];
export const MEDIA_STATUSES = ['uploaded', 'ready', 'failed'];

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
      positionY: { type: Number, default: 50 }
    },
    status: {
      type: String,
      enum: MEDIA_STATUSES,
      default: 'ready'
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
