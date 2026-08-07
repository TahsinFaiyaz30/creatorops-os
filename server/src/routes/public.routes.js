import { Router } from 'express';

import { getPublicStats } from '../services/publicStats.service.js';

const router = Router();

/*
 * Unauthenticated on purpose — the signup page reads it before anyone has an
 * account. Everything it returns is a count or a stage name; see the header of
 * publicStats.service.js for what that rules out.
 */
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await getPublicStats();
    /* Short shared cache: identical for every visitor, cheap to serve stale. */
    res.set('Cache-Control', 'public, max-age=30');
    res.json({ data: { stats } });
  } catch (error) {
    next(error);
  }
});

export default router;
