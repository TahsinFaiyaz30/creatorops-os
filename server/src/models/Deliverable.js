import mongoose from 'mongoose';

const { Schema } = mongoose;

export const DELIVERABLE_KINDS = ['media_set', 'caption_set', 'script', 'full_post', 'other'];
export const DELIVERABLE_STATUSES = [
  'draft',
  'submitted',
  'in_review',
  'approved',
  'changes_requested',
  'rejected'
];

/*
 * What a member actually hands in.
 *
 * The head reviews this — "here are the four images and the caption you asked
 * for" — rather than a database row. It is also the unit other tasks wait on:
 * ContentItem.blockedByDeliverableIds points here, so approving one is what
 * unlocks the next person's work.
 */
const deliverableSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
    taskId: { type: Schema.Types.ObjectId, ref: 'ContentItem', default: null, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    kind: { type: String, enum: DELIVERABLE_KINDS, default: 'other' },
    title: { type: String, required: true, trim: true },
    notes: { type: String, default: '' },

    mediaAssetIds: [{ type: Schema.Types.ObjectId, ref: 'MediaAsset' }],
    variantIds: [{ type: Schema.Types.ObjectId, ref: 'PlatformVariant' }],

    status: { type: String, enum: DELIVERABLE_STATUSES, default: 'draft', index: true },
    currentApprovalId: { type: Schema.Types.ObjectId, ref: 'ApprovalRequest', default: null },
    /* Bumped every time changes are requested, so the history reads as v1, v2… */
    revision: { type: Number, default: 1, min: 1 },
    submittedAt: { type: Date, default: null },
    decidedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

deliverableSchema.index({ workspaceId: 1, projectId: 1, status: 1 });
deliverableSchema.index({ workspaceId: 1, ownerId: 1, status: 1 });

const Deliverable = mongoose.model('Deliverable', deliverableSchema);

export default Deliverable;
