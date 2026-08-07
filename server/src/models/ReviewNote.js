import mongoose from 'mongoose';

const { Schema } = mongoose;

/*
 * "Request edit on a media or a caption" — a note pinned to the thing that needs
 * changing, not a comment floating next to the whole submission. Never touches a
 * published post: this is review of work that has not shipped yet.
 */
const reviewNoteSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    approvalId: { type: Schema.Types.ObjectId, ref: 'ApprovalRequest', default: null, index: true },
    deliverableId: { type: Schema.Types.ObjectId, ref: 'Deliverable', default: null, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true },
    /* e.g. "caption", "media:<assetId>", "variant:<variantId>" */
    targetField: { type: String, default: '' },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

reviewNoteSchema.index({ workspaceId: 1, deliverableId: 1, createdAt: 1 });

const ReviewNote = mongoose.model('ReviewNote', reviewNoteSchema);

export default ReviewNote;
