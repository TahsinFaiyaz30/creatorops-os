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
import { requireTeamPermission } from '../middleware/role.middleware.js';
import { TEAM_PERMISSIONS } from '../constants/teamPermissions.js';

const router = express.Router();

const minMultipartPartBytes = 5 * 1024 * 1024;
const resumableChunkLimitBytes = Number.isFinite(env.mediaUploadLimitBytes)
  ? Math.max(minMultipartPartBytes, Math.min(env.mediaUploadLimitBytes, 64 * 1024 * 1024))
  : 16 * 1024 * 1024;

router.use(authenticate);

/*
 * Only the start of an upload is gated. The chunk/pause/resume/cancel steps act
 * on a session the caller already owns, so re-checking the permission mid-upload
 * would only be able to strand a transfer that was legitimate when it began.
 * Reads are scoped inside the service by project membership rather than gated
 * here, so a member always sees the library slice that belongs to them.
 */
router.post('/resumable/start', requireTeamPermission(TEAM_PERMISSIONS.MEDIA_UPLOAD), startResumableUpload);
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
router.delete('/:id', requireTeamPermission(TEAM_PERMISSIONS.MEDIA_DELETE), removeMedia);

export default router;
