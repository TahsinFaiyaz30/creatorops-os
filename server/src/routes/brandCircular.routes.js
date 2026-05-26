import express from 'express';

import {
  accept,
  applyCircular,
  archiveCircular,
  closeCircular,
  createCircular,
  getCircular,
  getCircularApplications,
  getCirculars,
  getMyApplications,
  patchCircular,
  publishCircular,
  reject,
  shortlist,
  viewProfile
} from '../controllers/brandCircular.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = express.Router();

router.use('/brand-circulars', authenticate);
router.use('/applications', authenticate);

router.post('/brand-circulars', requireRole(['brand_rep']), createCircular);
router.get('/brand-circulars', getCirculars);
router.get('/brand-circulars/:id', getCircular);
router.patch('/brand-circulars/:id', requireRole(['brand_rep']), patchCircular);
router.post('/brand-circulars/:id/publish', requireRole(['brand_rep']), publishCircular);
router.post('/brand-circulars/:id/close', requireRole(['brand_rep']), closeCircular);
router.post('/brand-circulars/:id/archive', requireRole(['brand_rep']), archiveCircular);
router.post('/brand-circulars/:id/apply', applyCircular);
router.get('/brand-circulars/:id/applications', requireRole(['brand_rep']), getCircularApplications);
router.get('/applications', getMyApplications);
router.post('/applications/:id/view-profile', requireRole(['brand_rep']), viewProfile);
router.post('/applications/:id/shortlist', requireRole(['brand_rep']), shortlist);
router.post('/applications/:id/reject', requireRole(['brand_rep']), reject);
router.post('/applications/:id/accept', requireRole(['brand_rep']), accept);

export default router;
