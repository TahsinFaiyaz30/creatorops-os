import BrandCircular from '../models/BrandCircular.js';
import CircularApplication from '../models/CircularApplication.js';
import MediaAsset from '../models/MediaAsset.js';
import PublishedPost from '../models/PublishedPost.js';
import { normalizePlatforms } from '../constants/platforms.js';
import { isBrandRepRole } from '../constants/roles.js';
import { emitRealtimeEvent } from '../sockets/socket.js';
import { createWorkflowEvent } from './event.service.js';
import { createNotification } from './notification.service.js';
import { getCreatorStatistics } from './statistics.service.js';

const createHttpError = (message, statusCode, code = '') => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
};

const requireBrandRep = user => {
  if (!isBrandRepRole(user.role)) {
    throw createHttpError('Forbidden: brand representative role is required.', 403);
  }
};

const parseDate = value => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createHttpError('deadline must be a valid date.', 400);
  }
  return date;
};

const normalizeCircularInput = input => ({
  title: String(input.title || '').trim(),
  productName: String(input.productName || '').trim(),
  productDescription: String(input.productDescription || '').trim(),
  productCategory: String(input.productCategory || '').trim(),
  targetAudience: String(input.targetAudience || '').trim(),
  campaignObjective: String(input.campaignObjective || '').trim(),
  platforms: normalizePlatforms(input.platforms || []),
  deliverables: {
    reels: Number(input.deliverables?.reels || input.reels || 0),
    posts: Number(input.deliverables?.posts || input.posts || 0),
    stories: Number(input.deliverables?.stories || input.stories || 0),
    videos: Number(input.deliverables?.videos || input.videos || 0),
    notes: String(input.deliverables?.notes || '').trim()
  },
  contentFormats: Array.isArray(input.contentFormats) ? input.contentFormats.map(String).filter(Boolean) : [],
  deadline: parseDate(input.deadline),
  budgetAmount: Number(input.budgetAmount || 0),
  currency: String(input.currency || 'USD').trim().toUpperCase(),
  eligibilityRequirements: String(input.eligibilityRequirements || '').trim(),
  brandDemands: String(input.brandDemands || '').trim(),
  judgingCriteria: String(input.judgingCriteria || '').trim(),
  mediaAssetIds: Array.isArray(input.mediaAssetIds) ? input.mediaAssetIds : []
});

const validateCircular = payload => {
  if (!payload.title) throw createHttpError('title is required.', 400);
  if (!payload.productName) throw createHttpError('productName is required.', 400);
  if (!payload.deadline) throw createHttpError('deadline is required.', 400);
};

const scopedCircular = async ({ user, circularId, includePublishedMarketplace = false }) => {
  const filter = { _id: circularId };
  if (includePublishedMarketplace) {
    filter.$or = [{ workspaceId: user.workspaceId }, { status: 'published' }];
  } else {
    filter.workspaceId = user.workspaceId;
  }

  const circular = await BrandCircular.findOne(filter)
    .populate('brandRepId', 'name email role workspaceId')
    .populate('mediaAssetIds');
  if (!circular) throw createHttpError('Brand circular not found.', 404);
  return circular;
};

const assertBrandOwner = ({ user, circular }) => {
  requireBrandRep(user);
  if (String(circular.brandRepId?._id || circular.brandRepId) !== String(user._id)) {
    throw createHttpError('Brand representatives can only manage their own circulars.', 403);
  }
};

export const createBrandCircular = async ({ user, input }) => {
  requireBrandRep(user);
  const payload = normalizeCircularInput(input);
  validateCircular(payload);

  const mediaCount = payload.mediaAssetIds.length
    ? await MediaAsset.countDocuments({ _id: { $in: payload.mediaAssetIds }, workspaceId: user.workspaceId })
    : 0;
  if (payload.mediaAssetIds.length && mediaCount !== payload.mediaAssetIds.length) {
    throw createHttpError('One or more circular media assets were not found in this workspace.', 404);
  }

  const circular = await BrandCircular.create({
    ...payload,
    workspaceId: user.workspaceId,
    brandRepId: user._id,
    status: 'draft'
  });

  await createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType: 'circular.created',
    message: 'Brand representative created a circular.',
    entityType: 'BrandCircular',
    entityId: circular._id,
    metadata: { circularId: circular._id, productName: circular.productName }
  });
  emitRealtimeEvent('calendar:updated', { workspaceId: user.workspaceId, source: 'brand_circular', entityId: circular._id });
  return circular;
};

