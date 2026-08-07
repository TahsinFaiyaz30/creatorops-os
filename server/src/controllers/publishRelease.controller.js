import {
  approvePublishRelease,
  listPendingReleases,
  rejectPublishRelease,
  requestPublishRelease
} from '../services/publishRelease.service.js';

export const getPendingReleases = async (req, res, next) => {
  try {
    const releases = await listPendingReleases({ user: req.user, team: req.team });
    res.json({ data: { releases } });
  } catch (error) {
    next(error);
  }
};

export const postRequestRelease = async (req, res, next) => {
  try {
    const approval = await requestPublishRelease({
      user: req.user,
      team: req.team,
      postGroupId: req.params.postGroupId,
      comment: req.body?.comment || ''
    });
    res.status(201).json({ data: { approval } });
  } catch (error) {
    next(error);
  }
};

export const postApproveRelease = async (req, res, next) => {
  try {
    const result = await approvePublishRelease({
      user: req.user,
      team: req.team,
      postGroupId: req.params.postGroupId,
      comment: req.body?.comment || ''
    });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const postRejectRelease = async (req, res, next) => {
  try {
    const result = await rejectPublishRelease({
      user: req.user,
      team: req.team,
      postGroupId: req.params.postGroupId,
      comment: req.body?.comment || ''
    });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};
