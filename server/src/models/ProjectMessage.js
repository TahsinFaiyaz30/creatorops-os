import mongoose from 'mongoose';

const { Schema } = mongoose;

/*
 * Project-scoped conversation. Only members of the project can read or write it,
 * which is the "only assigned members can interconnect" rule — enforced by
 * assertProjectAccess on every read and write, and by a per-project socket room
 * so a non-member does not even receive the frames.
 */
const projectMessageSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true },
    attachmentIds: [{ type: Schema.Types.ObjectId, ref: 'MediaAsset' }],
    parentId: { type: Schema.Types.ObjectId, ref: 'ProjectMessage', default: null },
    editedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

projectMessageSchema.index({ projectId: 1, createdAt: 1 });

const ProjectMessage = mongoose.model('ProjectMessage', projectMessageSchema);

export default ProjectMessage;
