import ScheduleJob from '../models/ScheduleJob.js';
import ContentItem from '../models/ContentItem.js';
import PlatformVariant from '../models/PlatformVariant.js';
import { adapterByPlatform } from '../constants/platforms.js';
import { createWorkflowEvent } from './event.service.js';
import { resolveSchedulePlatformAccount } from './platformAccount.service.js';
import { createVariantVersion } from './versioning.service.js';

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const requireCreatorAdmin = user => {
  if (user.role !== 'creator_admin') {
    throw createHttpError('Forbidden: creator_admin role is required for scheduling.', 403);
  }
};

const findScopedVariant = async (user, variantId) => {
  const variant = await PlatformVariant.findOne({
    _id: variantId,
    workspaceId: user.workspaceId
  });

  if (!variant) {
    throw createHttpError('Platform variant not found.', 404);
  }

  return variant;
};

const findScopedContentItem = async (workspaceId, contentItemId) => {
  const contentItem = await ContentItem.findOne({
    _id: contentItemId,
    workspaceId
  });

  if (!contentItem) {
    throw createHttpError('Content item not found.', 404);
  }

  return contentItem;
};

const findScopedScheduleJob = async (user, scheduleJobId) => {
  const job = await ScheduleJob.findOne({
    _id: scheduleJobId,
    workspaceId: user.workspaceId
  });

  if (!job) {
    throw createHttpError('Schedule job not found.', 404);
  }

  return job;
};

const parseScheduledAt = scheduledAt => {
  if (!scheduledAt) {
    throw createHttpError('scheduledAt is required.', 400);
  }

  const date = new Date(scheduledAt);

  if (Number.isNaN(date.getTime())) {
    throw createHttpError('scheduledAt must be a valid date.', 400);
  }

  return date;
};

const createSystemUser = job => ({
  _id: job.createdBy,
  role: 'creator_admin',
  workspaceId: job.workspaceId
});

const createScheduleVersion = async ({ user, contentItem, variant, job, changeNote }) =>
  createVariantVersion({
    user,
    contentItem,
    variant,
    changeNote,
    extraSnapshot: {
      scheduleJobId: job._id,
      scheduleJobStatus: job.status,
      scheduledAt: job.scheduledAt,
      adapterName: job.adapterName,
      resultMessage: job.resultMessage,
      platformAccountId: job.platformAccountId,
      platformAccountSnapshot: job.platformAccountSnapshot
    }
  });

const buildAccountSnapshot = account => ({
  platform: account.platform,
  accountName: account.accountName,
  accountHandle: account.accountHandle,
  accountType: account.accountType,
  status: account.status
});

export const createScheduleJob = async ({ variantId, platformAccountId, scheduledAt, user }) => {
  requireCreatorAdmin(user);

  if (!variantId) {
    throw createHttpError('variantId is required.', 400);
  }

  const scheduledDate = parseScheduledAt(scheduledAt);
  const variant = await findScopedVariant(user, variantId);

  if (variant.status !== 'approved') {
    throw createHttpError('Only approved variants can be scheduled.', 400);
  }

  const contentItem = await findScopedContentItem(user.workspaceId, variant.contentItemId);
  const previousStatus = variant.status;
  const adapterName = adapterByPlatform[variant.platform] || 'GenericAdapterSimulator';
  const platformAccount = await resolveSchedulePlatformAccount({
    user,
    platform: variant.platform,
    platformAccountId
  });
  const platformAccountSnapshot = buildAccountSnapshot(platformAccount);

  const job = await ScheduleJob.create({
    workspaceId: user.workspaceId,
    contentItemId: contentItem._id,
    variantId: variant._id,
    platformAccountId: platformAccount._id,
    platformAccountSnapshot,
    platform: variant.platform,
    scheduledAt: scheduledDate,
    status: 'queued',
    adapterName,
    resultMessage: '',
    createdBy: user._id
  });

  variant.status = 'scheduled';
  await variant.save();

  if (!['published'].includes(contentItem.status)) {
    contentItem.status = 'scheduled';
    await contentItem.save();
  }

  await createScheduleVersion({
    user,
    contentItem,
    variant,
    job,
    changeNote: 'Schedule job created'
  });

  await createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType: 'schedule.created',
    message: `Scheduled ${variant.platform} variant for the publishing simulator.`,
    entityType: 'ScheduleJob',
    entityId: job._id,
    metadata: {
      scheduleJobId: job._id,
      contentItemId: contentItem._id,
      variantId: variant._id,
      platform: variant.platform,
      platformAccountId: platformAccount._id,
      accountHandle: platformAccount.accountHandle,
      scheduledAt: job.scheduledAt,
      previousStatus,
      newStatus: variant.status
    }
  });

  return getScheduleJobById({ user, scheduleJobId: job._id });
};

export const getScheduleJobById = async ({ user, scheduleJobId }) =>
  ScheduleJob.findOne({
    _id: scheduleJobId,
    workspaceId: user.workspaceId
  })
    .populate('variantId', 'platform caption hook cta hashtags status brandScore readinessScore aiProvider')
    .populate('platformAccountId', 'platform accountName accountHandle accountType status isActive')
    .populate('contentItemId', 'title rawIdea status')
    .populate('createdBy', 'name email role');

