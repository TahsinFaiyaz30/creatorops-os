import express from 'express';

import { createSnapshot, getCreatorStats } from '../controllers/statistics.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticate);

router.get('/creator', getCreatorStats);
router.post('/snapshot', createSnapshot);

export default router;
