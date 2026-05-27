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
    return user ? { ...user, roles: normalizeRoles(user), role: primaryRole(user) } : null;
  } catch (_error) {
    return memoryUser ? { ...memoryUser, roles: normalizeRoles(memoryUser), role: primaryRole(memoryUser) } : null;
  }
};

export const saveSession = ({ token, user }) => {
  memoryToken = token;
  memoryUser = user ? { ...user, roles: normalizeRoles(user), role: primaryRole(user) } : user;
  const serializedUser = JSON.stringify(memoryUser);
  const storage = getStorage();
  storage?.setItem(TOKEN_KEY, token);
  storage?.setItem(USER_KEY, serializedUser);
  writeCookie(TOKEN_KEY, token);
  writeCookie(USER_KEY, serializedUser);
};

export const clearSession = () => {
  memoryToken = null;
  memoryUser = null;
  const storage = getStorage();
  storage?.removeItem(TOKEN_KEY);
  storage?.removeItem(USER_KEY);
  clearCookie(TOKEN_KEY);
  clearCookie(USER_KEY);
};
