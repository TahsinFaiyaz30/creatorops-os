import mongoose from 'mongoose';

const { Schema } = mongoose;

const workflowEventSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    eventType: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true
    },
    entityType: {
      type: String,
      default: ''
    },
    entityId: {
      type: Schema.Types.ObjectId,
      default: null
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

workflowEventSchema.index({ workspaceId: 1 });
workflowEventSchema.index({ createdAt: 1 });
workflowEventSchema.index({ eventType: 1 });

const WorkflowEvent = mongoose.model('WorkflowEvent', workflowEventSchema);

export default WorkflowEvent;
