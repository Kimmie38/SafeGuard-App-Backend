const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const Report = require('../models/Report');
const User = require('../models/User');
const { nextSequence } = require('../models/Counter');
const { authenticate, requireRole } = require('../middleware/auth');
const { REGIONS } = require('../config/regions');
const { responderCategoryForIncident, notifyUsers } = require('../services/notification.service');

const { CATEGORIES, STATUSES, SEVERITIES, VERIFICATION_STATUSES } = Report;
const SEVERITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const statusBody = body('status').isIn(STATUSES).withMessage(`status must be one of: ${STATUSES.join(', ')}`);
const populateResponder = (query) => query.populate('assignedResponderId', 'name phone agency responderRole incidentTypes serviceArea isAvailable');

const router = express.Router();
router.use(authenticate);

async function generatePublicId() {
  const year = new Date().getFullYear();
  const seq = await nextSequence(`report-${year}`);
  return `ER-${year}-${String(seq).padStart(3, '0')}`;
}

async function notifyAreaAdmins(region, payload) {
  const admins = await User.find({ role: 'admin', estate: region }).select('_id');
  return notifyUsers({ recipientIds: admins.map((admin) => admin._id), region, ...payload });
}

async function routeResponders(category, region) {
  const responderCategory = responderCategoryForIncident(category);
  return User.find({
    role: 'responder',
    isApproved: true,
    isAvailable: true,
    incidentTypes: responderCategory,
    serviceArea: region,
  }).sort({ updatedAt: 1 });
}

router.post(
  '/',
  [
    body('category').isIn(CATEGORIES),
    body('title').trim().notEmpty().isLength({ max: 140 }),
    body('description').trim().notEmpty().isLength({ max: 2000 }),
    body('location').trim().notEmpty(),
    body('region').isIn(REGIONS),
    body('severity').optional().isIn(SEVERITIES),
    body('images').optional().isArray({ max: 5 }),
    body('images.*').optional().isString(),
    body('anonymous').optional().isBoolean(),
    body('coordinates').optional().isArray({ min: 2, max: 2 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const { category, title, description, location, region, severity, images, anonymous, coordinates } = req.body;
      const id = await generatePublicId();
      const responders = await routeResponders(category, region);
      const firstResponder = responders[0] || null;
      const report = await new Report({
        id, category, title, description, location, region,
        severity: severity || 'Medium', images: images || [],
        coordinates: coordinates ? { type: 'Point', coordinates } : undefined,
        status: firstResponder ? 'Assigned' : 'Active',
        verificationStatus: 'Unverified',
        reporter: anonymous ? 'Anonymous' : req.user.name,
        reporterId: req.user.id,
        assignedResponderId: firstResponder?._id || null,
        assignedAgency: firstResponder?.agency || null,
        routedResponderIds: responders.map((responder) => responder._id),
        statusHistory: [{ status: firstResponder ? 'Assigned' : 'Active', changedBy: req.user.id, note: firstResponder ? 'Automatically routed to an authorized responder.' : 'No available responder matched this incident.' }],
      }).save();

      const recipientIds = responders.map((responder) => responder._id.toString());
      if (req.user.id) recipientIds.push(req.user.id);
      await notifyUsers({
        recipientIds,
        type: 'Emergency',
        title: firstResponder ? `New ${category} assigned` : `New ${category} reported`,
        message: firstResponder ? `${id} is assigned to ${firstResponder.agency || firstResponder.name}. Review and acknowledge the incident.` : `${id} needs area review because no authorized responder is currently available.`,
        relatedReportId: id,
        region,
      });
      await notifyAreaAdmins(region, {
        type: 'Update',
        title: firstResponder ? 'Incident routed automatically' : 'Incident needs responder review',
        message: `${id} · ${title}`,
        relatedReportId: id,
      });

      res.status(201).json({ report: await populateResponder(Report.findById(report._id)) });
    } catch (err) { next(err); }
  }
);

router.get('/', [query('category').optional().isIn(CATEGORIES), query('status').optional().isIn(STATUSES), query('region').optional().isIn(REGIONS), query('sort').optional().isIn(['latest', 'severity'])], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.region) filter.region = req.query.region;
    if (req.user.role === 'responder') filter.$or = [{ assignedResponderId: req.user.id }, { routedResponderIds: req.user.id }];
    let reports = await populateResponder(Report.find(filter).sort({ createdAt: -1 }));
    if (req.query.sort === 'severity') reports = reports.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
    res.json({ reports });
  } catch (err) { next(err); }
});

router.get('/mine', async (req, res, next) => {
  try { res.json({ reports: await populateResponder(Report.find({ reporterId: req.user.id }).sort({ createdAt: -1 })) }); } catch (err) { next(err); }
});

