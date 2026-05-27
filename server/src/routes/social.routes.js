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
  replyToReply,
  syncPostGroup,
  syncPost
} from '../controllers/social.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { BRAND_REP_ROLE, CONTENT_CREATOR_ROLE } from '../constants/roles.js';

const router = express.Router();
const socialReplyRoles = [CONTENT_CREATOR_ROLE, BRAND_REP_ROLE];

router.use(authenticate);

router.get('/post-groups', getPostGroups);
router.get('/post-groups/:id', getPostGroup);
router.post('/post-groups/:id/sync', syncPostGroup);
router.get('/posts', getPosts);
router.get('/posts/:id', getPost);
router.post('/posts/:id/sync', syncPost);
router.get('/posts/:id/metrics', getMetrics);
router.get('/posts/:id/comments', getComments);
router.post('/comments/:id/reply', requireRole(socialReplyRoles), replyToComment);
router.post('/replies/:id/reply', requireRole(socialReplyRoles), replyToReply);
router.get('/analytics/summary', analyticsSummary);

export default router;
