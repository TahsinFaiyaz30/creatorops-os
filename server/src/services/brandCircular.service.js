import BrandCircular from '../models/BrandCircular.js';
import CircularApplication, { REQUIRED_APPLICATION_POST_COUNT } from '../models/CircularApplication.js';
import MediaAsset from '../models/MediaAsset.js';
import PublishedPost from '../models/PublishedPost.js';
import Review from '../models/Review.js';
import SocialMetricSnapshot from '../models/SocialMetricSnapshot.js';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import { normalizePlatforms } from '../constants/platforms.js';
import { isBrandRepRole } from '../constants/roles.js';
import { emitRealtimeEvent } from '../sockets/socket.js';
import { createWorkflowEvent } from './event.service.js';
import { hydrateMediaAssetPublicUrls } from './media.service.js';
import { createNotification } from './notification.service.js';
import { syncWorkspaceAudience } from './platformConnection.service.js';
import {
  ANALYTICS_WINDOW_DAYS,
  computeApplicantRankingScore,
  getCircularPlatformEligibility,
  getCreatorMeanStatistics,
  getCreatorStatistics
} from './statistics.service.js';

/*
 * Every workspace a creator owns: their personal one plus any team they run.
 * Marketplace figures are drawn from all of them, because a head who publishes
 * through their team is still publishing on their own accounts.
 */
const listOwnedWorkspaceIds = async creator => {
  const owned = await Workspace.find({ ownerId: creator._id }).select('_id');
  const ids = owned.map(workspace => workspace._id);
  const personalId = creator.personalWorkspaceId || creator.workspaceId;
  if (personalId && !ids.some(id => String(id) === String(personalId))) ids.push(personalId);
  return ids;
};

/* Refresh follower counts everywhere the creator owns accounts, not just the
   workspace they happen to be switched into while browsing circulars. */
const syncOwnedAudience = async ({ user, platforms }) => {
  const workspaceIds = await listOwnedWorkspaceIds(user);
  await Promise.all(
    workspaceIds.map(workspaceId => syncWorkspaceAudience({ workspaceId, platforms }).catch(() => []))
  );
};

const createHttpError = (message, statusCode, code = '') => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
};

