import SystemSetting from '../models/SystemSetting.js';
import MediaAsset from '../models/MediaAsset.js';
import MediaUploadSession from '../models/MediaUploadSession.js';
import { calculateTemporaryUploadHardDeleteAt, createTemporaryMediaCleanupStats } from './temporaryMediaLifecycle.js';

export const TEMPORARY_MEDIA_RETENTION_SECONDS_KEY = 'temporaryMediaRetentionSeconds';
export const TEMPORARY_MEDIA_STORAGE_HARD_DELETE_SECONDS_KEY = 'temporaryMediaStorageHardDeleteSeconds';
export const TEMPORARY_UPLOAD_HARD_DELETE_SECONDS_ALIAS = 'temporaryUploadHardDeleteSeconds';
export const TEMPORARY_MEDIA_CLEANUP_STATS_KEY = 'temporaryMediaCleanupStats';
export const DEFAULT_TEMPORARY_MEDIA_RETENTION_SECONDS = 7 * 24 * 60 * 60;
export const DEFAULT_TEMPORARY_MEDIA_STORAGE_HARD_DELETE_SECONDS = 30 * 24 * 60 * 60;

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeRetentionSeconds = (value, label = 'Temporary media expiry') => {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw createHttpError(`${label} must be a number of seconds greater than or equal to 0.`, 400);
  }

  return Math.floor(seconds);
};

const getSettingSeconds = async ({ key, defaultValue, label }) => {
  const setting = await SystemSetting.findOne({ key });
  if (!setting) return defaultValue;

  try {
    return normalizeRetentionSeconds(setting.value, label);
  } catch (_error) {
    return defaultValue;
  }
};

export const getTemporaryMediaRetentionSeconds = async () => {
  return getSettingSeconds({
    key: TEMPORARY_MEDIA_RETENTION_SECONDS_KEY,
    defaultValue: DEFAULT_TEMPORARY_MEDIA_RETENTION_SECONDS,
    label: 'Temporary media retry expiry'
  });
};

export const getTemporaryMediaStorageHardDeleteSeconds = async () => {
  return getSettingSeconds({
    key: TEMPORARY_MEDIA_STORAGE_HARD_DELETE_SECONDS_KEY,
    defaultValue: DEFAULT_TEMPORARY_MEDIA_STORAGE_HARD_DELETE_SECONDS,
    label: 'Temporary upload hard delete expiry'
  });
};

export const getTemporaryMediaCleanupStats = async () => {
  const setting = await SystemSetting.findOne({ key: TEMPORARY_MEDIA_CLEANUP_STATS_KEY });
  return {
    ...createTemporaryMediaCleanupStats({ now: new Date(0) }),
    ...(setting?.value && typeof setting.value === 'object' ? setting.value : {}),
    lastRunAt: setting?.value?.lastRunAt || null
  };
};

export const getSystemSettings = async () => {
  const temporaryUploadHardDeleteSeconds = await getTemporaryMediaStorageHardDeleteSeconds();
  return {
    temporaryMediaRetentionSeconds: await getTemporaryMediaRetentionSeconds(),
    temporaryMediaStorageHardDeleteSeconds: temporaryUploadHardDeleteSeconds,
    temporaryUploadHardDeleteSeconds,
    temporaryMediaCleanup: await getTemporaryMediaCleanupStats(),
    defaults: {
      temporaryMediaRetentionSeconds: DEFAULT_TEMPORARY_MEDIA_RETENTION_SECONDS,
      temporaryMediaStorageHardDeleteSeconds: DEFAULT_TEMPORARY_MEDIA_STORAGE_HARD_DELETE_SECONDS,
      temporaryUploadHardDeleteSeconds: DEFAULT_TEMPORARY_MEDIA_STORAGE_HARD_DELETE_SECONDS
    }
  };
};

