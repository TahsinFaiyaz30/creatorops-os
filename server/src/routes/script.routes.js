import express from 'express';

import { convertScript, getScript, getScripts } from '../controllers/script.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getScripts);
router.get('/:id', getScript);
router.post('/:id/convert-to-content', convertScript);

export default router;
