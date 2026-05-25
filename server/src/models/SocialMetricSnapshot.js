import mongoose from 'mongoose';

import { SUPPORTED_PLATFORMS } from '../constants/platforms.js';

const { Schema } = mongoose;

const socialMetricSnapshotSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    publishedPostId: { type: Schema.Types.ObjectId, ref: 'PublishedPost', required: true, index: true },
    platformConnectionId: { type: Schema.Types.ObjectId, ref: 'PlatformConnection', required: true },
    platform: { type: String, enum: SUPPORTED_PLATFORMS, required: true },
    providerPostId: { type: String, required: true },
    likes: { type: Number, default: 0 },
    reactions: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    saves: { type: Number, default: 0 },
    source: { type: String, enum: ['real'], default: 'real' },
    collectedAt: { type: Date, default: () => new Date(), index: true }
  },
  { timestamps: true }
);

const SocialMetricSnapshot = mongoose.model('SocialMetricSnapshot', socialMetricSnapshotSchema);

export default SocialMetricSnapshot;
