// ── Image Upload Route ──
// Saves uploaded image files to local storage (/public/uploads) and returns a public URL.
// Keeps MongoDB 100% lightweight by storing only text URLs.

import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Allowed raster image extensions
const ALLOWED_MIME_MAP = {
  jpeg: 'jpg',
  jpg: 'jpg',
  png: 'png',
  webp: 'webp',
};

function isValidImageBuffer(buffer, ext) {
  if (!buffer || buffer.length < 8) return false;
  // JPEG: FF D8 FF
  if (ext === 'jpg' && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true;
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (ext === 'png' && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return true;
  }
  // WebP: RIFF ... WEBP
  if (
    ext === 'webp' &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return true;
  }
  return false;
}

// ── POST /upload — upload image base64 or file data ──
router.post('/', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const { image, filename } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    // Match base64 header
    const matches = image.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: 'Invalid image data format' });
    }

    const rawSubtype = matches[1].toLowerCase();
    const ext = ALLOWED_MIME_MAP[rawSubtype];
    if (!ext) {
      return res.status(400).json({
        error: 'Invalid file format. Only JPEG, PNG, and WebP raster images are allowed.',
      });
    }

    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // 5MB max upload limit
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image exceeds maximum 5MB size limit' });
    }

    // Verify magic bytes
    if (!isValidImageBuffer(buffer, ext)) {
      return res.status(400).json({
        error: 'Invalid file content: binary signature does not match image format',
      });
    }

    // Generate unique filename
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const safeName = (filename || 'food')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-');
    const finalFilename = `${Date.now()}-${uniqueId}-${safeName}.${ext}`;
    const filePath = path.join(UPLOAD_DIR, finalFilename);

    // Save to disk
    fs.writeFileSync(filePath, buffer);

    // Build public URL
    const host = req.get('host');
    const protocol = req.protocol;
    const publicUrl = `${protocol}://${host}/uploads/${finalFilename}`;

    console.log(`📸 Image saved: ${finalFilename}`);
    res.json({ url: publicUrl, filename: finalFilename });
  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

export default router;
