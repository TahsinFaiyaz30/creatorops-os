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
    /* Several people can work one task; assignedTo stays the primary owner. */
    assignedToIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    /*
     * The gate. This task stays locked until every listed deliverable is
     * approved — that is the mechanism behind "once the head approves, the next
     * member can start". Enforced in content.service, not just rendered.
     */
    blockedByDeliverableIds: [{ type: Schema.Types.ObjectId, ref: 'Deliverable' }],
    dueAt: { type: Date, default: null },
    order: { type: Number, default: 0 },
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
/* "what is on my plate" across every project in a team. */
contentItemSchema.index({ workspaceId: 1, assignedToIds: 1, status: 1 });

const ContentItem = mongoose.model('ContentItem', contentItemSchema);

export default ContentItem;
