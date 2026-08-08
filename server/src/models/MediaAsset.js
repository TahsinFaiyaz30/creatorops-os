import mongoose from 'mongoose';

const { Schema } = mongoose;

export const MEDIA_TYPES = ['image', 'video'];
export const MEDIA_STATUSES = ['uploaded', 'ready', 'failed'];
export const MEDIA_STORAGE_INTENTS = ['library', 'temporary_publish'];
export const MEDIA_STORAGE_PROVIDERS = ['s3'];

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * Media uploaded before this workspace moved to object storage.
 *
 * Those assets were written to the API server's local disk and served from
 * `app.use('/uploads', express.static(...))`. The R2/S3 migration removed that
 * route, and on an ephemeral host the files went with the next deploy — but the
 * rows survived, still carrying `publicUrl: "/uploads/<workspace>/<file>"` and
 * no `objectKey`.
 *
 * The API kept handing that path to the client, so opening one of these assets
 * navigated to the API and got `{"message":"Route not found: GET /uploads/…"}`.
 * There is no file to serve and nothing to repoint at, so the only honest
 * answer is to stop advertising a URL and say why.
 *
 * Detection deliberately keys on the URL shape rather than on a missing
 * `objectKey`: `objectKey` is `select: false`, so a caller that forgot to ask
 * for it would otherwise see every healthy asset as broken.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const LEGACY_LOCAL_DISK_URL = /^\/?uploads\//i;

const serializeAsset = ret => {
  delete ret.objectKey;

  if (LEGACY_LOCAL_DISK_URL.test(ret.publicUrl || '')) {
    ret.publicUrl = '';
    ret.isStored = false;
    ret.unavailableReason =
      'Uploaded before this workspace moved to cloud storage. The original file lived on the old server and did not survive the move — re-upload it to use it again.';
  } else {
    ret.isStored = Boolean(ret.publicUrl);
  }

  return ret;
};

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
    /*
     * Project scoping. MediaAsset is workspace-scoped, so without this every
     * project member would see the whole team library — including assets from
     * projects they were deliberately kept out of, which would leave the
     * isolation promise only half true. null = shared team library.
     */
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      default: null,
      index: true
    },
    visibility: {
      type: String,
      enum: ['team', 'project'],
      default: 'team'
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
    sha256: {
      type: String,
      default: ''
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
    storageETag: {
      type: String,
      default: ''
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
    },
    storageHardDeleteAt: {
      type: Date,
      default: null,
      index: true
    }
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret) => serializeAsset(ret) },
    toObject: { transform: (_doc, ret) => serializeAsset(ret) }
  }
);

mediaAssetSchema.index({ workspaceId: 1, createdAt: -1 });
mediaAssetSchema.index({ storageIntent: 1, storageHardDeleteAt: 1 });

const MediaAsset = mongoose.model('MediaAsset', mediaAssetSchema);

export default MediaAsset;
