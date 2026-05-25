import mongoose from 'mongoose';

const { Schema } = mongoose;

const contentVersionSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true
    },
    contentItemId: {
      type: Schema.Types.ObjectId,
      ref: 'ContentItem',
      required: true
    },
    variantId: {
      type: Schema.Types.ObjectId,
      ref: 'PlatformVariant',
      default: null
    },
    versionNumber: {
      type: Number,
      required: true,
      min: 1
    },
    snapshot: {
      type: Schema.Types.Mixed,
      required: true
    },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    changeNote: {
      type: String,
      default: ''
    }
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

contentVersionSchema.index({ workspaceId: 1 });
contentVersionSchema.index({ contentItemId: 1 });
contentVersionSchema.index({ variantId: 1 });

const ContentVersion = mongoose.model('ContentVersion', contentVersionSchema);

export default ContentVersion;
