import ApprovalRequest from '../models/ApprovalRequest.js';
import PublishJob from '../models/PublishJob.js';
import Workspace from '../models/Workspace.js';
import { TEAM_PERMISSIONS } from '../constants/teamPermissions.js';
import { emitRealtimeEvent } from '../sockets/socket.js';
import { createWorkflowEvent } from './event.service.js';
import { createNotification } from './notification.service.js';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * The release gate.
 *
 * Members compose a cross-platform post; the head releases it once; it then goes
 * out on the head's connected accounts. A member holding publish.dispatch can
 * queue work but cannot put anything on a real account without that release.
 *
 * Enforced in two places on purpose:
 *   · here, when a job is created — so the UI can say "waiting on release"; and
 *   · inside the worker's atomic claim — because a scheduled job dispatches
 *     minutes or days later, and the release could have been revoked in between.
 *
 * Off for a workspace with one active member, so a solo creator never meets it.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const createHttpError = (message, statusCode, code = '') => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
};

const idOf = value => String(value?._id || value || '');

export const workspaceRequiresRelease = async workspaceId => {
  const workspace = await Workspace.findById(workspaceId).select('settings type');
  return Boolean(workspace?.settings?.requirePublishApproval);
};

/** What a new job's releaseStatus should be. */
export const resolveInitialReleaseStatus = async ({ workspaceId }) =>
  (await workspaceRequiresRelease(workspaceId)) ? 'pending' : 'not_required';

const canRelease = team => !team || team.isOwner || team.can(TEAM_PERMISSIONS.APPROVAL_DECIDE);

const loadGroupJobs = async ({ user, postGroupId }) => {
  const jobs = await PublishJob.find({ workspaceId: user.workspaceId, postGroupId });
  if (jobs.length === 0) throw createHttpError('No dispatch jobs found for that post.', 404);
  return jobs;
};

/** A member asks the head to release the whole cross-platform post. */
export const requestPublishRelease = async ({ user, team, postGroupId, comment = '' }) => {
  const jobs = await loadGroupJobs({ user, postGroupId });

  const existing = await ApprovalRequest.findOne({
    workspaceId: user.workspaceId,
    kind: 'publish_release',
    postGroupId,
    status: 'pending'
  });
  if (existing) return existing;

  const approval = await ApprovalRequest.create({
    workspaceId: user.workspaceId,
    subjectType: 'PublishJob',
    subjectId: jobs[0]._id,
    kind: 'publish_release',
    postGroupId,
    projectId: jobs[0].campaignId || null,
    requestedBy: user._id,
    status: 'pending',
    comment
  });

  await PublishJob.updateMany(
    { workspaceId: user.workspaceId, postGroupId },
    { $set: { releaseStatus: 'pending', releaseApprovalId: approval._id } }
  );

  const workspace = await Workspace.findById(user.workspaceId).select('ownerId name');
  if (idOf(workspace.ownerId) !== idOf(user._id)) {
    await createNotification({
      workspaceId: user.workspaceId,
      userId: workspace.ownerId,
      type: 'approval_requested',
      title: 'A post is waiting for your release',
      message: `${user.name} is asking to publish a post across ${jobs.length} platform${jobs.length === 1 ? '' : 's'}.`,
      entityType: 'ApprovalRequest',
      entityId: approval._id
    }).catch(() => {});
  }

  await createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType: 'publish.release_requested',
    message: 'Release requested for a cross-platform post.',
    entityType: 'ApprovalRequest',
    entityId: approval._id,
    metadata: { postGroupId, jobCount: jobs.length }
  });

  emitRealtimeEvent('publishing:release_requested', { workspaceId: user.workspaceId, postGroupId });
  return approval;
};

const decideRelease = async ({ user, team, postGroupId, approve, comment }) => {
  if (!canRelease(team)) {
    throw createHttpError(
      'Your position in this team does not allow releasing posts to the connected accounts.',
      403,
      'TEAM_PERMISSION_DENIED'
    );
  }

  const jobs = await loadGroupJobs({ user, postGroupId });

  const approval = await ApprovalRequest.findOne({
    workspaceId: user.workspaceId,
    kind: 'publish_release',
    postGroupId,
    status: 'pending'
  });

  if (approval) {
    approval.status = approve ? 'approved' : 'rejected';
    approval.reviewedBy = user._id;
    approval.comment = comment || '';
    approval.decidedAt = new Date();
    await approval.save();
  }

  await PublishJob.updateMany(
    { workspaceId: user.workspaceId, postGroupId },
    {
      $set: {
        releaseStatus: approve ? 'approved' : 'rejected',
        releasedBy: user._id,
        releasedAt: new Date()
      }
    }
  );

  const requesterIds = [...new Set(jobs.map(job => idOf(job.createdBy)))].filter(id => id !== idOf(user._id));
  await Promise.all(
    requesterIds.map(userId =>
      createNotification({
        workspaceId: user.workspaceId,
        userId,
        type: approve ? 'publish_released' : 'approval_decided',
        title: approve ? 'Your post was released' : 'Your post was not released',
        message: approve
          ? `${user.name} released the post. It will publish on the connected accounts.`
          : `${user.name} declined to release the post.${comment ? ` — ${comment}` : ''}`,
        entityType: 'ApprovalRequest',
        entityId: approval?._id || null
      }).catch(() => {})
    )
  );

  await createWorkflowEvent({
    workspaceId: user.workspaceId,
    actorId: user._id,
    eventType: approve ? 'publish.released' : 'publish.release_rejected',
    message: approve ? 'Post released to the connected accounts.' : 'Post release declined.',
    entityType: 'ApprovalRequest',
    entityId: approval?._id || null,
    metadata: { postGroupId, jobCount: jobs.length, comment: comment || '' }
  });

  emitRealtimeEvent('publishing:release_decided', {
    workspaceId: user.workspaceId,
    postGroupId,
    approved: approve
  });

  return { postGroupId, releaseStatus: approve ? 'approved' : 'rejected', jobCount: jobs.length };
};

export const approvePublishRelease = ({ user, team, postGroupId, comment = '' }) =>
  decideRelease({ user, team, postGroupId, approve: true, comment });

export const rejectPublishRelease = ({ user, team, postGroupId, comment = '' }) =>
  decideRelease({ user, team, postGroupId, approve: false, comment });

/** Post groups waiting on a release, for the head's review queue. */
export const listPendingReleases = async ({ user, team }) => {
  if (!canRelease(team)) return [];

  const approvals = await ApprovalRequest.find({
    workspaceId: user.workspaceId,
    kind: 'publish_release',
    status: 'pending'
  })
    .sort({ createdAt: -1 })
    .populate('requestedBy', 'name email profile.avatarUrl')
    .populate('projectId', 'name');

  const groupIds = approvals.map(approval => approval.postGroupId).filter(Boolean);
  const jobs = groupIds.length
    ? await PublishJob.find({ workspaceId: user.workspaceId, postGroupId: { $in: groupIds } })
        .select('postGroupId platform caption accountSnapshot scheduledAt status releaseStatus')
        .sort({ createdAt: 1 })
    : [];

  const jobsByGroup = jobs.reduce((acc, job) => {
    acc[job.postGroupId] = acc[job.postGroupId] || [];
    acc[job.postGroupId].push(job);
    return acc;
  }, {});

  return approvals.map(approval => ({
    ...approval.toObject(),
    jobs: jobsByGroup[approval.postGroupId] || []
  }));
};
