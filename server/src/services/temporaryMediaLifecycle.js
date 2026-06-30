export const TEMPORARY_UPLOAD_SESSION_PRUNE_SECONDS = 7 * 24 * 60 * 60;

export const calculateTemporaryUploadHardDeleteAt = ({ startedAt, hardDeleteSeconds }) => {
  const normalizedStartedAt = startedAt ? new Date(startedAt) : new Date();
  const seconds = Math.max(0, Math.floor(Number(hardDeleteSeconds) || 0));
  return new Date(normalizedStartedAt.getTime() + seconds * 1000);
};

export const resolveTemporaryAssetHardDeleteAt = ({
  assetHardDeleteAt = null,
  assetCreatedAt = null,
  uploadStartedAt = null,
  hardDeleteSeconds
}) => {
  if (assetHardDeleteAt) return new Date(assetHardDeleteAt);
  return calculateTemporaryUploadHardDeleteAt({
    startedAt: uploadStartedAt || assetCreatedAt,
    hardDeleteSeconds
  });
};

export const hasLifecycleDeadlinePassed = ({ deadline, now = new Date() }) => {
  if (!deadline) return false;
  const deadlineTime = new Date(deadline).getTime();
  const nowTime = new Date(now).getTime();
  return Number.isFinite(deadlineTime) && Number.isFinite(nowTime) && deadlineTime <= nowTime;
};

export const createTemporaryMediaExpiredActionError = ({ action = 'retried' } = {}) => {
  const error = new Error(`Temporary media expired and was deleted. This publish job can no longer be ${action}.`);
  error.statusCode = 400;
  error.code = 'TEMPORARY_MEDIA_EXPIRED';
  return error;
};

export const assertTemporaryMediaAvailableForAction = ({ temporaryMediaExpiredAt, action }) => {
  if (!temporaryMediaExpiredAt) return;
  throw createTemporaryMediaExpiredActionError({ action });
};

export const createTemporaryMediaCleanupStats = ({
  now = new Date(),
  expiredUploadSessions = 0,
  prunedUploadSessions = 0,
  hardDeletedMediaAssets = 0,
  hardDeleteAffectedJobs = 0,
  retryDeletedMediaAssets = 0
} = {}) => ({
  lastRunAt: new Date(now),
  expiredUploadSessions,
  prunedUploadSessions,
  hardDeletedMediaAssets,
  hardDeleteAffectedJobs,
  retryDeletedMediaAssets
});
