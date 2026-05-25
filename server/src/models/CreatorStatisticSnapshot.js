import mongoose from 'mongoose';

const { Schema } = mongoose;

export const CREATOR_STATISTIC_SOURCES = ['real_sync', 'application_snapshot', 'manual_import', 'unavailable'];

const creatorStatisticSnapshotSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    source: { type: String, enum: CREATOR_STATISTIC_SOURCES, default: 'unavailable' },
    combinedStats: { type: Schema.Types.Mixed, default: {} },
    platformStats: { type: Schema.Types.Mixed, default: {} },
    generatedAt: { type: Date, default: () => new Date(), index: true }
  },
  { timestamps: true }
);

creatorStatisticSnapshotSchema.index({ workspaceId: 1, creatorId: 1, generatedAt: -1 });

const CreatorStatisticSnapshot = mongoose.model('CreatorStatisticSnapshot', creatorStatisticSnapshotSchema);

export default CreatorStatisticSnapshot;
