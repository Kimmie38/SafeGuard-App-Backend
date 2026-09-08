const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 5 }, // 8MB/file, 5 files - matches MAX_IMAGES in report.tsx
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

/**
 * POST /api/uploads/images
 * multipart/form-data, field name "images" (up to 5 files).
 * Returns absolute URLs to hand straight to POST /api/reports's `images` array.
 *
 * NOTE: this stores files on local disk, which is fine for a single-server
 * deployment/demo. For production at scale, swap this for S3/Cloudinary/GCS
 * and return their URLs instead - the response shape (`{ urls: string[] }`)
 * would stay the same either way, so the frontend doesn't need to change.
 */
router.post('/images', (req, res) => {
  upload.array('images', 5)(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No image files were provided' });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const urls = req.files.map((f) => `${baseUrl}/uploads/${f.filename}`);
    res.status(201).json({ urls });
  });
});

module.exports = router;
