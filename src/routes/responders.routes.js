const express = require('express');
const bcrypt = require('bcryptjs');
const { body, param, query, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticate, requireRole } = require('../middleware/auth');
const { REGIONS } = require('../config/regions');
const { RESPONDER_CATEGORIES } = require('../models/User');
const { notifyUsers } = require('../services/notification.service');

const router = express.Router();
router.use(authenticate);

const responderFields = 'name email phone agency responderRole incidentTypes serviceArea location isAvailable isApproved createdAt updatedAt';

router.get('/', requireRole('admin'), [query('region').optional().isIn(REGIONS)], async (req, res, next) => {
  try {
    const filter = { role: 'responder' };
    if (req.query.region) filter.serviceArea = req.query.region;
    else if (req.user.estate) filter.serviceArea = req.user.estate;
    res.json({ responders: await User.find(filter).select(responderFields).sort({ isAvailable: -1, name: 1 }) });
  } catch (err) { next(err); }
});

router.post('/', requireRole('admin'), [
  body('name').trim().notEmpty(), body('email').trim().isEmail().normalizeEmail(), body('password').isLength({ min: 6 }),
  body('phone').optional().trim(), body('agency').trim().notEmpty(), body('responderRole').trim().notEmpty(),
  body('incidentTypes').isArray({ min: 1 }), body('incidentTypes.*').isIn(RESPONDER_CATEGORIES), body('serviceArea').isArray({ min: 1 }), body('serviceArea.*').isIn(REGIONS),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    if (!req.body.serviceArea.includes(req.user.estate)) return res.status(403).json({ error: 'You can only create responders for your coverage area.' });
    const existing = await User.findOne({ email: req.body.email });
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' });
    const responder = await User.create({
      name: req.body.name, email: req.body.email, phone: req.body.phone || null,
      passwordHash: await bcrypt.hash(req.body.password, 10), role: 'responder',
      agency: req.body.agency, responderRole: req.body.responderRole,
      incidentTypes: req.body.incidentTypes, serviceArea: req.body.serviceArea,
      isAvailable: true, isApproved: true,
    });
    res.status(201).json({ responder: responder.toSafeJSON() });
  } catch (err) { next(err); }
});

router.patch('/:id/approval', requireRole('admin'), [param('id').isMongoId(), body('isApproved').isBoolean()], async (req, res, next) => {
  try {
    const responder = await User.findOneAndUpdate({ _id: req.params.id, role: 'responder', serviceArea: req.user.estate }, { isApproved: req.body.isApproved }, { new: true }).select(responderFields);
    if (!responder) return res.status(404).json({ error: 'Responder not found in your area' });
    await notifyUsers({ recipientIds: [responder._id], type: 'System', title: req.body.isApproved ? 'Responder account approved' : 'Responder account paused', message: req.body.isApproved ? 'You can now receive incident assignments.' : 'Your responder account is temporarily paused.', region: req.user.estate });
    res.json({ responder });
  } catch (err) { next(err); }
});

router.get('/me', requireRole('responder'), async (req, res, next) => {
  try {
    const responder = await User.findById(req.user.id).select(responderFields);
    res.json({ responder });
  } catch (err) { next(err); }
});

router.patch('/me', requireRole('responder'), [body('isAvailable').optional().isBoolean(), body('coordinates').optional().isArray({ min: 2, max: 2 })], async (req, res, next) => {
  try {
    const updates = {};
    if (req.body.isAvailable !== undefined) updates.isAvailable = req.body.isAvailable;
    if (req.body.coordinates) updates.location = { type: 'Point', coordinates: req.body.coordinates };
    const responder = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select(responderFields);
    res.json({ responder });
  } catch (err) { next(err); }
});

module.exports = router;
