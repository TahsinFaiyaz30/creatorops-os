import mongoose from 'mongoose';

import { SUPPORTED_PLATFORMS } from '../constants/platforms.js';

const { Schema } = mongoose;

const platformFormatRuleSchema = new Schema(
  {
    platform: {
      type: String,
      enum: SUPPORTED_PLATFORMS,
      required: true,
      unique: true
    },
    displayName: {
      type: String,
      required: true
    },
    maxCaptionLength: {
      type: Number,
      required: true
    },
    maxHashtags: {
      type: Number,
      required: true
    },
    recommendedHashtags: {
      type: [String],
      default: []
    },
    supportsLongText: {
      type: Boolean,
      default: false
    },
    supportsShortVideo: {
      type: Boolean,
      default: false
    },
    supportsImage: {
      type: Boolean,
      default: false
    },
    supportsLinks: {
      type: Boolean,
      default: false
    },
    contentStyle: {
      type: String,
      default: ''
    },
    ctaStyle: {
      type: String,
      default: ''
    },
    requirements: {
      type: [String],
      default: []
    }
  },
  { timestamps: true }
);

const PlatformFormatRule = mongoose.model('PlatformFormatRule', platformFormatRuleSchema);

export default PlatformFormatRule;
