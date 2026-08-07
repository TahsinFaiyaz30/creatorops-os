import crypto from 'node:crypto';
import mongoose from 'mongoose';

const { Schema } = mongoose;

export const TEAM_INVITATION_STATUSES = ['pending', 'accepted', 'declined', 'revoked', 'expired'];

const teamInvitationSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    /* Filled in once an account with this email exists, so the invite survives
       a creator signing up after being invited. */
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    teamRoleId: { type: Schema.Types.ObjectId, ref: 'TeamRole', required: true },
    title: { type: String, default: '' },
    message: { type: String, default: '' },
    token: { type: String, required: true, unique: true },
    status: { type: String, enum: TEAM_INVITATION_STATUSES, default: 'pending', index: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    respondedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

teamInvitationSchema.index({ workspaceId: 1, email: 1, status: 1 });

export const createInvitationToken = () => crypto.randomBytes(24).toString('hex');

const TeamInvitation = mongoose.model('TeamInvitation', teamInvitationSchema);

export default TeamInvitation;
