// ── Theme helpers ─────────────────────────────────────────────────────────────
const STORAGE_KEY = 'creatorops.theme';
const THEMES = new Set(['dark', 'light']);

const normalizeTheme = theme => (THEMES.has(theme) ? theme : 'dark');

export const getSystemTheme = () => {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const getSavedTheme = () => {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(STORAGE_KEY) || null; } catch { return null; }
};

export const saveTheme = theme => {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, normalizeTheme(theme)); } catch { /* */ }
};

export const applyTheme = theme => {
  if (typeof document === 'undefined') return;
  const nextTheme = normalizeTheme(theme);
  const root = document.documentElement;
  root.classList.toggle('dark', nextTheme === 'dark');
  root.classList.toggle('light', nextTheme === 'light');
  root.dataset.theme = nextTheme;
  root.style.colorScheme = nextTheme;
};

export const resolveTheme = () => normalizeTheme(getSavedTheme() || getSystemTheme());
