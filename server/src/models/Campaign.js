import mongoose from 'mongoose';

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
    }
  },
  { timestamps: true }
);

campaignSchema.index({ workspaceId: 1 });
campaignSchema.index({ status: 1 });
campaignSchema.index({ createdBy: 1 });

const Campaign = mongoose.model('Campaign', campaignSchema);

export default Campaign;
