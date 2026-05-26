// ── Theme helpers ─────────────────────────────────────────────────────────────
const STORAGE_KEY = 'creatorops.theme';

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
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* */ }
};

export const applyTheme = theme => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
};

export const resolveTheme = () => getSavedTheme() || getSystemTheme();
