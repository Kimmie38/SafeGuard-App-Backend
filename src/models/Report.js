const mongoose = require('mongoose');
const { REGIONS } = require('../config/regions');

const CATEGORIES = ['Robbery', 'Fire Outbreak', 'Medical Emergency', 'Accident', 'Suspicious Activity', 'Domestic Threat'];
const STATUSES = ['Active', 'Pending', 'Assigned', 'Acknowledged', 'Ongoing', 'Responding', 'On Scene', 'Completed', 'Resolved', 'Rejected'];
const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'];
const VERIFICATION_STATUSES = ['Unverified', 'Pending review', 'Verified', 'Rejected'];

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: STATUSES, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    changedAt: { type: Date, default: Date.now },
    note: { type: String, trim: true, maxlength: 500, default: null },
  },
  { _id: false }
);

const reportSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    category: { type: String, enum: CATEGORIES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    status: { type: String, enum: STATUSES, default: 'Active' },
    verificationStatus: { type: String, enum: VERIFICATION_STATUSES, default: 'Unverified' },
    severity: { type: String, enum: SEVERITIES, default: 'Medium' },
    location: { type: String, required: true, trim: true },
    coordinates: {
      type: { type: String, enum: ['Point'], default: undefined },
      coordinates: { type: [Number], default: undefined },
    },
    region: { type: String, enum: REGIONS, required: true },
    reporter: { type: String, required: true, trim: true, default: 'Anonymous' },
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    images: { type: [String], default: [] },
    assignedResponderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedAgency: { type: String, trim: true, default: null },
    routedResponderIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    statusHistory: { type: [statusHistorySchema], default: [] },
  },
  { timestamps: true }
);

reportSchema.index({ category: 1 });
reportSchema.index({ status: 1 });
reportSchema.index({ region: 1 });
reportSchema.index({ createdAt: -1 });
reportSchema.index({ coordinates: '2dsphere' });

module.exports = mongoose.model('Report', reportSchema);
module.exports.CATEGORIES = CATEGORIES;
module.exports.STATUSES = STATUSES;
module.exports.SEVERITIES = SEVERITIES;
module.exports.VERIFICATION_STATUSES = VERIFICATION_STATUSES;
module.exports.REGIONS = REGIONS;
