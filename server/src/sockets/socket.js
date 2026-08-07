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

  io.on('connection', async socket => {
    if (socket.data.user?.workspaceId) {
      socket.join(`workspace:${socket.data.user.workspaceId}`);
    }
    if (socket.data.user?.userId) {
      socket.join(`user:${socket.data.user.userId}`);
    }

    /*
     * Every team the user belongs to, not just their personal workspace.
     *
     * The token carries the account's own workspaceId, but team events are
     * emitted to workspace:<team id>. Joining only the personal room left every
     * live feed, publishing progress bar and approval ping silent inside a team
     * until the page was reloaded — the REST layer was right and the socket was
     * quietly talking to the wrong room.
     */
    for (const workspaceId of await listMemberWorkspaceIds(socket.data.user?.userId)) {
      socket.join(`workspace:${workspaceId}`);
    }

    console.log(`Socket connected: ${socket.id} workspace=${socket.data.user?.workspaceId || 'unknown'}`);

    /*
     * Project rooms. Project chat is only visible to project members, and a REST
     * layer that gets that right is undone if the socket broadcasts every message
     * to the whole workspace. Membership is re-checked here rather than trusted
     * from the client, because the room name arrives from the browser.
     */
    socket.on('project:join', async projectId => {
      const room = toRoomId(projectId);
      if (!room || !socket.data.user) return;
      const allowed = await canJoinProjectRoom({ user: socket.data.user, projectId: room });
      if (allowed) socket.join(`project:${room}`);
    });

    socket.on('project:leave', projectId => {
      const room = toRoomId(projectId);
      if (room) socket.leave(`project:${room}`);
    });

    socket.on('disconnect', reason => {
      console.log(`Socket disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
};

/*
 * Imported lazily: the models pull in services that import this module, and a
 * top-level import here would close that cycle at load time.
 */
const listMemberWorkspaceIds = async userId => {
  if (!userId) return [];
  try {
    const { default: TeamMembership } = await import('../models/TeamMembership.js');
    const memberships = await TeamMembership.find({ userId, status: 'active' }).select('workspaceId');
    return memberships.map(membership => String(membership.workspaceId));
  } catch (_error) {
    return [];
  }
};

const canJoinProjectRoom = async ({ user, projectId }) => {
  try {
    const [{ default: Campaign }, { default: TeamMembership }] = await Promise.all([
      import('../models/Campaign.js'),
      import('../models/TeamMembership.js')
    ]);

    const project = await Campaign.findById(projectId).select('workspaceId memberIds leadId createdBy visibility');
    if (!project) return false;

    const membership = await TeamMembership.findOne({
      workspaceId: project.workspaceId,
      userId: user.userId,
      status: 'active'
    }).select('_id');
    if (!membership) return false;

    if (project.visibility === 'team') return true;
    const userId = String(user.userId);
    return (
      String(project.createdBy) === userId ||
      String(project.leadId) === userId ||
      (project.memberIds || []).some(memberId => String(memberId) === userId)
    );
  } catch (_error) {
    return false;
  }
};

/** Emits only into one project's room. */
export const emitProjectEvent = (projectId, eventName, payload) => {
  if (!io) return;
  const room = toRoomId(projectId);
  if (!room) return;
  io.to(`project:${room}`).emit(eventName, payload);
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
