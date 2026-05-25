import fs from 'fs';
import path from 'path';

import express from 'express';
import multer from 'multer';

import { getMedia, listMedia, removeMedia, updateMedia, uploadMedia } from '../controllers/media.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { UPLOAD_ROOT, detectMediaType } from '../services/media.service.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, _file, callback) => {
    const destination = path.join(UPLOAD_ROOT, String(req.user.workspaceId));
    fs.mkdirSync(destination, { recursive: true });
    callback(null, destination);
  },
  filename: (_req, file, callback) => {
    const ext = path.extname(file.originalname || '');
    const safeBase = path
      .basename(file.originalname || 'upload', ext)
      .replace(/[^a-z0-9_-]/gi, '-')
      .slice(0, 50);
    callback(null, `${Date.now()}-${safeBase}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 250 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!detectMediaType(file.mimetype)) {
      callback(new Error('Only image and video uploads are supported.'));
      return;
    }
    callback(null, true);
  }
});

router.use(authenticate);

router.post('/upload', upload.single('media'), uploadMedia);
router.get('/', listMedia);
router.get('/:id', getMedia);
router.patch('/:id', updateMedia);
router.delete('/:id', removeMedia);

export default router;
