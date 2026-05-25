import mongoose from 'mongoose';

import { SUPPORTED_PLATFORMS } from '../constants/platforms.js';

const { Schema } = mongoose;

const oauthStateSchema = new Schema(
  {
    state: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    platform: {
      type: String,
      enum: SUPPORTED_PLATFORMS,
      required: true
    },
    redirectUri: {
      type: String,
      default: ''
    },
    returnUrl: {
      type: String,
      default: ''
    },
    codeVerifier: {
      type: String,
      default: ''
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }
    },
    consumedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

const OAuthState = mongoose.model('OAuthState', oauthStateSchema);

export default OAuthState;