export const listBrandCirculars = async ({ user, query = {} }) => {
  const filter = {};
  const wantsOwnCirculars = isBrandRepRole(user.role) && query.mine !== 'false';

  if (wantsOwnCirculars) {
    filter.workspaceId = user.workspaceId;
    filter.brandRepId = user._id;
    if (query.status) filter.status = query.status;
  } else {
    filter.status = 'published';
    if (query.platform) filter.platforms = query.platform;
  }

  return BrandCircular.find(filter).sort({ createdAt: -1 }).populate('brandRepId', 'name email role workspaceId').populate('mediaAssetIds');
};

export const getBrandCircular = async ({ user, circularId }) =>
  scopedCircular({ user, circularId, includePublishedMarketplace: true });

export const updateBrandCircular = async ({ user, circularId, input }) => {
  const circular = await scopedCircular({ user, circularId });
  assertBrandOwner({ user, circular });
  if (['closed', 'archived'].includes(circular.status)) {
    throw createHttpError('Closed or archived circulars cannot be edited.', 400);
  }
  Object.assign(circular, normalizeCircularInput({ ...circular.toObject(), ...input }));
  validateCircular(circular);
  await circular.save();
  return circular;
};

export const transitionCircular = async ({ user, circularId, status }) => {
  const circular = await scopedCircular({ user, circularId });
  assertBrandOwner({ user, circular });
  circular.status = status;
  await circular.save();

  await createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType: `circular.${status}`,
    message: `Brand circular ${status}.`,
    entityType: 'BrandCircular',
    entityId: circular._id,
    metadata: { circularId: circular._id, status }
  });
  emitRealtimeEvent('calendar:updated', { workspaceId: user.workspaceId, source: 'brand_circular', entityId: circular._id });
  return circular;
};

export const publishBrandCircular = ({ user, circularId }) =>
  transitionCircular({ user, circularId, status: 'published' });

export const closeBrandCircular = ({ user, circularId }) =>
  transitionCircular({ user, circularId, status: 'closed' });

export const archiveBrandCircular = ({ user, circularId }) =>
  transitionCircular({ user, circularId, status: 'archived' });

export const applyToCircular = async ({ user, circularId, input }) => {
  if (isBrandRepRole(user.role)) {
    throw createHttpError('Brand representatives cannot apply to circulars.', 403);
  }
  const circular = await BrandCircular.findOne({ _id: circularId, status: 'published' });
  if (!circular) throw createHttpError('Open brand circular not found.', 404);
  if (circular.deadline && circular.deadline < new Date()) {
    throw createHttpError('This circular deadline has passed.', 400);
  }

  const selectedPostIds = Array.isArray(input.selectedPostIds) ? input.selectedPostIds.slice(0, 2) : [];
  const selectedMediaAssetIds = Array.isArray(input.selectedMediaAssetIds) ? input.selectedMediaAssetIds.slice(0, 2) : [];
  if (selectedPostIds.length) {
    const count = await PublishedPost.countDocuments({ _id: { $in: selectedPostIds }, workspaceId: user.workspaceId, createdBy: user._id });
    if (count !== selectedPostIds.length) throw createHttpError('One or more selected posts are not available for this creator.', 404);
  }
  if (selectedMediaAssetIds.length) {
    const count = await MediaAsset.countDocuments({ _id: { $in: selectedMediaAssetIds }, workspaceId: user.workspaceId, uploadedBy: user._id });
    if (count !== selectedMediaAssetIds.length) throw createHttpError('One or more selected media assets are not available for this creator.', 404);
  }

  const statistics = await getCreatorStatistics({ user });
  try {
    const application = await CircularApplication.create({
      workspaceId: circular.workspaceId,
      circularId: circular._id,
      creatorId: user._id,
      message: String(input.message || '').trim(),
      creatorProfileSummary: String(input.creatorProfileSummary || '').trim(),
      combinedStatsSnapshot: statistics.combinedStats,
      platformStatsSnapshot: statistics.platformStats,
      selectedPostIds,
      selectedMediaAssetIds,
      status: 'submitted'
    });
    await createWorkflowEvent({
      workspaceId: circular.workspaceId,
      actorId: user._id,
      eventType: 'application.submitted',
      message: 'Creator submitted a brand circular application.',
      entityType: 'CircularApplication',
      entityId: application._id,
      metadata: { applicationId: application._id, circularId: circular._id }
    });
    emitRealtimeEvent('circular:application_submitted', application);
    emitRealtimeEvent('calendar:updated', { workspaceId: circular.workspaceId, source: 'application', entityId: application._id });
    return application;
  } catch (error) {
    if (error.code === 11000) {
      throw createHttpError('You already applied to this circular.', 409, 'DUPLICATE_APPLICATION');
    }
    throw error;
  }
};

