import env from '../config/env.js';
import { getOAuthStateReturnUrl } from '../services/oauthState.service.js';
import {
  completeOAuthCallback,
  startPlatformOAuth
} from '../services/platformConnection.service.js';

const getSafeOrigin = value => {
  if (!value) return '';

  try {
    const parsed = new URL(value);
    return env.clientUrls.includes(parsed.origin) ? parsed.origin : '';
  } catch (_error) {
    return '';
  }
};

const getSafeRequestReturnUrl = req => {
  const origin = getSafeOrigin(req.get('origin'));
  if (origin) return origin;

  const referrer = getSafeOrigin(req.get('referer') || req.get('referrer'));
  if (referrer) return referrer;

  return env.clientUrl;
};

const redirectToAccounts = (res, params, returnUrl = env.clientUrl) => {
  const safeReturnUrl = getSafeOrigin(returnUrl) || env.clientUrl;
  const url = new URL('/accounts', safeReturnUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  res.redirect(url.toString());
};

export const startOAuth = async (req, res, next) => {
  try {
    const result = await startPlatformOAuth({
      user: req.user,
      platform: req.params.platform,
      returnUrl: getSafeRequestReturnUrl(req)
    });

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const callbackOAuth = async (req, res) => {
  try {
    if (req.query.error) {
      const returnUrl = await getOAuthStateReturnUrl(String(req.query.state || ''));
      redirectToAccounts(res, {
        platform: req.params.platform,
        error: String(req.query.error_description || req.query.error)
      }, returnUrl);
      return;
    }

    const result = await completeOAuthCallback({
      platform: req.params.platform,
      code: req.query.code,
      state: req.query.state
    });

    redirectToAccounts(res, {
      platform: result.connection.platform,
      success: 'connected'
    }, result.returnUrl);
  } catch (error) {
    redirectToAccounts(res, {
      platform: req.params.platform,
      error: error.message
    }, error.returnUrl);
  }
};
