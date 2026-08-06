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

/** Exactly two cross-platform posts back every application — see REQUIRED_POST_COUNT usage. */
export const REQUIRED_APPLICATION_POST_COUNT = 2;

const circularApplicationSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    circularId: { type: Schema.Types.ObjectId, ref: 'BrandCircular', required: true, index: true },
    creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    message: { type: String, default: '' },
    creatorProfileSummary: { type: String, default: '' },
    combinedStatsSnapshot: { type: Schema.Types.Mixed, default: {} },
    platformStatsSnapshot: { type: Schema.Types.Mixed, default: {} },
    /*
     * The server-generated figures a brand actually reviews: last-window means
     * averaged across the circular's required platforms only. Frozen at submit
     * time so a brand always sees the numbers the creator applied with.
     */
    meanStatsSnapshot: { type: Schema.Types.Mixed, default: {} },
    commonPlatforms: { type: [String], default: [] },
    analyticsWindow: {
      days: { type: Number, default: 0 },
      start: { type: Date, default: null },
      end: { type: Date, default: null }
    },
    /*
     * Internal ordering key derived from meanStatsSnapshot at submit time (see
     * computeApplicantRankingScore). Stored rather than computed per request so
     * a brand's applicant list is an indexed read, and projected out of every
     * response so the figure never reaches the client.
     */
    rankingScore: { type: Number, default: 0 },
    selectedPostIds: [{ type: Schema.Types.ObjectId, ref: 'PublishedPost' }],
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
/*
 * Covers the brand's applicant list end to end: equality on the circular, then
 * the ranking key and the createdAt tie-break already in descending order. Mongo
 * walks this index and returns rows sorted, so no comparison sort runs per
 * request and the 32MB in-memory sort ceiling cannot be reached.
 */
circularApplicationSchema.index({ circularId: 1, rankingScore: -1, createdAt: -1 });

const CircularApplication = mongoose.model('CircularApplication', circularApplicationSchema);

export default CircularApplication;
