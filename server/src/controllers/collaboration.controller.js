import {
  createHandoff,
  listHandoffs,
  listProjectMessages,
  postProjectMessage,
  respondToHandoff
} from '../services/collaboration.service.js';
import {
  addReviewNote,
  createDeliverable,
  decideDeliverable,
  listDeliverables,
  listReviewNotes,
  resolveReviewNote,
  submitDeliverable,
  updateDeliverable
} from '../services/deliverable.service.js';

/* ── Deliverables ─────────────────────────────────────────────────────────── */

export const getDeliverables = async (req, res, next) => {
  try {
    const deliverables = await listDeliverables({ user: req.user, team: req.team, query: req.query });
    res.json({ data: { deliverables } });
  } catch (error) {
    next(error);
  }
};

export const postDeliverable = async (req, res, next) => {
  try {
    const deliverable = await createDeliverable({ user: req.user, team: req.team, input: req.body });
    res.status(201).json({ data: { deliverable } });
  } catch (error) {
    next(error);
  }
};

export const patchDeliverable = async (req, res, next) => {
  try {
    const deliverable = await updateDeliverable({
      user: req.user,
      team: req.team,
      deliverableId: req.params.id,
      input: req.body
    });
    res.json({ data: { deliverable } });
  } catch (error) {
    next(error);
  }
};

export const postSubmitDeliverable = async (req, res, next) => {
  try {
    const deliverable = await submitDeliverable({
      user: req.user,
      team: req.team,
      deliverableId: req.params.id,
      comment: req.body?.comment || ''
    });
    res.json({ data: { deliverable } });
  } catch (error) {
    next(error);
  }
};

const decide = decision => async (req, res, next) => {
  try {
    const result = await decideDeliverable({
      user: req.user,
      team: req.team,
      deliverableId: req.params.id,
      decision,
      comment: req.body?.comment || '',
      notes: req.body?.notes || []
    });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const postApproveDeliverable = decide('approved');
export const postRequestChangesDeliverable = decide('changes_requested');
export const postRejectDeliverable = decide('rejected');

/* ── Review notes ─────────────────────────────────────────────────────────── */

export const getReviewNotes = async (req, res, next) => {
  try {
    const notes = await listReviewNotes({ user: req.user, team: req.team, deliverableId: req.params.id });
    res.json({ data: { notes } });
  } catch (error) {
    next(error);
  }
};

export const postReviewNote = async (req, res, next) => {
  try {
    const note = await addReviewNote({
      user: req.user,
      team: req.team,
      deliverableId: req.params.id,
      input: req.body
    });
    res.status(201).json({ data: { note } });
  } catch (error) {
    next(error);
  }
};

export const postResolveReviewNote = async (req, res, next) => {
  try {
    const note = await resolveReviewNote({
      user: req.user,
      team: req.team,
      deliverableId: req.params.id,
      noteId: req.params.noteId
    });
    res.json({ data: { note } });
  } catch (error) {
    next(error);
  }
};

/* ── Handoffs ─────────────────────────────────────────────────────────────── */

export const getHandoffs = async (req, res, next) => {
  try {
    const handoffs = await listHandoffs({ user: req.user, team: req.team, query: req.query });
    res.json({ data: { handoffs } });
  } catch (error) {
    next(error);
  }
};

export const postHandoff = async (req, res, next) => {
  try {
    const handoff = await createHandoff({ user: req.user, team: req.team, input: req.body });
    res.status(201).json({ data: { handoff } });
  } catch (error) {
    next(error);
  }
};

export const postHandoffResponse = async (req, res, next) => {
  try {
    const handoff = await respondToHandoff({
      user: req.user,
      team: req.team,
      handoffId: req.params.id,
      status: req.body?.status
    });
    res.json({ data: { handoff } });
  } catch (error) {
    next(error);
  }
};

/* ── Project chat ─────────────────────────────────────────────────────────── */

export const getProjectMessages = async (req, res, next) => {
  try {
    const messages = await listProjectMessages({
      user: req.user,
      team: req.team,
      projectId: req.params.projectId,
      query: req.query
    });
    res.json({ data: { messages } });
  } catch (error) {
    next(error);
  }
};

export const postProjectMessageHandler = async (req, res, next) => {
  try {
    const message = await postProjectMessage({
      user: req.user,
      team: req.team,
      projectId: req.params.projectId,
      input: req.body
    });
    res.status(201).json({ data: { message } });
  } catch (error) {
    next(error);
  }
};
