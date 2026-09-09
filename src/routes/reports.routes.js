const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const Report = require('../models/Report');
const { nextSequence } = require('../models/Counter');
const { authenticate, requireRole } = require('../middleware/auth');
const { REGIONS } = require('../config/regions');

const { CATEGORIES, STATUSES, SEVERITIES } = Report;
const SEVERITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };

const router = express.Router();
router.use(authenticate);

async function generatePublicId() {
  const year = new Date().getFullYear();
  const seq = await nextSequence(`report-${year}`);
  return `ER-${year}-${String(seq).padStart(3, '0')}`;
}

/**
 * POST /api/reports
 * Matches the frontend's report.tsx submission: category, title,
 * description, location (free text), severity, images (array of already-
 * uploaded URLs - see POST /api/uploads/images), plus `region` (the
 * reporter's own area, e.g. "Terminus" - the report form doesn't ask for
 * this directly, so the frontend should send the logged-in user's
 * `userRegion` automatically). Always created as 'Active', reporter name
 * snapshotted from the logged-in user.
 */
router.post(
  '/',
  [
    body('category').isIn(CATEGORIES).withMessage(`category must be one of: ${CATEGORIES.join(', ')}`),
    body('title').trim().notEmpty().isLength({ max: 140 }),
    body('description').trim().notEmpty().isLength({ max: 2000 }),
    body('location').trim().notEmpty(),
    body('region').isIn(REGIONS).withMessage(`region must be one of: ${REGIONS.join(', ')}`),
    body('severity').optional().isIn(SEVERITIES),
    body('images').optional().isArray({ max: 5 }),
    body('images.*').optional().isString(),
    body('anonymous').optional().isBoolean(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { category, title, description, location, region, severity, images, anonymous } = req.body;
      const id = await generatePublicId();

      const report = new Report({
        id,
        category,
        title,
        description,
        location,
        region,
        severity: severity || 'Medium',
        images: images || [],
        status: 'Active',
        reporter: anonymous ? 'Anonymous' : req.user.name,
        reporterId: req.user.id,
        statusHistory: [{ status: 'Active', changedBy: req.user.id }],
      });

      await report.save();
      res.status(201).json({ report });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/reports
 * Community-wide feed (matches feed.tsx / home screens - full detail is
 * visible to every resident, no anonymization in this design).
 * Query params: category, status, region, sort ("latest" default | "severity")
 * `region` is optional - the frontend currently fetches everything and
 * filters "mine" vs "all of Jos" client-side, but it's exposed here too
 * for a lighter-weight server-side filter if that ever changes.
 */
router.get(
  '/',
  [
    query('category').optional().isIn(CATEGORIES),
    query('status').optional().isIn(STATUSES),
    query('region').optional().isIn(REGIONS),
    query('sort').optional().isIn(['latest', 'severity']),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { category, status, region, sort } = req.query;
      const filter = {};
      if (category) filter.category = category;
      if (status) filter.status = status;
      if (region) filter.region = region;

      let reports = await Report.find(filter).sort({ createdAt: -1 });

      if (sort === 'severity') {
        reports = [...reports].sort(
          (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
        );
      }

      res.json({ reports });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/reports/mine
 * A resident's own submitted reports (not currently used by the frontend's
 * UI, but useful once a "my reports" view exists).
 */
router.get('/mine', async (req, res, next) => {
  try {
    const reports = await Report.find({ reporterId: req.user.id }).sort({ createdAt: -1 });
    res.json({ reports });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/reports/:id
 * :id is the human-readable public code (e.g. "ER-2024-001"), matching how
 * the frontend already references reports.
 */
router.get('/:id', [param('id').notEmpty()], async (req, res, next) => {
  try {
    const report = await Report.findOne({ id: req.params.id });
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json({ report });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/reports/:id/status
 * Admin-only, matches manage.tsx's "Mark as ..." action.
 */
router.patch(
  '/:id/status',
  requireRole('admin'),
  [
    param('id').notEmpty(),
    body('status').isIn(STATUSES).withMessage(`status must be one of: ${STATUSES.join(', ')}`),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const report = await Report.findOne({ id: req.params.id });
      if (!report) return res.status(404).json({ error: 'Report not found' });

      report.status = req.body.status;
      report.statusHistory.push({ status: req.body.status, changedBy: req.user.id });

      await report.save();
      res.json({ report });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
