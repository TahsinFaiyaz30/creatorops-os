import { Server } from 'socket.io';

import env from '../config/env.js';

let io = null;

export const initSocket = server => {
  io = new Server(server, {
    cors: {
      origin: env.clientUrl,
      credentials: true
    }
  });

  io.on('connection', socket => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('disconnect', reason => {
      console.log(`Socket disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
};

export const getIO = () => io;

export const emitWorkflowEvent = event => {
  if (!io) {
    return;
  }

  io.emit('workflow:event', {
    _id: event._id,
    workspaceId: event.workspaceId,
    actorId: event.actorId,
    eventType: event.eventType,
    message: event.message,
    entityType: event.entityType,
    entityId: event.entityId,
    metadata: event.metadata,
    createdAt: event.createdAt
  });
};
