import {
  createPlatformAccount,
  deletePlatformAccount,
  getPlatformAccountById,
  listPlatformAccounts,
  updatePlatformAccount
} from '../services/platformAccount.service.js';

export const createPlatformAccountHandler = async (req, res, next) => {
  try {
    const account = await createPlatformAccount({ user: req.user, input: req.body });
    res.status(201).json({ data: { account } });
  } catch (error) {
    next(error);
  }
};

export const listPlatformAccountsHandler = async (req, res, next) => {
  try {
    const accounts = await listPlatformAccounts({ user: req.user, query: req.query });
    res.json({ data: { accounts } });
  } catch (error) {
    next(error);
  }
};

export const getPlatformAccountHandler = async (req, res, next) => {
  try {
    const account = await getPlatformAccountById({ user: req.user, accountId: req.params.id });
    res.json({ data: { account } });
  } catch (error) {
    next(error);
  }
};

export const updatePlatformAccountHandler = async (req, res, next) => {
  try {
    const account = await updatePlatformAccount({
      user: req.user,
      accountId: req.params.id,
      input: req.body
    });
    res.json({ data: { account } });
  } catch (error) {
    next(error);
  }
};

export const deletePlatformAccountHandler = async (req, res, next) => {
  try {
    const account = await deletePlatformAccount({ user: req.user, accountId: req.params.id });
    res.json({ data: { account } });
  } catch (error) {
    next(error);
  }
};