export const listCircularApplications = async ({ user, circularId }) => {
  const circular = await scopedCircular({ user, circularId });
  assertBrandOwner({ user, circular });
  return CircularApplication.find({ workspaceId: user.workspaceId, circularId })
    .sort({ createdAt: -1 })
    .populate('creatorId', 'name email role')
    .populate('selectedPostIds')
    .populate('selectedMediaAssetIds');
};

export const listApplicationsForUser = async ({ user }) => {
  const filter = {};
  if (isBrandRepRole(user.role)) {
    filter.workspaceId = user.workspaceId;
    const circulars = await BrandCircular.find({ workspaceId: user.workspaceId, brandRepId: user._id }).select('_id');
    filter.circularId = { $in: circulars.map(circular => circular._id) };
  } else {
    filter.creatorId = user._id;
  }
  return CircularApplication.find(filter)
    .sort({ createdAt: -1 })
    .populate('circularId')
    .populate('creatorId', 'name email role')
    .populate('selectedPostIds')
    .populate('selectedMediaAssetIds');
};

const getApplicationForBrandAction = async ({ user, applicationId }) => {
  requireBrandRep(user);
  const application = await CircularApplication.findOne({ _id: applicationId, workspaceId: user.workspaceId })
    .populate('circularId')
    .populate('creatorId', 'name email role workspaceId');
  if (!application) throw createHttpError('Circular application not found.', 404);
  if (String(application.circularId.brandRepId) !== String(user._id)) {
    throw createHttpError('Brand representatives can only review their own circular applications.', 403);
  }
  return application;
};

const reviewApplication = async ({ user, applicationId, status, eventType, notificationType, notificationTitle, notificationMessage, reviewComment = '' }) => {
  const application = await getApplicationForBrandAction({ user, applicationId });
  application.status = status;
  application.reviewedBy = user._id;
  application.reviewComment = reviewComment;
  if (status === 'viewed') application.viewedAt = new Date();
  if (status === 'shortlisted') application.shortlistedAt = new Date();
  await application.save();

  await createNotification({
    workspaceId: application.creatorId.workspaceId || user.workspaceId,
    userId: application.creatorId._id,
    type: notificationType,
    title: notificationTitle,
    message: notificationMessage(application.circularId),
    entityType: 'CircularApplication',
    entityId: application._id
  });

  await createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType,
    message: notificationTitle,
    entityType: 'CircularApplication',
    entityId: application._id,
    metadata: {
      applicationId: application._id,
      circularId: application.circularId._id,
      creatorId: application.creatorId._id,
      status,
      reviewComment
    }
  });
  emitRealtimeEvent('circular:application_updated', application);
  return application;
};

export const viewApplicationProfile = ({ user, applicationId }) =>
  reviewApplication({
    user,
    applicationId,
    status: 'viewed',
    eventType: 'application.profile_viewed',
    notificationType: 'application_viewed',
    notificationTitle: 'Your creator profile was viewed',
    notificationMessage: circular => `Your creator profile was viewed for ${circular.title}.`
  });

export const shortlistApplication = ({ user, applicationId, reviewComment }) =>
  reviewApplication({
    user,
    applicationId,
    status: 'shortlisted',
    eventType: 'application.creator_shortlisted',
    notificationType: 'creator_shortlisted',
    notificationTitle: 'You have been shortlisted',
    notificationMessage: circular => `You have been shortlisted for ${circular.title}.`,
    reviewComment
  });

export const rejectApplication = ({ user, applicationId, reviewComment }) =>
  reviewApplication({
    user,
    applicationId,
    status: 'rejected',
    eventType: 'application.creator_rejected',
    notificationType: 'application_rejected',
    notificationTitle: 'Application rejected',
    notificationMessage: circular => `Your application for ${circular.title} was rejected.`,
    reviewComment
  });

export const acceptApplication = ({ user, applicationId, reviewComment }) =>
  reviewApplication({
    user,
    applicationId,
    status: 'accepted',
    eventType: 'application.creator_accepted',
    notificationType: 'application_accepted',
    notificationTitle: 'Application accepted',
    notificationMessage: circular => `Your application for ${circular.title} was accepted.`,
    reviewComment
  });
