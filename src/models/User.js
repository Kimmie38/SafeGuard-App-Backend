const mongoose = require('mongoose');

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
    // Free text, but in practice this is the resident/admin's region
    // (e.g. "Terminus") - the frontend's login/register "area" picker
    // writes here, and every "mine" vs "all of Jos" scope in the UI reads
    // this back as `userRegion`. Left as free text rather than an enum so
    // an out-of-list estate name doesn't hard-fail registration.
    estate: { type: String, trim: true, default: null },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['resident', 'admin'], default: 'resident' },
  },
  { timestamps: true }
);

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  delete obj._id;
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
