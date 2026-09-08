const express = require('express');
const { body, param, validationResult } = require('express-validator');
const Alert = require('../models/Alert');
const { authenticate, requireRole } = require('../middleware/auth');

const { ALERT_TYPES } = Alert;

const router = express.Router();
router.use(authenticate);

/**
 * GET /api/alerts
 * Flat notification feed, matches alerts.tsx (All / Emergencies /
 * Announcements / Updates tabs are filtered client-side by `type`).
 */
router.get('/', async (req, res, next) => {
  try {
    const alerts = await Alert.find().sort({ createdAt: -1 });
    res.json({ alerts });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/alerts
 * Admin-only. Not yet wired up in the frontend (there's no "create
 * announcement" screen there today), but included so that flow has
 * somewhere to land once it exists - otherwise the alerts feed can only
 * ever grow via seed data.
 */
router.post(
  '/',
  requireRole('admin'),
  [
    body('type').isIn(ALERT_TYPES).withMessage(`type must be one of: ${ALERT_TYPES.join(', ')}`),
    body('title').trim().notEmpty().isLength({ max: 140 }),
    body('message').trim().notEmpty().isLength({ max: 500 }),
    body('relatedReportId').optional().isString(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { type, title, message, relatedReportId } = req.body;
      const alert = new Alert({
        type,
        title,
        message,
        relatedReportId: relatedReportId || null,
        createdBy: req.user.id,
        unread: true,
      });
      await alert.save();
      res.status(201).json({ alert });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/alerts/:id/read
 * Marks an alert as read. See the model's note on this being a global
 * flag for now rather than per-user - fine for a single-tenant prototype,
 * worth revisiting for multi-resident production use.
 */
router.patch('/:id/read', [param('id').isMongoId()], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const alert = await Alert.findByIdAndUpdate(req.params.id, { unread: false }, { new: true });
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json({ alert });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
