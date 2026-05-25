import mongoose from 'mongoose';

import { SUPPORTED_PLATFORMS } from '../constants/platforms.js';

const { Schema } = mongoose;

export const BRAND_CIRCULAR_STATUSES = ['draft', 'published', 'closed', 'archived'];

const deliverablesSchema = new Schema(
  {
    reels: { type: Number, default: 0 },
    posts: { type: Number, default: 0 },
    stories: { type: Number, default: 0 },
    videos: { type: Number, default: 0 },
    notes: { type: String, default: '' }
  },
  { _id: false }
);

const brandCircularSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    brandRepId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    productName: { type: String, required: true, trim: true },
    productDescription: { type: String, default: '' },
    productCategory: { type: String, default: '' },
    targetAudience: { type: String, default: '' },
    campaignObjective: { type: String, default: '' },
    platforms: { type: [String], enum: SUPPORTED_PLATFORMS, default: [] },
    deliverables: { type: deliverablesSchema, default: () => ({}) },
    contentFormats: { type: [String], default: [] },
    deadline: { type: Date, default: null, index: true },
    budgetAmount: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'USD' },
    eligibilityRequirements: { type: String, default: '' },
    brandDemands: { type: String, default: '' },
    judgingCriteria: { type: String, default: '' },
    mediaAssetIds: [{ type: Schema.Types.ObjectId, ref: 'MediaAsset' }],
    status: { type: String, enum: BRAND_CIRCULAR_STATUSES, default: 'draft', index: true }
  },
  { timestamps: true }
);

brandCircularSchema.index({ workspaceId: 1, brandRepId: 1 });
brandCircularSchema.index({ workspaceId: 1, status: 1, deadline: 1 });
brandCircularSchema.index({ workspaceId: 1, createdAt: -1 });

const BrandCircular = mongoose.model('BrandCircular', brandCircularSchema);

export default BrandCircular;
