import BrandProfile from '../models/BrandProfile.js';
import { createWorkflowEvent } from './event.service.js';

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const allowedFields = ['brandName', 'tone', 'targetAudience', 'bannedWords', 'ctaStyle', 'preferredPlatforms'];

const pickBrandProfileFields = input =>
  allowedFields.reduce((picked, field) => {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      picked[field] = input[field];
    }
    return picked;
  }, {});

export const getBrandProfile = async user =>
  BrandProfile.findOne({
    workspaceId: user.workspaceId
  });

export const createBrandProfile = async (user, input) => {
  const existingProfile = await getBrandProfile(user);

  if (existingProfile) {
    throw createHttpError('Brand profile already exists for this workspace.', 409);
  }

  const data = pickBrandProfileFields(input);

  if (!data.brandName || !String(data.brandName).trim()) {
    throw createHttpError('brandName is required.', 400);
  }

  const brandProfile = await BrandProfile.create({
    ...data,
    workspaceId: user.workspaceId
  });

  await createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType: 'brand_profile.created',
    message: `Brand profile "${brandProfile.brandName}" created.`,
    entityType: 'BrandProfile',
    entityId: brandProfile._id,
    metadata: { brandName: brandProfile.brandName }
  });

  return brandProfile;
};

export const updateBrandProfile = async (user, input) => {
  const brandProfile = await getBrandProfile(user);

  if (!brandProfile) {
    throw createHttpError('Brand profile not found.', 404);
  }

  const updates = pickBrandProfileFields(input);

  Object.assign(brandProfile, updates);
  await brandProfile.save();

  await createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType: 'brand_profile.updated',
    message: `Brand profile "${brandProfile.brandName}" updated.`,
    entityType: 'BrandProfile',
    entityId: brandProfile._id,
    metadata: { changedFields: Object.keys(updates) }
  });

  return brandProfile;
};
