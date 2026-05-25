import PlatformAccount from '../models/PlatformAccount.js';
import { SUPPORTED_PLATFORMS } from '../constants/platforms.js';

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const requireCreatorAdmin = user => {
  if (user.role !== 'creator_admin') {
    throw createHttpError('Forbidden: creator_admin role is required for platform account management.', 403);
  }
};

const allowedFields = ['platform', 'accountName', 'accountHandle', 'accountType', 'status', 'isActive'];

const pickFields = input =>
  allowedFields.reduce((picked, field) => {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      picked[field] = input[field];
    }
    return picked;
  }, {});

const validateAccountInput = input => {
  if (input.platform && !SUPPORTED_PLATFORMS.includes(input.platform)) {
    throw createHttpError('Unsupported platform.', 400);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'accountName') && !String(input.accountName || '').trim()) {
    throw createHttpError('accountName is required.', 400);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'accountHandle') && !String(input.accountHandle || '').trim()) {
    throw createHttpError('accountHandle is required.', 400);
  }
};

export const listPlatformAccounts = async ({ user, query = {} }) => {
  const filter = { workspaceId: user.workspaceId };

  if (query.platform) filter.platform = query.platform;
  if (query.status) filter.status = query.status;
  if (query.active === 'true') filter.isActive = true;
  if (query.active === 'false') filter.isActive = false;

  return PlatformAccount.find(filter).sort({ platform: 1, accountName: 1 });
};

export const getPlatformAccountById = async ({ user, accountId }) => {
  const account = await PlatformAccount.findOne({
    _id: accountId,
    workspaceId: user.workspaceId
  });

  if (!account) {
    throw createHttpError('Platform account not found.', 404);
  }

  return account;
};

export const createPlatformAccount = async ({ user, input }) => {
  requireCreatorAdmin(user);

  const data = pickFields(input);
  validateAccountInput({ platform: data.platform, accountName: data.accountName, accountHandle: data.accountHandle });

  if (!data.platform || !data.accountName || !data.accountHandle) {
    throw createHttpError('platform, accountName, and accountHandle are required.', 400);
  }

  try {
    return await PlatformAccount.create({
      ...data,
      workspaceId: user.workspaceId,
      createdBy: user._id
    });
  } catch (error) {
    if (error.code === 11000) {
      throw createHttpError('A platform account with this handle already exists for this workspace.', 409);
    }
    throw error;
  }
};

export const updatePlatformAccount = async ({ user, accountId, input }) => {
  requireCreatorAdmin(user);

  const account = await getPlatformAccountById({ user, accountId });
  const updates = pickFields(input);
  validateAccountInput(updates);

  Object.assign(account, updates);

  try {
    await account.save();
  } catch (error) {
    if (error.code === 11000) {
      throw createHttpError('A platform account with this handle already exists for this workspace.', 409);
    }
    throw error;
  }

  return account;
};

export const deletePlatformAccount = async ({ user, accountId }) => {
  requireCreatorAdmin(user);

  const account = await getPlatformAccountById({ user, accountId });
  account.isActive = false;
  await account.save();
  return account;
};

export const resolveSchedulePlatformAccount = async ({ user, platform, platformAccountId }) => {
  const filter = {
    workspaceId: user.workspaceId,
    platform,
    isActive: true,
    status: 'connected'
  };

  if (platformAccountId) {
    const account = await PlatformAccount.findOne({
      _id: platformAccountId,
      workspaceId: user.workspaceId,
      isActive: true
    });

    if (!account) {
      throw createHttpError('Platform account not found for this workspace.', 404);
    }

    if (account.platform !== platform) {
      throw createHttpError('Selected platform account does not match the variant platform.', 400);
    }

    if (account.status !== 'connected') {
      throw createHttpError('Selected platform account is not connected.', 400);
    }

    return account;
  }

  const matchingAccounts = await PlatformAccount.find(filter);

  if (matchingAccounts.length === 0) {
    throw createHttpError('Create a matching platform account before scheduling this variant.', 400);
  }

  if (matchingAccounts.length > 1) {
    throw createHttpError('platformAccountId is required when multiple active matching accounts exist.', 400);
  }

  return matchingAccounts[0];
};