router.post('/:id/assign', requireRole('admin'), [param('id').notEmpty(), body('responderId').isMongoId()], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const report = await Report.findOne({ id: req.params.id });
    const admin = await User.findById(req.user.id);
    const responder = await User.findOne({ _id: req.body.responderId, role: 'responder', isApproved: true, isAvailable: true });
    if (!report || !admin) return res.status(404).json({ error: 'Incident not found' });
    if (admin.estate !== report.region) return res.status(403).json({ error: 'You can only manage incidents in your coverage area.' });
    if (!responder || !responder.serviceArea.includes(report.region) || !responder.incidentTypes.includes(responderCategoryForIncident(report.category))) return res.status(400).json({ error: 'Responder is not authorized for this incident and area.' });
    report.assignedResponderId = responder._id;
    report.assignedAgency = responder.agency;
    report.routedResponderIds = [...new Set([...(report.routedResponderIds || []).map(String), responder._id.toString()])];
    report.status = 'Assigned';
    report.statusHistory.push({ status: 'Assigned', changedBy: req.user.id, note: `Assigned to ${responder.name}.` });
    await report.save();
    await notifyUsers({ recipientIds: [responder._id], type: 'Assignment', title: 'Incident assigned to you', message: `${report.id} · ${report.title}. Open the incident to acknowledge it.`, relatedReportId: report.id, region: report.region });
    res.json({ report: await populateResponder(Report.findById(report._id)) });
  } catch (err) { next(err); }
});

router.patch('/:id/acknowledge', requireRole('responder'), [param('id').notEmpty()], async (req, res, next) => {
  try {
    const report = await Report.findOne({ id: req.params.id, assignedResponderId: req.user.id });
    if (!report) return res.status(404).json({ error: 'Assigned incident not found' });
    report.status = 'Acknowledged';
    report.statusHistory.push({ status: 'Acknowledged', changedBy: req.user.id, note: 'Responder acknowledged the assignment.' });
    await report.save();
    await notifyAreaAdmins(report.region, { type: 'Update', title: 'Responder acknowledged incident', message: `${report.id} was acknowledged by ${req.user.name}.`, relatedReportId: report.id });
    if (report.reporterId) await notifyUsers({ recipientIds: [report.reporterId], type: 'Update', title: 'Responder acknowledged your report', message: `${report.id} is now being reviewed by ${report.assignedAgency || 'the assigned response team'}.`, relatedReportId: report.id, region: report.region });
    res.json({ report: await populateResponder(Report.findById(report._id)) });
  } catch (err) { next(err); }
});

router.patch('/:id/status', [param('id').notEmpty(), statusBody, body('note').optional().trim().isLength({ max: 500 })], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const report = await Report.findOne({ id: req.params.id });
    if (!report) return res.status(404).json({ error: 'Incident not found' });
    const isAdmin = req.user.role === 'admin';
    const isAssignedResponder = req.user.role === 'responder' && String(report.assignedResponderId) === req.user.id;
    if (!isAdmin && !isAssignedResponder) return res.status(403).json({ error: 'Only the area chairman or assigned responder can update this incident.' });
    if (isAdmin) {
      const admin = await User.findById(req.user.id);
      if (!admin || admin.estate !== report.region) return res.status(403).json({ error: 'You can only manage incidents in your coverage area.' });
    }
    report.status = req.body.status;
    report.statusHistory.push({ status: req.body.status, changedBy: req.user.id, note: req.body.note || null });
    await report.save();
    const recipients = [];
    if (report.reporterId) recipients.push(report.reporterId);
    if (report.assignedResponderId) recipients.push(report.assignedResponderId);
    await notifyUsers({ recipientIds: recipients, type: 'Update', title: 'Incident status updated', message: `${report.id} is now ${report.status.replace('_', ' ')}.`, relatedReportId: report.id, region: report.region });
    await notifyAreaAdmins(report.region, { type: 'Update', title: 'Incident status changed', message: `${report.id} is now ${report.status.replace('_', ' ')}.`, relatedReportId: report.id });
    res.json({ report: await populateResponder(Report.findById(report._id)) });
  } catch (err) { next(err); }
});

router.patch('/:id/verify', requireRole('admin'), [param('id').notEmpty(), body('verificationStatus').isIn(VERIFICATION_STATUSES)], async (req, res, next) => {
  try {
    const report = await Report.findOne({ id: req.params.id });
    if (!report) return res.status(404).json({ error: 'Incident not found' });
    const admin = await User.findById(req.user.id);
    if (!admin || admin.estate !== report.region) return res.status(403).json({ error: 'You can only verify incidents in your coverage area.' });
    report.verificationStatus = req.body.verificationStatus;
    await report.save();
    if (report.reporterId) await notifyUsers({ recipientIds: [report.reporterId], type: 'Update', title: 'Incident verification updated', message: `${report.id} is now ${report.verificationStatus}.`, relatedReportId: report.id, region: report.region });
    res.json({ report: await populateResponder(Report.findById(report._id)) });
  } catch (err) { next(err); }
});

router.get('/:id', [param('id').notEmpty()], async (req, res, next) => {
  try {
    const report = await populateResponder(Report.findOne({ id: req.params.id }));
    if (!report) return res.status(404).json({ error: 'Incident not found' });
    res.json({ report });
  } catch (err) { next(err); }
});

module.exports = router;