const requireBrandRep = user => {
  if (!isBrandRepRole(user)) {
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
    .populate({ path: 'mediaAssetIds', select: '+objectKey' });
  if (!circular) throw createHttpError('Brand circular not found.', 404);
  await hydrateMediaAssetPublicUrls(circular.mediaAssetIds);
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
  const wantsOwnCirculars = isBrandRepRole(user) && query.mine !== 'false';

  if (wantsOwnCirculars) {
    filter.workspaceId = user.workspaceId;
    filter.brandRepId = user._id;
    if (query.status) filter.status = query.status;
  } else {
    filter.status = 'published';
    if (query.platform) filter.platforms = query.platform;
  }

  const circulars = await BrandCircular.find(filter)
    .sort({ createdAt: -1 })
    .populate('brandRepId', 'name email role workspaceId')
    .populate({ path: 'mediaAssetIds', select: '+objectKey' });
  await Promise.all(circulars.map(circular => hydrateMediaAssetPublicUrls(circular.mediaAssetIds)));
  return circulars;
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

const getOpenCircularForApplication = async ({ user, circularId }) => {
  if (isBrandRepRole(user)) {
    throw createHttpError('Brand representatives cannot apply to circulars.', 403);
  }
  const circular = await BrandCircular.findOne({ _id: circularId, status: 'published' });
  if (!circular) throw createHttpError('Open brand circular not found.', 404);
  return circular;
};

/*
 * Everything the apply screen needs before it lets a creator submit: which
 * platforms the circular demands, which of those the creator has actually
 * published on, and — when they qualify — a live preview of the exact figures
 * the server will freeze onto the application.
 */
export const getCircularApplicationEligibility = async ({ user, circularId }) => {
  const circular = await getOpenCircularForApplication({ user, circularId });
  const deadlinePassed = Boolean(circular.deadline && circular.deadline < new Date());

  /* Follower counts are read live so the preview matches what submitting stores. */
  await syncOwnedAudience({ user, platforms: circular.platforms });

  const eligibility = await getCircularPlatformEligibility({
    creator: user,
    requiredPlatforms: circular.platforms || []
  });

  const existingApplication = await CircularApplication.findOne({
    circularId: circular._id,
    creatorId: user._id
  }).select('_id status createdAt');

  const meanStatistics = eligibility.eligible
    ? await getCreatorMeanStatistics({ creator: user, platforms: eligibility.commonPlatforms })
    : null;

  return {
    circularId: circular._id,
    requiredPostCount: REQUIRED_APPLICATION_POST_COUNT,
    windowDays: ANALYTICS_WINDOW_DAYS,
    deadline: circular.deadline,
    deadlinePassed,
    alreadyApplied: Boolean(existingApplication),
    existingApplication,
    ...eligibility,
    canApply: eligibility.eligible && !deadlinePassed && !existingApplication,
    meanStatistics
  };
};

export const applyToCircular = async ({ user, circularId, input }) => {
  const circular = await getOpenCircularForApplication({ user, circularId });
  if (circular.deadline && circular.deadline < new Date()) {
    throw createHttpError('This circular deadline has passed.', 400);
  }

  /*
   * Exactly two posts — not "up to two". The posts are cross-platform and carry
   * their own media, so there is no separate media attachment step: a brand
   * comparing applicants always reads the same two-post sample.
   */
  const selectedPostIds = [...new Set((Array.isArray(input.selectedPostIds) ? input.selectedPostIds : []).map(String))];
  if (selectedPostIds.length !== REQUIRED_APPLICATION_POST_COUNT) {
    throw createHttpError(
      `Select exactly ${REQUIRED_APPLICATION_POST_COUNT} published posts to apply. ${selectedPostIds.length} selected.`,
      400,
      'POST_SELECTION_REQUIRED'
    );
  }
  /*
   * Platform coverage gate first: it is the more fundamental reason an
   * application is refused, so checking it before post ownership means a creator
   * who cannot apply at all is told that, not that their post ids look wrong.
   */
  const eligibility = await getCircularPlatformEligibility({
    creator: user,
    requiredPlatforms: circular.platforms || []
  });
  if (!eligibility.eligible) {
    throw createHttpError(
      eligibility.reason || 'You do not meet the platform requirements for this circular.',
      403,
      'PLATFORM_REQUIREMENTS_UNMET'
    );
  }

  const postCount = await PublishedPost.countDocuments({
    _id: { $in: selectedPostIds },
    workspaceId: user.workspaceId,
    createdBy: user._id,
    status: 'published'
  });
  if (postCount !== selectedPostIds.length) {
    throw createHttpError('One or more selected posts are not published posts belonging to this creator.', 404);
  }

  /* Refresh follower counts, then freeze the means onto the application. */
  await syncOwnedAudience({ user, platforms: eligibility.commonPlatforms });
  const [statistics, meanStatistics] = await Promise.all([
    getCreatorStatistics({ user }),
    getCreatorMeanStatistics({ creator: user, platforms: eligibility.commonPlatforms })
  ]);

  try {
    const application = await CircularApplication.create({
      workspaceId: circular.workspaceId,
      circularId: circular._id,
      creatorId: user._id,
      message: String(input.message || '').trim(),
      creatorProfileSummary: String(input.creatorProfileSummary || '').trim(),
      combinedStatsSnapshot: statistics.combinedStats,
      platformStatsSnapshot: statistics.platformStats,
      meanStatsSnapshot: meanStatistics,
      commonPlatforms: eligibility.commonPlatforms,
      analyticsWindow: {
        days: meanStatistics.windowDays,
        start: meanStatistics.windowStart,
        end: meanStatistics.windowEnd
      },
      selectedPostIds,
      /* Ordering key for the brand's applicant list, computed once, here. */
      rankingScore: computeApplicantRankingScore(meanStatistics),
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

    /* The ordering key stays server-side, including on the creator's own receipt. */
    const { rankingScore, ...response } = application.toObject();
    return response;
  } catch (error) {
    if (error.code === 11000) {
      throw createHttpError('You already applied to this circular.', 409, 'DUPLICATE_APPLICATION');
    }
    throw error;
  }
};

/* The attached posts carry their own media, so their assets need public URLs. */
const hydrateApplicationPostMedia = async applications => {
  await Promise.all(
    applications.flatMap(application =>
      (application.selectedPostIds || []).map(post => hydrateMediaAssetPublicUrls(post?.mediaAssetIds))
    )
  );
  return applications;
};

const withPostMedia = query =>
  query.populate({
    path: 'selectedPostIds',
    populate: { path: 'mediaAssetIds', select: '+objectKey' }
  });

/*
 * Strongest applicant first. The sort keys match the
 * { circularId, rankingScore: -1, createdAt: -1 } index exactly, so Mongo reads
 * rows out of the index already ordered instead of sorting them per request.
 * createdAt breaks ties so the order is stable across reloads.
 *
 * `rankingScore` itself is projected away: it exists to order the list, and the
 * brand is meant to judge on the means themselves, not on a derived figure.
 */
const RANKED_SORT = { rankingScore: -1, createdAt: -1 };

export const listCircularApplications = async ({ user, circularId }) => {
  const circular = await scopedCircular({ user, circularId });
  assertBrandOwner({ user, circular });
  const applications = await withPostMedia(
    CircularApplication.find({ workspaceId: user.workspaceId, circularId })
      .sort(RANKED_SORT)
      .select('-rankingScore')
      .populate('creatorId', 'name email role profile averageRating totalReviews')
  );
  return hydrateApplicationPostMedia(applications);
};

export const listApplicationsForUser = async ({ user }) => {
  const filter = {};
  /* Brand reps read a ranked applicant pool; creators read their own history. */
  const isBrandRep = isBrandRepRole(user);
  if (isBrandRep) {
    filter.workspaceId = user.workspaceId;
    const circulars = await BrandCircular.find({ workspaceId: user.workspaceId, brandRepId: user._id }).select('_id');
    filter.circularId = { $in: circulars.map(circular => circular._id) };
  } else {
    filter.creatorId = user._id;
  }
  const applications = await withPostMedia(
    CircularApplication.find(filter)
      .sort(isBrandRep ? RANKED_SORT : { createdAt: -1 })
      .select('-rankingScore')
      .populate('circularId')
      .populate('creatorId', 'name email role profile averageRating totalReviews')
  );
  return hydrateApplicationPostMedia(applications);
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

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * Applicant profile, scoped to one application.
 *
 * A brand representative can open this only for a creator who applied to a
 * circular that representative owns — there is no browsable creator directory
 * here, and `getApplicationForBrandAction` is what enforces that. The numbers
 * are recomputed on read (unlike `meanStatsSnapshot`, which is frozen at submit
 * time) so the brand sees where the creator stands right now.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const getApplicantCreatorProfile = async ({ user, applicationId }) => {
  const application = await getApplicationForBrandAction({ user, applicationId });

  const creator = await User.findById(application.creatorId._id).select('-passwordHash');
  if (!creator) throw createHttpError('Creator account not found.', 404);

  const circular = application.circularId;
  const commonPlatforms = application.commonPlatforms?.length
    ? [...application.commonPlatforms]
    : normalizePlatforms(circular.platforms || []);

  /*
   * Every workspace this creator owns, matched on attribution rather than on who
   * pressed publish. A head whose team composes and publishes on their accounts
   * owns that output exactly as if they had posted it solo; a hired member is
   * not an owner, so none of it follows them.
   */
  const ownedWorkspaceIds = await listOwnedWorkspaceIds(creator);

  const [meanStatistics, posts, reviews, populatedApplication] = await Promise.all([
    getCreatorMeanStatistics({ creator, platforms: commonPlatforms }),
    PublishedPost.find({
      workspaceId: { $in: ownedWorkspaceIds },
      status: 'published',
      $or: [{ attributedToId: creator._id }, { attributedToId: null, createdBy: creator._id }]
    })
      .sort({ publishedAt: -1, createdAt: -1 })
      .populate({ path: 'mediaAssetIds', select: '+objectKey' })
      .populate('contentItemId', 'title'),
    Review.find({ targetUserId: creator._id })
      .populate('reviewerId', 'name role profile.avatarUrl')
      .sort({ createdAt: -1 })
      .limit(10),
    withPostMedia(CircularApplication.findById(application._id).select('-rankingScore'))
  ]);

  await Promise.all([
    ...posts.map(post => hydrateMediaAssetPublicUrls(post.mediaAssetIds)),
    hydrateApplicationPostMedia([populatedApplication])
  ]);

  const metricMap = await SocialMetricSnapshot.find({
    workspaceId: { $in: ownedWorkspaceIds },
    publishedPostId: { $in: posts.map(post => post._id) }
  })
    .sort({ collectedAt: -1 })
    .then(snapshots =>
      snapshots.reduce((map, snapshot) => {
        const key = String(snapshot.publishedPostId);
        if (!map.has(key)) map.set(key, snapshot);
        return map;
      }, new Map())
    );

  const selectedPostIds = new Set((application.selectedPostIds || []).map(String));

  return {
    application: populatedApplication,
    circular: {
      _id: circular._id,
      title: circular.title,
      productName: circular.productName,
      platforms: circular.platforms,
      deadline: circular.deadline,
      status: circular.status
    },
    creator: {
      _id: creator._id,
      name: creator.name,
      email: creator.email,
      role: creator.role,
      roles: creator.roles,
      profile: creator.profile,
      averageRating: creator.averageRating,
      totalReviews: creator.totalReviews,
      createdAt: creator.createdAt
    },
    reviews,
    /* Frozen at submit time vs. recomputed now — the page shows both. */
    submittedMeanStatistics: application.meanStatsSnapshot || null,
    meanStatistics,
    posts: posts.map(post => {
      const snapshot = metricMap.get(String(post._id));
      return {
        _id: post._id,
        platform: post.platform,
        caption: post.caption,
        title: post.contentItemId?.title || '',
        providerPostUrl: post.providerPostUrl,
        publishedAt: post.publishedAt || post.createdAt,
        visibility: post.visibility,
        accountSnapshot: post.accountSnapshot,
        mediaAssets: post.mediaAssetIds || [],
        lastAnalyticsSyncAt: post.lastAnalyticsSyncAt,
        isAttachedToApplication: selectedPostIds.has(String(post._id)),
        metrics: snapshot
          ? {
              views: snapshot.views || 0,
              likes: snapshot.likes || 0,
              reactions: snapshot.reactions || 0,
              comments: snapshot.comments || 0,
              shares: snapshot.shares || 0,
              saves: snapshot.saves || 0,
              collectedAt: snapshot.collectedAt
            }
          : null
      };
    })
  };
};

const reviewApplication = async ({ user, applicationId, status, eventType, notificationType, notificationTitle, notificationMessage, reviewComment = '' }) => {
  const application = await getApplicationForBrandAction({ user, applicationId });
  application.status = status;
  application.reviewedBy = user._id;
  application.reviewComment = reviewComment;
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

/*
 * Recording a view is not a review, and the applicant profile page records one
 * on every load. So this stays outside `reviewApplication`: it must not undo a
 * decision the brand already made (an accepted applicant reverting to "viewed"
 * on a second look would lose the outcome), and it notifies the creator only
 * the first time — otherwise every page refresh would fire another alert.
 */
export const viewApplicationProfile = async ({ user, applicationId }) => {
  const application = await getApplicationForBrandAction({ user, applicationId });
  const isFirstView = !application.viewedAt;

  if (application.status === 'submitted') application.status = 'viewed';
  application.viewedAt = new Date();
  await application.save();

  if (!isFirstView) return application;

  await createNotification({
    workspaceId: application.creatorId.workspaceId || user.workspaceId,
    userId: application.creatorId._id,
    type: 'application_viewed',
    title: 'Your creator profile was viewed',
    message: `Your creator profile was viewed for ${application.circularId.title}.`,
    entityType: 'CircularApplication',
    entityId: application._id
  });

  await createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType: 'application.profile_viewed',
    message: 'Your creator profile was viewed',
    entityType: 'CircularApplication',
    entityId: application._id,
    metadata: {
      applicationId: application._id,
      circularId: application.circularId._id,
      creatorId: application.creatorId._id,
      status: application.status
    }
  });

  emitRealtimeEvent('circular:application_updated', application);
  return application;
};

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
