const mongoose = require('mongoose');

const USER_ROLES = ['resident', 'admin', 'responder'];
const RESPONDER_CATEGORIES = [
  'Security / Police',
  'Fire Service',
  'Emergency / Medical',
  'Medical / Emergency',
  'Admin / Relevant authority',
];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    phone: { type: String, trim: true, default: null },
    estate: { type: String, trim: true, default: null },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, default: 'resident' },

    // Responder-only authorization and routing fields.
    agency: { type: String, trim: true, default: null },
    responderRole: { type: String, trim: true, default: null },
    incidentTypes: { type: [String], enum: RESPONDER_CATEGORIES, default: [] },
    serviceArea: { type: [String], default: [] },
    location: {
      type: { type: String, enum: ['Point'], default: undefined },
      coordinates: { type: [Number], default: undefined },
    },
    isAvailable: { type: Boolean, default: true },
    isApproved: { type: Boolean, default: false },
    expoPushTokens: { type: [String], default: [] },
  },
  { timestamps: true }
);

userSchema.index({ location: '2dsphere' });
userSchema.index({ role: 1, isAvailable: 1, isApproved: 1 });

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  delete obj._id;
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
module.exports.USER_ROLES = USER_ROLES;
module.exports.RESPONDER_CATEGORIES = RESPONDER_CATEGORIES;
