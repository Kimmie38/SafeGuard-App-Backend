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

    // Powers alerts.tsx's "my area vs. all of Jos" toggle
    // (`!a.region || a.region === userRegion`). Left as free text rather
    // than the Report/User `REGIONS` enum: the frontend's own seed data
    // uses this for area-ish labels that aren't always one of the 10
    // dropdown regions (e.g. "Naraguta" in data/alerts.json), and a
    // system-wide announcement can also just omit it entirely (null =
    // visible to everyone, matching that same client-side check).
    region: { type: String, trim: true, default: null },
  },
  { timestamps: true }
);

alertSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Alert', alertSchema);
module.exports.ALERT_TYPES = ALERT_TYPES;
