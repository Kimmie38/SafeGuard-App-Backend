const express = require('express');
const { body, param, validationResult } = require('express-validator');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const notifications = await Notification.find({
      $or: [{ recipientId: req.user.id }, { recipientId: null, region: null }, { recipientId: null, region: req.user.estate }],
    }).sort({ createdAt: -1 }).limit(100);
    res.json({ notifications });
  } catch (err) { next(err); }
});

router.patch('/:id/read', [param('id').isMongoId()], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.user.id },
      { unread: false },
      { new: true }
    );
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json({ notification });
  } catch (err) { next(err); }
});

router.post('/push-token', [body('token').isString().notEmpty()], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    await User.findByIdAndUpdate(req.user.id, { $addToSet: { expoPushTokens: req.body.token } });
    res.status(201).json({ registered: true });
  } catch (err) { next(err); }
});

router.delete('/push-token', [body('token').isString().notEmpty()], async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { $pull: { expoPushTokens: req.body.token } });
    res.json({ registered: false });
  } catch (err) { next(err); }
});

module.exports = router;
