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

// ── POST /upload — upload image base64 or file data ──
router.post('/', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const { image, filename } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    // Match base64 header
    const matches = image.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: 'Invalid image data format' });
    }

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

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