const refreshTemporaryMediaHardDeleteAt = async seconds => {
  const [assets, sessions] = await Promise.all([
    MediaAsset.find({ storageIntent: 'temporary_publish' }).select('createdAt'),
    MediaUploadSession.find({ storageIntent: 'temporary_publish' }).select('createdAt mediaAssetId')
  ]);
  const uploadStartedAtByAssetId = new Map(
    sessions
      .filter(session => session.mediaAssetId)
      .map(session => [String(session.mediaAssetId), session.createdAt])
  );

  await Promise.all([
    assets.length === 0
      ? Promise.resolve()
      : MediaAsset.bulkWrite(
        assets.map(asset => ({
          updateOne: {
            filter: { _id: asset._id },
            update: {
              $set: {
                storageHardDeleteAt: new Date(
                  calculateTemporaryUploadHardDeleteAt({
                    startedAt: uploadStartedAtByAssetId.get(String(asset._id)) || asset.createdAt || Date.now(),
                    hardDeleteSeconds: seconds
                  })
                )
              }
            }
          }
        }))
      ),
    sessions.length === 0
      ? Promise.resolve()
      : MediaUploadSession.bulkWrite(
        sessions.map(session => ({
          updateOne: {
            filter: { _id: session._id },
            update: {
              $set: {
                storageHardDeleteAt: calculateTemporaryUploadHardDeleteAt({
                  startedAt: session.createdAt || Date.now(),
                  hardDeleteSeconds: seconds
                })
              }
            }
          }
        }))
      )
  ]);
};

export const updateSystemSettings = async ({ user, input }) => {
  const hasRetryRetention = Object.prototype.hasOwnProperty.call(input, 'temporaryMediaRetentionSeconds');
  const hasStorageHardDelete =
    Object.prototype.hasOwnProperty.call(input, 'temporaryMediaStorageHardDeleteSeconds') ||
    Object.prototype.hasOwnProperty.call(input, TEMPORARY_UPLOAD_HARD_DELETE_SECONDS_ALIAS);

  if (!hasRetryRetention && !hasStorageHardDelete) {
    throw createHttpError('At least one media retention setting is required.', 400);
  }

  const updates = [];
  if (hasRetryRetention) {
    updates.push({
      key: TEMPORARY_MEDIA_RETENTION_SECONDS_KEY,
      value: normalizeRetentionSeconds(input.temporaryMediaRetentionSeconds, 'Temporary media retry expiry')
    });
  }
  if (hasStorageHardDelete) {
    const rawHardDeleteSeconds = Object.prototype.hasOwnProperty.call(input, TEMPORARY_UPLOAD_HARD_DELETE_SECONDS_ALIAS)
      ? input[TEMPORARY_UPLOAD_HARD_DELETE_SECONDS_ALIAS]
      : input.temporaryMediaStorageHardDeleteSeconds;
    updates.push({
      key: TEMPORARY_MEDIA_STORAGE_HARD_DELETE_SECONDS_KEY,
      value: normalizeRetentionSeconds(rawHardDeleteSeconds, 'Temporary upload hard delete expiry')
    });
  }

  await Promise.all(
    updates.map(update =>
      SystemSetting.findOneAndUpdate(
        { key: update.key },
        {
          value: update.value,
          updatedBy: user._id
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    )
  );

  const hardDeleteUpdate = updates.find(update => update.key === TEMPORARY_MEDIA_STORAGE_HARD_DELETE_SECONDS_KEY);
  if (hardDeleteUpdate) {
    await refreshTemporaryMediaHardDeleteAt(hardDeleteUpdate.value);
  }

  return getSystemSettings();
};

export const recordTemporaryMediaCleanupRun = async stats => {
  const normalizedStats = {
    ...createTemporaryMediaCleanupStats(),
    ...(stats || {}),
    lastRunAt: stats?.lastRunAt || new Date()
  };

  await SystemSetting.findOneAndUpdate(
    { key: TEMPORARY_MEDIA_CLEANUP_STATS_KEY },
    { value: normalizedStats, updatedBy: null },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return normalizedStats;
};
