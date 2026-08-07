import mongoose from 'mongoose';

import { SUPPORTED_PLATFORMS } from '../constants/platforms.js';

const { Schema } = mongoose;

const campaignSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    goal: {
      type: String,
      default: ''
    },
    targetAudience: {
      type: String,
      default: ''
    },
    platforms: {
      type: [String],
      enum: SUPPORTED_PLATFORMS,
      default: []
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'archived'],
      default: 'active'
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    /*
     * ── Project fields ──────────────────────────────────────────────────────
     * A Campaign is presented as a Project once a workspace becomes a team. The
     * collection keeps its name: renaming it would be a data migration with no
     * upside, and every foreign key in the app already says campaignId.
     */
    leadId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    /*
     * THE visibility boundary. A member sees this project only if they are in
     * here, or hold project.view_all. Enforced in assertProjectAccess, once.
     */
    memberIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    /* What the head actually wants, in their own words. */
    brief: { type: String, default: '' },
    deadline: { type: Date, default: null },
    priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
    visibility: { type: String, enum: ['project_members', 'team'], default: 'project_members' }
  },
  { timestamps: true }
);

campaignSchema.index({ workspaceId: 1 });
campaignSchema.index({ status: 1 });
campaignSchema.index({ createdBy: 1 });
/* "which projects am I on" — the only query the project list runs for a member. */
campaignSchema.index({ workspaceId: 1, memberIds: 1, createdAt: -1 });

const Campaign = mongoose.model('Campaign', campaignSchema);

export default Campaign;
