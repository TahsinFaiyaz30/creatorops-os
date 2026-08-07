'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * AppShell — layout + auth. Nav is Sidebar.jsx's job.
 *
 *   · Aceternity DesktopSidebar rail: 300px expanded, 72px collapsed, toggled
 *     by an explicit button and remembered across reloads.
 *   · Our own mobile sheet (SidebarBody would inject a second hamburger and
 *     doesn't forward className, so it can't be restyled or hidden).
 *   · Sticky glass top bar: route title, role, theme toggle, notifications.
 *   · One scroll container owns page padding, so pages never set their own.
 *
 * Route titles are derived from the same NAV_GROUPS the sidebar renders, so a
 * renamed nav item can't silently disagree with the header.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Sun, Moon, Menu, X } from 'lucide-react';

import { Sidebar as SidebarProvider, DesktopSidebar } from '../ui/sidebar';
import SidebarNav, { NAV_GROUPS } from './Sidebar';
import NotificationBell from '../notifications/NotificationBell';
import FloatingCalendarDrawer from '../calendar/FloatingCalendarDrawer';
import RoleBadge from './RoleBadge';
import { useTheme } from './ThemeProvider';
import { getToken, getUser, saveSession, clearSession } from '../../lib/auth';
import { api } from '../../lib/api';

const EXTRA_TITLES = {
  '/profile/edit': 'Edit Profile',
  '/brand-circulars/create': 'New Circular'
};

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface2)] text-[var(--muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)]"
    >
      <motion.span
        key={theme}
        initial={{ opacity: 0, rotate: -60, scale: 0.7 }}
        animate={{ opacity: 1, rotate: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="flex"
      >
        {isDark ? <Sun size={15} /> : <Moon size={15} />}
      </motion.span>
    </button>
  );
}

export default function AppShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  /*
   * Desktop rail state, remembered across reloads the way every other tool does
   * it. Read lazily so the first paint already matches the stored preference
   * instead of expanding and then snapping shut.
   */
  const [railOpen, setRailOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem('creatorops.railCollapsed') !== '1';
  });

  useEffect(() => {
    try {
      window.localStorage.setItem('creatorops.railCollapsed', railOpen ? '0' : '1');
    } catch (_error) {
      /* Private mode; the rail just resets next load. */
    }
  }, [railOpen]);

  /* Only the mobile sheet closes on navigation — the desktop rail must not. */
  useEffect(() => { setNavOpen(false); }, [pathname]);

  useEffect(() => {
    const token = getToken();
    const cachedUser = getUser();
    if (!token) { setReady(true); router.replace('/login'); return; }
    if (cachedUser) setUser(cachedUser);
    api.get('/api/auth/me')
      .then(payload => {
        setUser(payload.user);
        saveSession({ token, user: payload.user });
      })
      .catch(() => router.replace('/login'))
      .finally(() => setReady(true));
  }, [router]);

  const signOut = () => {
    clearSession();
    router.replace('/login');
  };

  const title = useMemo(() => {
    const flat = NAV_GROUPS.flatMap(g => g.items);
    const exact = flat.find(i => i.href === pathname);
    if (exact) return exact.label;
    if (EXTRA_TITLES[pathname]) return EXTRA_TITLES[pathname];
    const prefix = flat
      .filter(i => pathname.startsWith(i.href + '/'))
      .sort((a, b) => b.href.length - a.href.length)[0];
    return prefix?.label ?? 'CreatorOps OS';
  }, [pathname]);

  if (!ready && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
          <span className="text-sm text-[var(--muted)]">Loading CreatorOps OS…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-[var(--bg)]">
      {/*
        The rail is toggled, never hovered. Hover-to-expand made the nav twitch
        every time the pointer crossed it on the way to the page, and it swallowed
        any popup anchored inside the rail the moment the mouse left.
        `railOpen` is the single source of truth and it persists across routes.
      */}
      <SidebarProvider open={railOpen} setOpen={() => {}}>
        {/* Desktop rail. `dark:bg-[var(--surface)]` is required alongside the
            unprefixed class: upstream sets dark:bg-neutral-800 and twMerge keeps
            a dark:-prefixed utility next to an unprefixed one, so neutral-800
            would win in dark mode. */}
        <DesktopSidebar className="sticky top-3 my-3 ml-3 h-[calc(100vh-1.5rem)] justify-between gap-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-3 py-4 shadow-[var(--shadow)] dark:bg-[var(--surface)]">
          <SidebarNav
            user={user}
            expanded={railOpen}
            onSignOut={signOut}
            onToggleRail={() => setRailOpen(value => !value)}
          />
        </DesktopSidebar>

        {/* Mobile sheet */}
        <AnimatePresence>
          {navOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setNavOpen(false)}
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                className="fixed inset-y-0 left-0 z-50 flex w-[82vw] max-w-xs flex-col justify-between border-r border-[var(--border)] bg-[var(--surface)] p-4 md:hidden"
              >
                <button
                  type="button"
                  onClick={() => setNavOpen(false)}
                  aria-label="Close navigation"
                  className="focus-ring absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"
                >
                  <X size={17} />
                </button>
                <SidebarNav user={user} expanded onSignOut={signOut} />
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </SidebarProvider>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg)]/80 px-4 backdrop-blur-md sm:px-6">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            className="focus-ring -ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)] md:hidden"
          >
            <Menu size={18} />
          </button>

          <h2 className="min-w-0 truncate text-sm font-semibold tracking-tight text-[var(--text)]">
            {title}
          </h2>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden sm:block"><RoleBadge user={user} /></span>
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>

      <FloatingCalendarDrawer />
    </div>
  );
}
