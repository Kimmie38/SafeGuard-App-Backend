const mongoose = require('mongoose');
const { REGIONS } = require('../config/regions');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    phone: { type: String, trim: true, default: null },

    // Replaces the old free-text `estate` field - the frontend's
    // register.tsx and login.tsx both use a dropdown scoped to the 10
    // Jos, Plateau State regions in constants/theme.ts, not free text.
    // For a resident this is "my area"; for an admin it's their coverage
    // area. Required so every account can always be region-scoped.
    region: { type: String, enum: REGIONS, required: true, index: true },

    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['resident', 'admin'], default: 'resident' },
  },
  { timestamps: true }
);

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
