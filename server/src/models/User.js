import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

const { Schema } = mongoose;

export const USER_ROLES = ['editor', 'creator_admin', 'brand_rep'];

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: 'editor',
      required: true
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true
    }
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('passwordHash')) {
    return next();
  }

  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  return next();
});

userSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  }
});

const User = mongoose.model('User', userSchema);

export default User;
