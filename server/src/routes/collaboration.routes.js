import { Router } from 'express';

import {
  getDeliverables,
  getHandoffs,
  getProjectMessages,
  getReviewNotes,
  patchDeliverable,
  postApproveDeliverable,
  postDeliverable,
  postHandoff,
  postHandoffResponse,
  postProjectMessageHandler,
  postRejectDeliverable,
  postRequestChangesDeliverable,
  postResolveReviewNote,
  postReviewNote,
  postSubmitDeliverable
} from '../controllers/collaboration.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireTeamPermission } from '../middleware/role.middleware.js';
import { TEAM_PERMISSIONS } from '../constants/teamPermissions.js';

const router = Router();

router.use(authenticate);

/*
 * Reads are gated by project membership inside the services rather than by a
 * permission here, so a member sees their own projects and nothing else without
 * needing a permission to see anything at all. Writes carry the permission the
 * action actually corresponds to.
 */

/*
 * Deliverables.
 *
 * Creating one is gated on approval.request, not content.create: a Designer
 * produces media and hands it in without ever authoring a task, and content.create
 * would have locked exactly the people the feature exists for out of it. Every
 * position meant to submit work carries approval.request; Viewer and Analyst do not.
 */
router.get('/deliverables', getDeliverables);
router.post('/deliverables', requireTeamPermission(TEAM_PERMISSIONS.APPROVAL_REQUEST), postDeliverable);
router.patch('/deliverables/:id', patchDeliverable);
router.post('/deliverables/:id/submit', requireTeamPermission(TEAM_PERMISSIONS.APPROVAL_REQUEST), postSubmitDeliverable);
router.post('/deliverables/:id/approve', requireTeamPermission(TEAM_PERMISSIONS.APPROVAL_DECIDE), postApproveDeliverable);
router.post(
  '/deliverables/:id/request-changes',
  requireTeamPermission(TEAM_PERMISSIONS.APPROVAL_DECIDE),
  postRequestChangesDeliverable
);
router.post('/deliverables/:id/reject', requireTeamPermission(TEAM_PERMISSIONS.APPROVAL_DECIDE), postRejectDeliverable);

/* Review notes — "change this caption", "swap this image" */
router.get('/deliverables/:id/notes', getReviewNotes);
router.post('/deliverables/:id/notes', postReviewNote);
router.post('/deliverables/:id/notes/:noteId/resolve', postResolveReviewNote);

/* Handoffs */
router.get('/handoffs', getHandoffs);
router.post('/handoffs', postHandoff);
router.post('/handoffs/:id/respond', postHandoffResponse);

/* Project chat */
router.get('/projects/:projectId/messages', getProjectMessages);
router.post('/projects/:projectId/messages', postProjectMessageHandler);

export default router;