export const getScheduleJobs = async ({ user }) =>
  ScheduleJob.find({
    workspaceId: user.workspaceId
  })
    .sort({ scheduledAt: 1, createdAt: -1 })
    .populate('variantId', 'platform caption hook cta hashtags status brandScore readinessScore aiProvider')
    .populate('platformAccountId', 'platform accountName accountHandle accountType status isActive')
    .populate('contentItemId', 'title rawIdea status')
    .populate('createdBy', 'name email role');

export const publishJob = async ({ job }) => {
  if (!job || !['queued', 'processing'].includes(job.status)) {
    return job;
  }

  const systemUser = createSystemUser(job);

  try {
    const lockedJob = await ScheduleJob.findOneAndUpdate(
      {
        _id: job._id,
        status: 'queued'
      },
      {
        status: 'processing'
      },
      { new: true }
    );

    const processingJob = lockedJob || (job.status === 'processing' ? job : null);

    if (!processingJob) {
      return ScheduleJob.findById(job._id);
    }

    const variant = await PlatformVariant.findOne({
      _id: processingJob.variantId,
      workspaceId: processingJob.workspaceId
    });

    if (!variant) {
      throw createHttpError('Platform variant not found.', 404);
    }

    const contentItem = await findScopedContentItem(processingJob.workspaceId, processingJob.contentItemId);
    const previousStatus = variant.status;

    await createWorkflowEvent({
      workspaceId: processingJob.workspaceId,
      actorId: processingJob.createdBy,
      eventType: 'schedule.processing',
      message: `Processing ${variant.platform} publishing simulation.`,
      entityType: 'ScheduleJob',
      entityId: processingJob._id,
      metadata: {
        scheduleJobId: processingJob._id,
        contentItemId: contentItem._id,
        variantId: variant._id,
        platform: variant.platform,
        platformAccountId: processingJob.platformAccountId,
        accountHandle: processingJob.platformAccountSnapshot?.accountHandle,
        adapterName: processingJob.adapterName,
        previousStatus,
        newStatus: 'processing'
      }
    });

    processingJob.status = 'published';
    const accountHandle = processingJob.platformAccountSnapshot?.accountHandle;
    processingJob.resultMessage = accountHandle
      ? `Published successfully to ${accountHandle} via ${processingJob.adapterName}`
      : `Published successfully via ${processingJob.adapterName}`;
    await processingJob.save();

    variant.status = 'published';
    await variant.save();

    contentItem.status = 'published';
    await contentItem.save();

    await createScheduleVersion({
      user: systemUser,
      contentItem,
      variant,
      job: processingJob,
      changeNote: 'Publishing simulator completed'
    });

    await createWorkflowEvent({
      workspaceId: processingJob.workspaceId,
      actorId: processingJob.createdBy,
      eventType: 'schedule.published',
      message: processingJob.resultMessage,
      entityType: 'ScheduleJob',
      entityId: processingJob._id,
      metadata: {
        scheduleJobId: processingJob._id,
        contentItemId: contentItem._id,
        variantId: variant._id,
        platform: variant.platform,
        platformAccountId: processingJob.platformAccountId,
        accountHandle,
        adapterName: processingJob.adapterName,
        resultMessage: processingJob.resultMessage,
        previousStatus,
        newStatus: variant.status
      }
    });

    return processingJob;
  } catch (error) {
    job.status = 'failed';
    job.resultMessage = error.message || 'Publishing simulator failed unexpectedly.';
    await job.save();

    await createWorkflowEvent({
      workspaceId: job.workspaceId,
      actorId: job.createdBy,
      eventType: 'schedule.failed',
      message: job.resultMessage,
      entityType: 'ScheduleJob',
      entityId: job._id,
      metadata: {
        scheduleJobId: job._id,
        contentItemId: job.contentItemId,
        variantId: job.variantId,
        platform: job.platform,
        adapterName: job.adapterName,
        resultMessage: job.resultMessage,
        previousStatus: 'processing',
        newStatus: 'failed'
      }
    });

    return job;
  }
};

export const runScheduleJobNow = async ({ scheduleJobId, user }) => {
  requireCreatorAdmin(user);

  const job = await findScopedScheduleJob(user, scheduleJobId);

  if (!['queued', 'processing'].includes(job.status)) {
    throw createHttpError('Only queued or processing schedule jobs can be run.', 400);
  }

  const publishedJob = await publishJob({ job });
  return getScheduleJobById({ user, scheduleJobId: publishedJob._id });
};

export const processDueJobs = async () => {
  const dueJobs = await ScheduleJob.find({
    status: 'queued',
    scheduledAt: { $lte: new Date() }
  }).limit(10);

  for (const job of dueJobs) {
    try {
      await publishJob({ job });
    } catch (_error) {
      // publishJob handles failure persistence; continue with the next due job.
    }
  }
};
