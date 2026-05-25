import { createCreatorStatisticSnapshot, getCreatorStatistics } from '../services/statistics.service.js';

export const getCreatorStats = async (req, res, next) => {
  try {
    const statistics = await getCreatorStatistics({ user: req.user });
    res.json({ data: { statistics } });
  } catch (error) {
    next(error);
  }
};

export const createSnapshot = async (req, res, next) => {
  try {
    const result = await createCreatorStatisticSnapshot({ user: req.user, source: req.body.source });
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};
