import mongoose from 'mongoose';

import {
  PLATFORM_ACCOUNT_TYPES,
  PLATFORM_CONNECTION_MODES,
  PLATFORM_CONNECTION_STATUSES,
  SUPPORTED_PLATFORMS
} from '../constants/platforms.js';

const { Schema } = mongoose;

const capabilitySchema = new Schema(
  {
    publish: { type: Boolean, default: false },
    schedule: { type: Boolean, default: false },
    analytics: { type: Boolean, default: false },
    comments: { type: Boolean, default: false },
    replies: { type: Boolean, default: false },
    mediaUpload: { type: Boolean, default: false },
    delete: { type: Boolean, default: false }
  },
  { _id: false }
);

const platformConnectionSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true
    },
    platform: {
      type: String,
      enum: SUPPORTED_PLATFORMS,
      required: true,
      index: true
    },
    connectionMode: {
      type: String,
      enum: PLATFORM_CONNECTION_MODES,
      required: true
    },
    accountName: {
      type: String,
      default: ''
    },
    accountHandle: {
      type: String,
      default: ''
    },
    externalAccountId: {
      type: String,
      default: ''
    },
    accountType: {
      type: String,
      enum: PLATFORM_ACCOUNT_TYPES,
      default: 'profile'
    },
    status: {
      type: String,
      enum: PLATFORM_CONNECTION_STATUSES,
      default: 'not_configured',
      index: true
    },
    scopes: {
      type: [String],
      default: []
    },
    missingScopes: {
      type: [String],
      default: []
    },
    tokenExpiresAt: {
      type: Date,
      default: null
    },
    encryptedAccessToken: {
      type: String,
      select: false,
      default: ''
    },
    encryptedRefreshToken: {
      type: String,
      select: false,
      default: ''
    },
    encryptedApiSecret: {
      type: String,
      select: false,
      default: ''
    },
    encryptedAppPassword: {
      type: String,
      select: false,
      default: ''
    },
    platformMetadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    capabilities: {
      type: capabilitySchema,
      default: () => ({})
    },
    lastHealthCheckAt: {
      type: Date,
      default: null
    },
    lastErrorCode: {
      type: String,
      default: ''
    },
    lastErrorMessage: {
      type: String,
      default: ''
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.encryptedAccessToken;
        delete ret.encryptedRefreshToken;
        delete ret.encryptedApiSecret;
        delete ret.encryptedAppPassword;
        return ret;
      }
    },
    toObject: {
      transform: (_doc, ret) => {
        delete ret.encryptedAccessToken;
        delete ret.encryptedRefreshToken;
        delete ret.encryptedApiSecret;
        delete ret.encryptedAppPassword;
        return ret;
      }
    }
  }
);

platformConnectionSchema.index({ workspaceId: 1, platform: 1, externalAccountId: 1 });
platformConnectionSchema.index({ workspaceId: 1, status: 1 });

const PlatformConnection = mongoose.model('PlatformConnection', platformConnectionSchema);

export default PlatformConnection;
