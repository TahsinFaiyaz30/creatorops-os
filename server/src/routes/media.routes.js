import express from 'express';

import env from '../config/env.js';
import {
  cancelResumableUpload,
  getMedia,
  getResumableUpload,
  listMedia,
  pauseResumableUpload,
  removeMedia,
  resumeResumableUpload,
  startResumableUpload,
  updateMedia,
  uploadResumableChunk
} from '../controllers/media.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

const minMultipartPartBytes = 5 * 1024 * 1024;
const resumableChunkLimitBytes = Number.isFinite(env.mediaUploadLimitBytes)
  ? Math.max(minMultipartPartBytes, Math.min(env.mediaUploadLimitBytes, 64 * 1024 * 1024))
  : 16 * 1024 * 1024;

router.use(authenticate);

router.post('/resumable/start', startResumableUpload);
router.get('/resumable/:sessionId', getResumableUpload);
router.post(
  '/resumable/:sessionId/chunk',
  express.raw({ type: 'application/octet-stream', limit: resumableChunkLimitBytes }),
  uploadResumableChunk
);
router.post('/resumable/:sessionId/pause', pauseResumableUpload);
router.post('/resumable/:sessionId/resume', resumeResumableUpload);
router.delete('/resumable/:sessionId', cancelResumableUpload);
router.get('/', listMedia);
router.get('/:id', getMedia);
router.patch('/:id', updateMedia);
router.delete('/:id', removeMedia);

export default router;
