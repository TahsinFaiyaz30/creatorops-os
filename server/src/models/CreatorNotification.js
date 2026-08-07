import mongoose from 'mongoose';

const { Schema } = mongoose;

export const CREATOR_NOTIFICATION_TYPES = [
  'application_viewed',
  'creator_shortlisted',
  'application_rejected',
  'application_accepted',
  'calendar_reminder',
  /* Team events */
  'team_invited',
  'team_joined',
  'task_assigned',
  'handoff_received',
  'approval_requested',
  'approval_decided',
  'publish_released',
  'project_message'
];

const creatorNotificationSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: CREATOR_NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    entityType: { type: String, default: '' },
    entityId: { type: Schema.Types.ObjectId, default: null },
    readAt: { type: Date, default: null, index: true }
  },
  { timestamps: true }
);

creatorNotificationSchema.index({ workspaceId: 1, userId: 1, readAt: 1, createdAt: -1 });

const CreatorNotification = mongoose.model('CreatorNotification', creatorNotificationSchema);

export default CreatorNotification;
