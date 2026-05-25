import cors from 'cors';
import express from 'express';

import env from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import aiRoutes from './routes/ai.routes.js';
import authRoutes from './routes/auth.routes.js';
import brandRoutes from './routes/brand.routes.js';
import campaignRoutes from './routes/campaign.routes.js';
import contentRoutes from './routes/content.routes.js';
import eventRoutes from './routes/event.routes.js';

const app = express();

app.use(
  cors({
    origin: env.clientUrl,
    credentials: true
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'creatorops-os-server'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/brand-profile', brandRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/events', eventRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
