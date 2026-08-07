import mongoose from 'mongoose';

const { Schema } = mongoose;

export const TEAM_MEMBERSHIP_STATUSES = ['active', 'suspended', 'left', 'removed'];

/*
 * The row that makes a workspace a team. Before this existed a user belonged to
 * exactly one workspace — their own — which is why every multi-person feature in
 * the app looked useless. One membership per (workspace, user); a creator holds
 * several, one per team they work for, plus one for their personal workspace.
 */
const teamMembershipSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    teamRoleId: { type: Schema.Types.ObjectId, ref: 'TeamRole', required: true },
    /* Free text shown next to the name; the position governs permissions. */
    title: { type: String, default: '' },
    status: { type: String, enum: TEAM_MEMBERSHIP_STATUSES, default: 'active', index: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    hiredAt: { type: Date, default: () => new Date() },
    leftAt: { type: Date, default: null }
  },
  { timestamps: true }
);

teamMembershipSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
/* "which teams am I in" — the switcher's only query. */
teamMembershipSchema.index({ userId: 1, status: 1 });

const TeamMembership = mongoose.model('TeamMembership', teamMembershipSchema);

export default TeamMembership;
