import http from 'http';

import app from './app.js';
import { connectDb, disconnectDb } from './config/db.js';
import env, { validateEnv } from './config/env.js';
import { backfillTeamsIfNeeded } from './seed/backfillTeams.js';
import { initSocket } from './sockets/socket.js';
import { startPublishingWorker, stopPublishingWorker } from './workers/publishingWorker.js';

const startServer = async () => {
  validateEnv();
  await connectDb();

  /*
   * Give any pre-teams workspace its positions and owner membership. Runs here
   * rather than as a deploy step because the hosting tier has no shell to run a
   * migration from, and it no-ops on every boot after the first.
   *
   * A failure must not stop the server: the app works without it (workspace
   * owners short-circuit the permission check), so a transient DB hiccup should
   * not take the whole service down.
   */
  await backfillTeamsIfNeeded().catch(error => {
    console.error('[teams] backfill skipped:', error.message);
  });

  const server = http.createServer(app);
  initSocket(server);
  startPublishingWorker();

  server.listen(env.port, () => {
    console.log(`CreatorOps OS server running on port ${env.port}`);
  });

  const shutdown = async signal => {
    console.log(`${signal} received. Shutting down server...`);
    stopPublishingWorker();
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
