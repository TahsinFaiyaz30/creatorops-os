import mongoose from 'mongoose';

const { Schema } = mongoose;

export const APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'changes_requested'];

/** What is being approved. */
export const APPROVAL_SUBJECT_TYPES = [
  'PlatformVariant',
  'Deliverable',
  'ContentItem',
  'MediaAsset',
  'PublishJob'
];

/**
 * `work_review`    — a member's work, and the gate that unlocks dependent tasks.
 * `publish_release` — the head releasing a post onto their own connected accounts.
 */
export const APPROVAL_KINDS = ['work_review', 'publish_release'];

const approvalRequestSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true
    },
    /*
     * Generalised from "approves one PlatformVariant" to "approves a subject".
     * contentItemId and variantId stay for the original compose flow and for
     * every row written before this change — hence no longer required.
     */
    subjectType: { type: String, enum: APPROVAL_SUBJECT_TYPES, default: 'PlatformVariant' },
    subjectId: { type: Schema.Types.ObjectId, default: null, index: true },
    kind: { type: String, enum: APPROVAL_KINDS, default: 'work_review', index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Campaign', default: null, index: true },
    /*
     * A release covers a whole cross-platform post, not one platform job — the
     * head approves "this post", and every platform in the group goes with it.
     */
    postGroupId: { type: String, default: '', index: true },
    /* Empty means "anyone holding approval.decide", which is the default team rule. */
    approverIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    approverRoleIds: [{ type: Schema.Types.ObjectId, ref: 'TeamRole' }],
    revision: { type: Number, default: 1 },
    decidedAt: { type: Date, default: null },
    contentItemId: {
      type: Schema.Types.ObjectId,
      ref: 'ContentItem',
      default: null
    },
    variantId: {
      type: Schema.Types.ObjectId,
      ref: 'PlatformVariant',
      default: null
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    status: {
      type: String,
      enum: APPROVAL_STATUSES,
      default: 'pending'
    },
    comment: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

approvalRequestSchema.index({ workspaceId: 1 });
approvalRequestSchema.index({ status: 1 });
approvalRequestSchema.index({ requestedBy: 1 });
approvalRequestSchema.index({ reviewedBy: 1 });
approvalRequestSchema.index({ workspaceId: 1, variantId: 1, status: 1 });
approvalRequestSchema.index({ workspaceId: 1, subjectType: 1, subjectId: 1, status: 1 });
/* The review queue: pending work in a team, newest first. */
approvalRequestSchema.index({ workspaceId: 1, kind: 1, status: 1, createdAt: -1 });

const ApprovalRequest = mongoose.model('ApprovalRequest', approvalRequestSchema);

export default ApprovalRequest;
