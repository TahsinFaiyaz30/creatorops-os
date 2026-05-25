import mongoose from 'mongoose';

const { Schema } = mongoose;

const workspaceSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true }
);

const Workspace = mongoose.model('Workspace', workspaceSchema);

export default Workspace;
