import mongoose from 'mongoose';

import { normalizeTeamPermissions } from '../constants/teamPermissions.js';

const { Schema } = mongoose;

/*
 * A position inside one team, defined by the team head. Permissions are stored
 * as capability strings rather than a fixed enum of job titles, so a head can
 * invent "Thumbnail Artist" without a schema change.
 */
const teamRoleSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name: { type: String, required: true, trim: true },
    color: { type: String, default: '#8b5cf6' },
    description: { type: String, default: '' },
    permissions: { type: [String], default: [] },
    /* Exactly one per team, holds everything, cannot be edited or deleted. */
    isOwner: { type: Boolean, default: false },
    /* Seeded preset. Fully editable; the flag only drives "restore defaults". */
    isSystem: { type: Boolean, default: false },
    rank: { type: Number, default: 100 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

teamRoleSchema.index({ workspaceId: 1, name: 1 }, { unique: true });
teamRoleSchema.index({ workspaceId: 1, rank: 1 });

teamRoleSchema.pre('validate', function normalizePermissions(next) {
  this.permissions = normalizeTeamPermissions(this.permissions);
  return next();
});

const TeamRole = mongoose.model('TeamRole', teamRoleSchema);

export default TeamRole;
