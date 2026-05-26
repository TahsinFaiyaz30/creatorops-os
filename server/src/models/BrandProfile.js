import mongoose from 'mongoose';

const { Schema } = mongoose;

const brandProfileSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true
    },
    brandName: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ''
    },
    industry: {
      type: String,
      default: ''
    },
    website: {
      type: String,
      default: ''
    },
    logoUrl: {
      type: String,
      default: ''
    },
    tone: {
      type: String,
      default: ''
    },
    targetAudience: {
      type: String,
      default: ''
    },
    bannedWords: {
      type: [String],
      default: []
    },
    ctaStyle: {
      type: String,
      default: ''
    },
    preferredPlatforms: {
      type: [String],
      default: []
    }
  },
  { timestamps: true }
);

const BrandProfile = mongoose.model('BrandProfile', brandProfileSchema);

export default BrandProfile;
