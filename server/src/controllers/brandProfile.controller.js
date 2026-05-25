import {
  createBrandProfile,
  getBrandProfile,
  updateBrandProfile
} from '../services/brandProfile.service.js';

export const getBrandProfileHandler = async (req, res, next) => {
  try {
    const brandProfile = await getBrandProfile(req.user);
    res.json({ data: { brandProfile } });
  } catch (error) {
    next(error);
  }
};

export const createBrandProfileHandler = async (req, res, next) => {
  try {
    const brandProfile = await createBrandProfile(req.user, req.body);
    res.status(201).json({ data: { brandProfile } });
  } catch (error) {
    next(error);
  }
};

export const updateBrandProfileHandler = async (req, res, next) => {
  try {
    const brandProfile = await updateBrandProfile(req.user, req.body);
    res.json({ data: { brandProfile } });
  } catch (error) {
    next(error);
  }
};
