import { normalizeRoles, primaryRole } from './roles';

const TOKEN_KEY = 'creatorops.token';
const USER_KEY = 'creatorops.user';

let memoryToken = null;
let memoryUser = null;

const getStorage = () => {
  if (typeof window === 'undefined') return null;
  try {
    const testKey = 'creatorops.storage.test';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch (_error) {
    return null;
  }
};

const readCookie = name => {
  if (typeof document === 'undefined') return null;
  const prefix = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie
    .split(';')
    .map(item => item.trim())
    .find(item => item.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
};

const writeCookie = (name, value) => {
  if (typeof document === 'undefined') return;
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; max-age=604800; SameSite=Lax`;
};

const clearCookie = name => {
  if (typeof document === 'undefined') return;
  document.cookie = `${encodeURIComponent(name)}=; path=/; max-age=0; SameSite=Lax`;
};

const emitSessionChange = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('creatorops:session-changed'));
};

const normalizeSessionUser = user => {
  if (!user) return null;
  const userId = user._id || user.id || user.userId || '';
  const normalized = {
    ...user,
    roles: normalizeRoles(user),
    role: primaryRole(user)
  };
  if (userId) {
    normalized.id = user.id || userId;
    normalized._id = user._id || userId;
  }
  return normalized;
};

export const getUserId = user => String(user?._id || user?.id || user?.userId || '');

export const getToken = () => {
  if (typeof window === 'undefined') return null;
  return getStorage()?.getItem(TOKEN_KEY) || readCookie(TOKEN_KEY) || memoryToken;
};

export const getUser = () => {
  if (typeof window === 'undefined') return null;
  const raw = getStorage()?.getItem(USER_KEY) || readCookie(USER_KEY);
  if (!raw) return null;

  try {
    const user = JSON.parse(raw);
    return normalizeSessionUser(user);
  } catch (_error) {
    return normalizeSessionUser(memoryUser);
  }
};

export const saveSession = ({ token, user }) => {
  memoryToken = token;
  memoryUser = normalizeSessionUser(user);
  const serializedUser = JSON.stringify(memoryUser);
  const storage = getStorage();
  storage?.setItem(TOKEN_KEY, token);
  storage?.setItem(USER_KEY, serializedUser);
  writeCookie(TOKEN_KEY, token);
  writeCookie(USER_KEY, serializedUser);
  emitSessionChange();
};

export const clearSession = () => {
  memoryToken = null;
  memoryUser = null;
  const storage = getStorage();
  storage?.removeItem(TOKEN_KEY);
  storage?.removeItem(USER_KEY);
  clearCookie(TOKEN_KEY);
  clearCookie(USER_KEY);
  emitSessionChange();
};
