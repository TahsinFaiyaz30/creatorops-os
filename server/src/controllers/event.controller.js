import { listWorkflowEvents } from '../services/event.service.js';

export const listWorkflowEventsHandler = async (req, res, next) => {
  try {
    const events = await listWorkflowEvents(req.user, req.query);
    res.json({ data: { events } });
  } catch (error) {
    next(error);
  }
};
