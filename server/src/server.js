import http from 'http';

import app from './app.js';
import { connectDb, disconnectDb } from './config/db.js';
import env, { validateEnv } from './config/env.js';
import { initSocket } from './sockets/socket.js';
import { startPublishingWorker, stopPublishingWorker } from './workers/publishingWorker.js';

const startServer = async () => {
  validateEnv();
  await connectDb();

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
