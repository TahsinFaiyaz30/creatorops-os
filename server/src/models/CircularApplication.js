import mongoose from 'mongoose';

const { Schema } = mongoose;

export const CIRCULAR_APPLICATION_STATUSES = [
  'submitted',
  'viewed',
  'shortlisted',
  'rejected',
  'accepted',
  'withdrawn'
];

const circularApplicationSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    circularId: { type: Schema.Types.ObjectId, ref: 'BrandCircular', required: true, index: true },
    creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    message: { type: String, default: '' },
    creatorProfileSummary: { type: String, default: '' },
    combinedStatsSnapshot: { type: Schema.Types.Mixed, default: {} },
    platformStatsSnapshot: { type: Schema.Types.Mixed, default: {} },
    selectedPostIds: [{ type: Schema.Types.ObjectId, ref: 'PublishedPost' }],
    selectedMediaAssetIds: [{ type: Schema.Types.ObjectId, ref: 'MediaAsset' }],
    status: { type: String, enum: CIRCULAR_APPLICATION_STATUSES, default: 'submitted', index: true },
    viewedAt: { type: Date, default: null },
    shortlistedAt: { type: Date, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewComment: { type: String, default: '' }
  },
  { timestamps: true }
);

circularApplicationSchema.index({ workspaceId: 1, circularId: 1, creatorId: 1 }, { unique: true });
circularApplicationSchema.index({ workspaceId: 1, status: 1, createdAt: -1 });

const CircularApplication = mongoose.model('CircularApplication', circularApplicationSchema);

export default CircularApplication;
