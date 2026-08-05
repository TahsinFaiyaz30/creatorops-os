import { io } from 'socket.io-client';
import { getToken } from './auth';
import { resolveServiceUrl } from './api';

/*
 * Realtime is opt-in on a hosted deployment.
 *
 * Socket.IO needs a long-lived connection straight to the Express server — it
 * cannot ride the /api rewrite proxy, and it cannot run on a serverless host at
 * all. The old default pointed at http://localhost:5000 from every build, so a
 * deployed page retried a connection to the visitor's own machine forever.
 *
 * With no NEXT_PUBLIC_SOCKET_URL configured off localhost we simply never dial.
 * Every screen that uses realtime already falls back to interval polling when
 * the socket is not connected, so the app stays fully functional without it.
 */
export const SOCKET_URL = resolveServiceUrl(
  process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL
);

export const realtimeEnabled = SOCKET_URL !== '';

let socket = null;
let listenersAttached = false;

const currentToken = () => getToken() || '';

const syncSocketAuth = () => {
  if (!socket) return;

  const token = currentToken();
  const previousToken = socket.auth?.token || '';
  socket.auth = { token };

  if (!token || !realtimeEnabled) {
    if (socket.connected) socket.disconnect();
    return;
  }

  if (socket.connected && previousToken !== token) {
    socket.disconnect();
  }

  if (!socket.connected) {
    socket.connect();
  }
};

const attachSessionListeners = () => {
  if (listenersAttached || typeof window === 'undefined') return;
  listenersAttached = true;
  window.addEventListener('storage', event => {
    if (event.key === 'creatorops.token') syncSocketAuth();
  });
  window.addEventListener('creatorops:session-changed', syncSocketAuth);
};

export const getSocket = () => {
  if (!socket) {
    /* Still constructed when realtime is off: callers attach .on/.off handlers
       unconditionally, and those are inert on a socket that never connects. */
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: false,
      auth: { token: currentToken() }
    });
    attachSessionListeners();
  }

  syncSocketAuth();
  return socket;
};

export const disconnectSocket = () => {
  if (socket?.connected) socket.disconnect();
};
