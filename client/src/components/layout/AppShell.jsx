'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import FloatingCalendarDrawer from '../calendar/FloatingCalendarDrawer';
import { getToken, getUser, saveSession } from '../../lib/auth';
import { api } from '../../lib/api';

export default function AppShell({ children }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [user,        setUser]        = useState(null);
  const [ready,       setReady]       = useState(false);
  const [collapsed,   setCollapsed]   = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);

  // Close mobile nav on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    const token      = getToken();
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

  if (!ready && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin-slow rounded-full border-2 border-[var(--border)] border-t-mint" />
          <span className="text-sm text-[var(--muted)]">Loading CreatorOps OS…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      {/* Sidebar */}
      <Sidebar
        user={user}
        collapsed={collapsed}
        onCollapse={() => setCollapsed(c => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Page content — add bottom padding on mobile for bottom nav */}
        <main className="flex-1 overflow-x-hidden p-4 pb-20 sm:p-6 lg:pb-6">
          {children}
        </main>
      </div>

      {/* Calendar drawer (global) */}
      <FloatingCalendarDrawer />

      {/* Mobile bottom navigation */}
      <BottomNav user={user} onMenuOpen={() => setMobileOpen(true)} />
    </div>
  );
}
