import SystemSetting from '../models/SystemSetting.js';

export const TEMPORARY_MEDIA_RETENTION_SECONDS_KEY = 'temporaryMediaRetentionSeconds';
export const DEFAULT_TEMPORARY_MEDIA_RETENTION_SECONDS = 7 * 24 * 60 * 60;

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeRetentionSeconds = value => {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw createHttpError('Temporary media expiry must be a number of seconds greater than or equal to 0.', 400);
  }

  return Math.floor(seconds);
};

export const getTemporaryMediaRetentionSeconds = async () => {
  const setting = await SystemSetting.findOne({ key: TEMPORARY_MEDIA_RETENTION_SECONDS_KEY });
  if (!setting) return DEFAULT_TEMPORARY_MEDIA_RETENTION_SECONDS;

  try {
    return normalizeRetentionSeconds(setting.value);
  } catch (_error) {
    return DEFAULT_TEMPORARY_MEDIA_RETENTION_SECONDS;
  }
};

export const getSystemSettings = async () => ({
  temporaryMediaRetentionSeconds: await getTemporaryMediaRetentionSeconds(),
  defaults: {
    temporaryMediaRetentionSeconds: DEFAULT_TEMPORARY_MEDIA_RETENTION_SECONDS
  }
});

export const updateSystemSettings = async ({ user, input }) => {
  if (!Object.prototype.hasOwnProperty.call(input, 'temporaryMediaRetentionSeconds')) {
    throw createHttpError('temporaryMediaRetentionSeconds is required.', 400);
  }

  const temporaryMediaRetentionSeconds = normalizeRetentionSeconds(input.temporaryMediaRetentionSeconds);

  await SystemSetting.findOneAndUpdate(
    { key: TEMPORARY_MEDIA_RETENTION_SECONDS_KEY },
    {
      value: temporaryMediaRetentionSeconds,
      updatedBy: user._id
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return getSystemSettings();
};
