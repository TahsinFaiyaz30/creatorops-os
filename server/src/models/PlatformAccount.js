import mongoose from 'mongoose';

import { SUPPORTED_PLATFORMS } from '../constants/platforms.js';

const { Schema } = mongoose;

export const PLATFORM_ACCOUNT_TYPES = ['brand', 'creator', 'client', 'page', 'shop', 'blog'];
export const PLATFORM_ACCOUNT_STATUSES = [
  'connected',
  'disconnected',
  'expired',
  'missing_permissions',
  'blocked'
];

const platformAccountSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true
    },
    platform: {
      type: String,
      enum: SUPPORTED_PLATFORMS,
      required: true
    },
    accountName: {
      type: String,
      required: true,
      trim: true
    },
    accountHandle: {
      type: String,
      required: true,
      trim: true
    },
    accountType: {
      type: String,
      enum: PLATFORM_ACCOUNT_TYPES,
      default: 'brand'
    },
    status: {
      type: String,
      enum: PLATFORM_ACCOUNT_STATUSES,
      default: 'connected'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true }
);

platformAccountSchema.index({ workspaceId: 1 });
platformAccountSchema.index({ platform: 1 });
platformAccountSchema.index({ status: 1 });
platformAccountSchema.index({ isActive: 1 });
platformAccountSchema.index({ workspaceId: 1, platform: 1, accountHandle: 1 }, { unique: true });

const PlatformAccount = mongoose.model('PlatformAccount', platformAccountSchema);

export default PlatformAccount;
