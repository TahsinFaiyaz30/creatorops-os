import {
  createScheduleJob,
  getScheduleJobs,
  runScheduleJobNow
} from '../services/schedule.service.js';

export const createScheduleJobHandler = async (req, res, next) => {
  try {
    const scheduleJob = await createScheduleJob({
      variantId: req.body.variantId,
      platformAccountId: req.body.platformAccountId,
      scheduledAt: req.body.scheduledAt,
      user: req.user
    });

    res.status(201).json({ data: { scheduleJob } });
  } catch (error) {
    next(error);
  }
};

export const getScheduleJobsHandler = async (req, res, next) => {
  try {
    const scheduleJobs = await getScheduleJobs({ user: req.user });
    res.json({ data: { scheduleJobs } });
  } catch (error) {
    next(error);
  }
};

export const runScheduleJobNowHandler = async (req, res, next) => {
  try {
    const scheduleJob = await runScheduleJobNow({
      scheduleJobId: req.params.id,
      user: req.user
    });

    res.json({ data: { scheduleJob } });
  } catch (error) {
    next(error);
  }
};
