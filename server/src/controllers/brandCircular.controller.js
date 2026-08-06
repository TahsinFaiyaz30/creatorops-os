import {
  acceptApplication,
  applyToCircular,
  closeBrandCircular,
  createBrandCircular,
  getApplicantCreatorProfile,
  getBrandCircular,
  getCircularApplicationEligibility,
  listApplicationsForUser,
  listBrandCirculars,
  listCircularApplications,
  publishBrandCircular,
  archiveBrandCircular,
  rejectApplication,
  shortlistApplication,
  updateBrandCircular,
  viewApplicationProfile
} from '../services/brandCircular.service.js';

export const createCircular = async (req, res, next) => {
  try {
    const circular = await createBrandCircular({ user: req.user, input: req.body });
    res.status(201).json({ data: { circular } });
  } catch (error) {
    next(error);
  }
};

export const getCirculars = async (req, res, next) => {
  try {
    const circulars = await listBrandCirculars({ user: req.user, query: req.query });
    res.json({ data: { circulars } });
  } catch (error) {
    next(error);
  }
};

export const getCircular = async (req, res, next) => {
  try {
    const circular = await getBrandCircular({ user: req.user, circularId: req.params.id });
    res.json({ data: { circular } });
  } catch (error) {
    next(error);
  }
};

export const patchCircular = async (req, res, next) => {
  try {
    const circular = await updateBrandCircular({ user: req.user, circularId: req.params.id, input: req.body });
    res.json({ data: { circular } });
  } catch (error) {
    next(error);
  }
};

export const publishCircular = async (req, res, next) => {
  try {
    const circular = await publishBrandCircular({ user: req.user, circularId: req.params.id });
    res.json({ data: { circular } });
  } catch (error) {
    next(error);
  }
};

export const closeCircular = async (req, res, next) => {
  try {
    const circular = await closeBrandCircular({ user: req.user, circularId: req.params.id });
    res.json({ data: { circular } });
  } catch (error) {
    next(error);
  }
};

export const archiveCircular = async (req, res, next) => {
  try {
    const circular = await archiveBrandCircular({ user: req.user, circularId: req.params.id });
    res.json({ data: { circular } });
  } catch (error) {
    next(error);
  }
};

export const applyCircular = async (req, res, next) => {
  try {
    const application = await applyToCircular({ user: req.user, circularId: req.params.id, input: req.body });
    res.status(201).json({ data: { application } });
  } catch (error) {
    next(error);
  }
};

export const getApplicationEligibility = async (req, res, next) => {
  try {
    const eligibility = await getCircularApplicationEligibility({ user: req.user, circularId: req.params.id });
    res.json({ data: { eligibility } });
  } catch (error) {
    next(error);
  }
};

export const getApplicantProfile = async (req, res, next) => {
  try {
    const profile = await getApplicantCreatorProfile({ user: req.user, applicationId: req.params.id });
    res.json({ data: { profile } });
  } catch (error) {
    next(error);
  }
};

export const getCircularApplications = async (req, res, next) => {
  try {
    const applications = await listCircularApplications({ user: req.user, circularId: req.params.id });
    res.json({ data: { applications } });
  } catch (error) {
    next(error);
  }
};

export const getMyApplications = async (req, res, next) => {
  try {
    const applications = await listApplicationsForUser({ user: req.user });
    res.json({ data: { applications } });
  } catch (error) {
    next(error);
  }
};

export const viewProfile = async (req, res, next) => {
  try {
    const application = await viewApplicationProfile({ user: req.user, applicationId: req.params.id });
    res.json({ data: { application } });
  } catch (error) {
    next(error);
  }
};

export const shortlist = async (req, res, next) => {
  try {
    const application = await shortlistApplication({ user: req.user, applicationId: req.params.id, reviewComment: req.body.reviewComment || req.body.comment || '' });
    res.json({ data: { application } });
  } catch (error) {
    next(error);
  }
};

export const reject = async (req, res, next) => {
  try {
    const application = await rejectApplication({ user: req.user, applicationId: req.params.id, reviewComment: req.body.reviewComment || req.body.comment || '' });
    res.json({ data: { application } });
  } catch (error) {
    next(error);
  }
};

export const accept = async (req, res, next) => {
  try {
    const application = await acceptApplication({ user: req.user, applicationId: req.params.id, reviewComment: req.body.reviewComment || req.body.comment || '' });
    res.json({ data: { application } });
  } catch (error) {
    next(error);
  }
};
