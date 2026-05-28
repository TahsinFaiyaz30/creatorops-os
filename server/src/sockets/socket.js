import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

import env from '../config/env.js';
import User from '../models/User.js';
import { normalizeRoles, primaryRole } from '../constants/roles.js';

let io = null;

const toRoomId = value => {
  if (!value) return '';
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
};

const getSocketToken = socket => {
  const authToken = socket.handshake.auth?.token || socket.handshake.query?.token || '';
  if (authToken) return String(authToken);

  const authHeader = socket.handshake.headers?.authorization || '';
  const [scheme, token] = String(authHeader).split(' ');
  return scheme === 'Bearer' && token ? token : '';
};

const getPayloadWorkspaceId = payload =>
  toRoomId(payload?.workspaceId || payload?.uploadSession?.workspaceId || payload?.data?.workspaceId || payload?.metadata?.workspaceId);

const getPayloadUserId = payload =>
  toRoomId(payload?.userId || payload?.uploadedBy || payload?.uploadSession?.uploadedBy || payload?.data?.userId || payload?.metadata?.userId);

export const initSocket = server => {
  io = new Server(server, {
    cors: {
      origin: env.clientUrls,
      credentials: true
    }
  });

  io.use(async (socket, next) => {
    try {
      const token = getSocketToken(socket);
      if (!token) return next(new Error('Authentication token is required.'));

      const payload = jwt.verify(token, env.jwtSecret);
      const user = await User.findById(payload.sub).select('_id workspaceId role roles');
      if (!user) return next(new Error('Authentication token is invalid.'));

      const roles = normalizeRoles(user.roles, user.role);
      socket.data.user = {
        userId: String(user._id),
        workspaceId: String(user.workspaceId),
        role: primaryRole(roles),
        roles
      };
      return next();
    } catch (_error) {
      return next(new Error('Authentication token is invalid or expired.'));
    }
  });

  io.on('connection', socket => {
    if (socket.data.user?.workspaceId) {
      socket.join(`workspace:${socket.data.user.workspaceId}`);
    }
    if (socket.data.user?.userId) {
      socket.join(`user:${socket.data.user.userId}`);
    }
    console.log(`Socket connected: ${socket.id} workspace=${socket.data.user?.workspaceId || 'unknown'}`);

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

  const payload = {
    _id: event._id,
    workspaceId: event.workspaceId,
    actorId: event.actorId,
    eventType: event.eventType,
    message: event.message,
    entityType: event.entityType,
    entityId: event.entityId,
    metadata: event.metadata,
    createdAt: event.createdAt
  };
  const workspaceId = getPayloadWorkspaceId(payload);
  if (workspaceId) {
    io.to(`workspace:${workspaceId}`).emit('workflow:event', payload);
    return;
  }
  io.emit('workflow:event', payload);
};

export const emitRealtimeEvent = (eventName, payload) => {
  if (!io) {
    return;
  }

  const userId = getPayloadUserId(payload);
  if (userId) {
    io.to(`user:${userId}`).emit(eventName, payload);
    return;
  }

  const workspaceId = getPayloadWorkspaceId(payload);
  if (workspaceId) {
    io.to(`workspace:${workspaceId}`).emit(eventName, payload);
    return;
  }

  io.emit(eventName, payload);
};
