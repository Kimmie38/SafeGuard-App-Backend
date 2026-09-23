const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { REGIONS } = require('../config/regions');

const router = express.Router();
router.use(authenticate);

/**
 * GET /api/users/me
 */
router.get('/me', async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/users/me
 */
router.patch(
  '/me',
  [
    body('name').optional().trim().notEmpty(),
    body('phone').optional().trim().matches(/^\+234\d{10}$/).withMessage('phone must use +234 followed by 10 digits'),
    body('estate').optional().trim(),
    body('region').optional().isIn(REGIONS).withMessage(`region must be one of: ${REGIONS.join(', ')}`),
    body('notificationPreferences').optional().isObject(),
    body('privacySettings').optional().isObject(),
    body('isAvailable').optional().isBoolean(),
    body('location').optional().isObject(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      const { name, phone, estate, region, notificationPreferences, privacySettings, isAvailable, location } = req.body;
      if (name !== undefined) user.name = name;
      if (phone !== undefined) user.phone = phone;
      if (region !== undefined) user.estate = region;
      else if (estate !== undefined) user.estate = estate;
      if (notificationPreferences) user.notificationPreferences = { ...user.notificationPreferences.toObject(), ...notificationPreferences };
      if (privacySettings) user.privacySettings = { ...user.privacySettings.toObject(), ...privacySettings };
      if (isAvailable !== undefined && user.role === 'responder') user.isAvailable = isAvailable;
      if (location && user.role === 'responder') user.location = location;

      await user.save();
      res.json({ user: user.toSafeJSON() });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
