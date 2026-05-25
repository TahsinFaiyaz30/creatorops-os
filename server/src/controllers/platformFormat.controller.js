import { getPlatformRule, getPlatformRules } from '../services/platformFormat.service.js';

export const listPlatformFormatsHandler = async (_req, res, next) => {
  try {
    const rules = await getPlatformRules();
    res.json({ data: { rules } });
  } catch (error) {
    next(error);
  }
};

export const getPlatformFormatHandler = async (req, res, next) => {
  try {
    const rule = await getPlatformRule(req.params.platform);
    res.json({ data: { rule } });
  } catch (error) {
    next(error);
  }
};
