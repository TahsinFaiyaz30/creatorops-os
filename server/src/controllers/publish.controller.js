import {
  cancelPublishJob,
  createPublishJob,
  getPublishJobById,
  listPublishJobs,
  retryPublishJob,
  validatePublishPayload
} from '../services/publish.service.js';

export const validatePublish = async (req, res, next) => {
  try {
    const result = await validatePublishPayload({ user: req.user, input: req.body });
    res.json({ data: { validation: result } });
  } catch (error) {
    next(error);
  }
};

export const publishNow = async (req, res, next) => {
  try {
    const publishJob = await createPublishJob({ user: req.user, input: req.body, publishNow: true });
    res.status(201).json({ data: { publishJob } });
  } catch (error) {
    next(error);
  }
};

export const schedulePublish = async (req, res, next) => {
  try {
    const publishJob = await createPublishJob({ user: req.user, input: req.body, publishNow: false });
    res.status(201).json({ data: { publishJob } });
  } catch (error) {
    next(error);
  }
};

export const getJobs = async (req, res, next) => {
  try {
    const publishJobs = await listPublishJobs({ user: req.user });
    res.json({ data: { publishJobs } });
  } catch (error) {
    next(error);
  }
};

export const getJob = async (req, res, next) => {
  try {
    const publishJob = await getPublishJobById({ user: req.user, jobId: req.params.id });
    res.json({ data: { publishJob } });
  } catch (error) {
    next(error);
  }
};

export const cancelJob = async (req, res, next) => {
  try {
    const publishJob = await cancelPublishJob({ user: req.user, jobId: req.params.id });
    res.json({ data: { publishJob } });
  } catch (error) {
    next(error);
  }
};

export const retryJob = async (req, res, next) => {
  try {
    const publishJob = await retryPublishJob({ user: req.user, jobId: req.params.id });
    res.json({ data: { publishJob } });
  } catch (error) {
    next(error);
  }
};
