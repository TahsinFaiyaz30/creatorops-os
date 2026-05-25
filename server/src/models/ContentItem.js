import mongoose from 'mongoose';

const { Schema } = mongoose;

export const CONTENT_STATUSES = [
  'idea',
  'draft',
  'in_review',
  'approved',
  'scheduled',
  'published',
  'rejected',
  'changes_requested'
];

const contentItemSchema = new Schema(
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
    title: {
      type: String,
      required: true,
      trim: true
    },
    rawIdea: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: CONTENT_STATUSES,
      default: 'idea'
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    currentVersion: {
      type: Number,
      default: 1,
      min: 1
    }
  },
  { timestamps: true }
);

contentItemSchema.index({ workspaceId: 1 });
contentItemSchema.index({ campaignId: 1 });
contentItemSchema.index({ status: 1 });
contentItemSchema.index({ createdAt: 1 });

const ContentItem = mongoose.model('ContentItem', contentItemSchema);

export default ContentItem;
