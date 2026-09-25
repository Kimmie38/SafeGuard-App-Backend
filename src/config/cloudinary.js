const { v2: cloudinary } = require('cloudinary');

/**
 * Cloudinary is configured from CLOUDINARY_URL (preferred - set in .env,
 * shape: cloudinary://<api_key>:<api_secret>@<cloud_name>) if present;
 * the SDK picks that up automatically. As a fallback (or if you'd rather
 * set the three pieces separately) CLOUDINARY_CLOUD_NAME / _API_KEY /
 * _API_SECRET are also honored.
 */
if (!process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

module.exports = cloudinary;
