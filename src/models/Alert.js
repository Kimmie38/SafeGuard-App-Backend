const mongoose = require('mongoose');
const { REGIONS } = require('../config/regions');

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

    // Matches alerts.tsx's scoping: an alert with no region is shown to
    // everyone ("All of Jos"); one with a region is only shown when it
    // matches the viewer's own region ("mine").
    region: { type: String, enum: REGIONS, default: null },

    relatedReportId: { type: String, default: null }, // links to Report.id, e.g. "ER-2024-001"
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        // The frontend's AlertItem type expects a plain string `id`
        // (it never deals with Mongo's `_id`/`__v`).
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

alertSchema.index({ createdAt: -1 });
alertSchema.index({ region: 1 });

module.exports = mongoose.model('Alert', alertSchema);
module.exports.ALERT_TYPES = ALERT_TYPES;
