import mongoose from 'mongoose';

const { Schema } = mongoose;

export const APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'changes_requested'];

const approvalRequestSchema = new Schema(
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

const ApprovalRequest = mongoose.model('ApprovalRequest', approvalRequestSchema);

export default ApprovalRequest;
