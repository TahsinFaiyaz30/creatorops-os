'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { applyTheme, resolveTheme, saveTheme } from '../../lib/theme';

const ThemeContext = createContext({ theme: 'dark', toggle: () => {}, setTheme: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

export default function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('dark');

  // On mount: apply saved/system theme
  useEffect(() => {
    const resolved = resolveTheme();
    setThemeState(resolved);
    applyTheme(resolved);

    // Listen for OS theme changes when user has no saved preference
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const saved = localStorage.getItem('creatorops.theme');
      if (!saved) {
        const sys = mq.matches ? 'dark' : 'light';
        setThemeState(sys);
        applyTheme(sys);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const setTheme = t => {
    setThemeState(t);
    applyTheme(t);
    saveTheme(t);
  };

  const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
