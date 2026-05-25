import mongoose from 'mongoose';

import { SUPPORTED_PLATFORMS } from './PlatformVariant.js';

const { Schema } = mongoose;

export const SCHEDULE_STATUSES = ['queued', 'processing', 'published', 'failed', 'cancelled'];

const scheduleJobSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true
    },
    contentItemId: {
      type: Schema.Types.ObjectId,
      ref: 'ContentItem',
      required: true
    },
    variantId: {
      type: Schema.Types.ObjectId,
      ref: 'PlatformVariant',
      required: true
    },
    platformAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'PlatformAccount',
      default: null
    },
    platformAccountSnapshot: {
      platform: { type: String, default: '' },
      accountName: { type: String, default: '' },
      accountHandle: { type: String, default: '' },
      accountType: { type: String, default: '' },
      status: { type: String, default: '' }
    },
    platform: {
      type: String,
      enum: SUPPORTED_PLATFORMS,
      required: true
    },
    scheduledAt: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: SCHEDULE_STATUSES,
      default: 'queued'
    },
    adapterName: {
      type: String,
      default: 'simulated-publisher'
    },
    resultMessage: {
      type: String,
      default: ''
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true }
);

scheduleJobSchema.index({ workspaceId: 1 });
scheduleJobSchema.index({ status: 1 });
scheduleJobSchema.index({ scheduledAt: 1 });
scheduleJobSchema.index({ platformAccountId: 1 });

const ScheduleJob = mongoose.model('ScheduleJob', scheduleJobSchema);

export default ScheduleJob;
