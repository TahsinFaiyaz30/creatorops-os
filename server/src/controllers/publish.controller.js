import {
  cancelPublishJob,
  createPublishJob,
  deletePublishGroupDispatch,
  deletePublishJobDispatch,
  getPublishMediaPlan,
  getPublishJobById,
  listPublishJobs,
  pausePublishJob,
  resumePublishJob,
  retryPublishJob,
  validatePublishPayload
} from '../services/publish.service.js';
import { getSystemSettings } from '../services/systemSettings.service.js';

export const validatePublish = async (req, res, next) => {
  try {
    const result = await validatePublishPayload({ user: req.user, input: req.body });
    res.json({ data: { validation: result } });
  } catch (error) {
    next(error);
  }
};

export const mediaPlan = async (req, res, next) => {
  try {
    const plan = await getPublishMediaPlan({ user: req.user, input: req.body });
    res.json({ data: { plan } });
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

export const pauseJob = async (req, res, next) => {
  try {
    const publishJob = await pausePublishJob({ user: req.user, jobId: req.params.id });
    res.json({ data: { publishJob } });
  } catch (error) {
    next(error);
  }
};

export const resumeJob = async (req, res, next) => {
  try {
    const publishJob = await resumePublishJob({ user: req.user, jobId: req.params.id });
    res.json({ data: { publishJob } });
  } catch (error) {
    next(error);
  }
};

export const retryJob = async (req, res, next) => {
  try {
    const publishJob = await retryPublishJob({ user: req.user, jobId: req.params.id, input: req.body });
    res.json({ data: { publishJob } });
  } catch (error) {
    next(error);
  }
};

export const deleteJobDispatch = async (req, res, next) => {
  try {
    const result = await deletePublishJobDispatch({ user: req.user, jobId: req.params.id, input: req.body });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const deleteGroupDispatch = async (req, res, next) => {
  try {
    const result = await deletePublishGroupDispatch({ user: req.user, groupId: req.params.id, input: req.body });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const getPublishSettings = async (_req, res, next) => {
  try {
    const settings = await getSystemSettings();
    res.json({ data: { settings } });
  } catch (error) {
    next(error);
  }
};
