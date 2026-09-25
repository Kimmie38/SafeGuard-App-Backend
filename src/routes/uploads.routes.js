const express = require('express');
const multer = require('multer');
const streamifier = require('streamifier');
const cloudinary = require('../config/cloudinary');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Images are held in memory just long enough to stream to Cloudinary - we
// never write them to local disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 5 }, // 8MB/file, 5 files - matches MAX_IMAGES in report.tsx
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

function uploadBufferToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'safeguard/reports', resource_type: 'image' },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

/**
 * POST /api/uploads/images
 * multipart/form-data, field name "images" (up to 5 files).
 * Uploads each file to Cloudinary and returns the hosted, optimized URLs
 * to hand straight to POST /api/reports's `images` array.
 */
router.post('/images', (req, res) => {
  upload.array('images', 5)(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No image files were provided' });
    }

    try {
      const results = await Promise.all(req.files.map((f) => uploadBufferToCloudinary(f.buffer)));
      const urls = results.map((r) =>
        cloudinary.url(r.public_id, { resource_type: 'image', format: r.format, fetch_format: 'auto', quality: 'auto', secure: true })
      );
      res.status(201).json({ urls });
    } catch (uploadErr) {
      console.error('Cloudinary upload failed:', uploadErr.message);
      res.status(502).json({ error: 'Image upload to Cloudinary failed. Please try again.' });
    }
  });
});

module.exports = router;
