import express from 'express';

import {
  analyticsSummary,
  getComments,
  getMetrics,
  getPostGroup,
  getPostGroups,
  getPost,
  getPosts,
  replyToComment,
  syncPostGroup,
  syncPost
} from '../controllers/social.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = express.Router();

router.use(authenticate);

router.get('/post-groups', getPostGroups);
router.get('/post-groups/:id', getPostGroup);
router.post('/post-groups/:id/sync', syncPostGroup);
router.get('/posts', getPosts);
router.get('/posts/:id', getPost);
router.post('/posts/:id/sync', syncPost);
router.get('/posts/:id/metrics', getMetrics);
router.get('/posts/:id/comments', getComments);
router.post('/comments/:id/reply', requireRole(['creator_admin']), replyToComment);
router.get('/analytics/summary', analyticsSummary);

export default router;
