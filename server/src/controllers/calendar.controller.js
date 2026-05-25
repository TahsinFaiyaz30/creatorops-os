import { getCalendarFeed } from '../services/calendar.service.js';

export const calendarFeed = async (req, res, next) => {
  try {
    const feed = await getCalendarFeed({ user: req.user, query: req.query });
    res.json({ data: { feed } });
  } catch (error) {
    next(error);
  }
};
