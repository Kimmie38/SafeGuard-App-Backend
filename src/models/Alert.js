const mongoose = require('mongoose');

const ALERT_TYPES = ['Emergency', 'Update', 'Announcement'];

const alertSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ALERT_TYPES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    message: { type: String, required: true, trim: true, maxlength: 500 },

    // NOTE: the current frontend prototype has a single global `unread`
    // flag per alert (there's only ever one simulated user per session).
    // For a real multi-resident deployment you'll want per-user read
    // receipts instead (e.g. a separate AlertRead collection keyed by
    // user + alert) - flagging this the same way the frontend's own
    // README flags its other "next steps if you want it real" items.
    unread: { type: Boolean, default: true },

    relatedReportId: { type: String, default: null }, // links to Report.id, e.g. "ER-2024-001"
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

alertSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Alert', alertSchema);
module.exports.ALERT_TYPES = ALERT_TYPES;
