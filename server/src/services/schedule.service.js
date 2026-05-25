const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const legacyDisabledError = () =>
  createHttpError(
    'Legacy publishing simulator is disabled. Use /api/publish/schedule with a real PlatformConnection.',
    410
  );

export const createScheduleJob = async () => {
  throw legacyDisabledError();
};

export const getScheduleJobById = async () => {
  throw legacyDisabledError();
};

export const getScheduleJobs = async () => [];

export const publishJob = async () => {
  throw legacyDisabledError();
};

export const runScheduleJobNow = async () => {
  throw legacyDisabledError();
};

export const processDueJobs = async () => [];
