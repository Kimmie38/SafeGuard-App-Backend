const mongoose = require('mongoose');
const { REGIONS } = require('../config/regions');

const CATEGORIES = [
  'Robbery',
  'Fire Outbreak',
  'Medical Emergency',
  'Accident',
  'Suspicious Activity',
  'Domestic Threat',
];

const STATUSES = ['Active', 'Responding', 'Resolved'];

const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'];

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: STATUSES, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const reportSchema = new mongoose.Schema(
  {
    // Human-readable public ID (e.g. "ER-2024-001") - this is what the
    // frontend treats as `report.id` and uses in all its routes/lookups.
    id: { type: String, required: true, unique: true, index: true },

    category: { type: String, enum: CATEGORIES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    status: { type: String, enum: STATUSES, default: 'Active' },
    severity: { type: String, enum: SEVERITIES, default: 'Medium' },

    // Free-text location, matching the frontend's plain text field
    // (e.g. "near Terminus Market") rather than coordinates.
    location: { type: String, required: true, trim: true },

    // The broader area this report belongs to (e.g. "Terminus"). This is
    // what every "mine" vs "all of Jos" toggle across the frontend (home,
    // feed, alerts, manage, admin dashboard, incident detail) filters and
    // displays on - it is NOT the same as `location`, which is the
    // free-text detail the reporter typed. Defaults to the submitting
    // user's own region since the report form itself doesn't ask for it.
    region: { type: String, enum: REGIONS, required: true },

    // Snapshot of the reporter's display name at submission time, so the
    // feed still reads correctly even if the account is later renamed/
    // deleted. reporterId keeps the real link for backend accountability.
    reporter: { type: String, required: true, trim: true, default: 'Anonymous' },
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    images: { type: [String], default: [] },

    // Kept as an additive audit trail even though the current frontend
    // doesn't render it yet - handy once a report detail screen exists.
    statusHistory: { type: [statusHistorySchema], default: [] },
  },
  { timestamps: true }
);

reportSchema.index({ category: 1 });
reportSchema.index({ status: 1 });
reportSchema.index({ region: 1 });
reportSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Report', reportSchema);
module.exports.CATEGORIES = CATEGORIES;
module.exports.STATUSES = STATUSES;
module.exports.SEVERITIES = SEVERITIES;
module.exports.REGIONS = REGIONS;
