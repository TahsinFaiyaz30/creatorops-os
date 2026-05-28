import { io } from 'socket.io-client';
import { getToken } from './auth';

export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

let socket = null;
let listenersAttached = false;

const currentToken = () => getToken() || '';

const syncSocketAuth = () => {
  if (!socket) return;

  const token = currentToken();
  const previousToken = socket.auth?.token || '';
  socket.auth = { token };

  if (!token) {
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
