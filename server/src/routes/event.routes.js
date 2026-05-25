import { Router } from 'express';

import { listWorkflowEventsHandler } from '../controllers/event.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', listWorkflowEventsHandler);

export default router;
