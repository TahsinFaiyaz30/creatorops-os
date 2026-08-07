import mongoose from 'mongoose';

const { Schema } = mongoose;

export const HANDOFF_STATUSES = ['sent', 'acknowledged', 'accepted', 'returned'];

/*
 * Passing finished work to specific teammates through the platform, rather than
 * over a chat app with a file attached. `toUserIds` is a list because the same
 * bundle often goes to more than one person — the editor and the publisher.
 */
const handoffSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
    deliverableId: { type: Schema.Types.ObjectId, ref: 'Deliverable', required: true, index: true },
    fromUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    toUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    note: { type: String, default: '' },
    dueAt: { type: Date, default: null },
    status: { type: String, enum: HANDOFF_STATUSES, default: 'sent', index: true },
    respondedAt: { type: Date, default: null },
    respondedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

handoffSchema.index({ workspaceId: 1, toUserIds: 1, status: 1, createdAt: -1 });

const Handoff = mongoose.model('Handoff', handoffSchema);

export default Handoff;
