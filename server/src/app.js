import cors from 'cors';
import express from 'express';

import env from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import aiRoutes from './routes/ai.routes.js';
import adminRoutes from './routes/admin.routes.js';
import approvalRoutes from './routes/approval.routes.js';
import authRoutes from './routes/auth.routes.js';
import brandCircularRoutes from './routes/brandCircular.routes.js';
import brandRoutes from './routes/brand.routes.js';
import calendarRoutes from './routes/calendar.routes.js';
import campaignRoutes from './routes/campaign.routes.js';
import contentRoutes from './routes/content.routes.js';
import eventRoutes from './routes/event.routes.js';
import mediaRoutes from './routes/media.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import oauthRoutes from './routes/oauth.routes.js';
import platformConnectionRoutes from './routes/platformConnection.routes.js';
import platformFormatRoutes from './routes/platformFormat.routes.js';
import publishRoutes from './routes/publish.routes.js';
import scriptRoutes from './routes/script.routes.js';
import socialRoutes from './routes/social.routes.js';
import statisticsRoutes from './routes/statistics.routes.js';
import userRoutes from './routes/user.routes.js';

const app = express();

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (env.clientUrls.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('CORS origin is not allowed.'));
  },
  credentials: true
};

app.use(
  cors(corsOptions)
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'creatorops-os-server'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api', brandCircularRoutes);
app.use('/api/brand-profile', brandRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/oauth', oauthRoutes);
app.use('/api/platform-connections', platformConnectionRoutes);
app.use('/api/platform-formats', platformFormatRoutes);
app.use('/api/publish', publishRoutes);
app.use('/api/scripts', scriptRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/users', userRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;

