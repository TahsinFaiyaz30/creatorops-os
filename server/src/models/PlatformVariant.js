import mongoose from 'mongoose';

import { SUPPORTED_PLATFORMS } from '../constants/platforms.js';
import { CONTENT_STATUSES } from './ContentItem.js';

const { Schema } = mongoose;

export { SUPPORTED_PLATFORMS };

const platformVariantSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true
    },
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true
    },
    contentItemId: {
      type: Schema.Types.ObjectId,
      ref: 'ContentItem',
      required: true
    },
    platform: {
      type: String,
      enum: SUPPORTED_PLATFORMS,
      required: true
    },
    caption: {
      type: String,
      default: ''
    },
    hook: {
      type: String,
      default: ''
    },
    cta: {
      type: String,
      default: ''
    },
    hashtags: {
      type: [String],
      default: []
    },
    platformNotes: {
      type: [String],
      default: []
    },
    visibilityOptions: {
      type: [String],
      default: ['public']
    },
    recommendedVisibility: {
      type: String,
      enum: ['public', 'private', 'friends_only'],
      default: 'public'
    },
    brandScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    readinessScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    warnings: {
      type: [String],
      default: []
    },
    suggestions: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: CONTENT_STATUSES,
      default: 'draft'
    },
    aiProvider: {
      type: String,
      default: 'template-fallback'
    }
  },
  { timestamps: true }
);

platformVariantSchema.index({ workspaceId: 1 });
platformVariantSchema.index({ campaignId: 1 });
platformVariantSchema.index({ contentItemId: 1 });
platformVariantSchema.index({ status: 1 });
platformVariantSchema.index({ platform: 1 });

const PlatformVariant = mongoose.model('PlatformVariant', platformVariantSchema);

export default PlatformVariant;
