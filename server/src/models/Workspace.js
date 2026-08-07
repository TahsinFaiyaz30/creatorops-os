import mongoose from 'mongoose';

const { Schema } = mongoose;

export const WORKSPACE_TYPES = ['personal', 'team'];

const workspaceSettingsSchema = new Schema(
  {
    /*
     * The release gate. When on, a PublishJob cannot leave `queued` without an
     * approved publish_release. Turned on automatically the moment a second
     * member joins, so a solo creator is never asked to approve their own work.
     */
    requirePublishApproval: { type: Boolean, default: false },
    /* Work must clear review before it can be handed to the next member. */
    requireApprovalToHandoff: { type: Boolean, default: false }
  },
  { _id: false }
);

const workspaceSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    /* 'personal' is the workspace created at signup — a team of one. */
    type: { type: String, enum: WORKSPACE_TYPES, default: 'personal', index: true },
    description: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
    settings: { type: workspaceSettingsSchema, default: () => ({}) }
  },
  { timestamps: true }
);

const Workspace = mongoose.model('Workspace', workspaceSchema);

export default Workspace;
