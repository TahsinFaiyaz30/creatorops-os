'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import { getToken, getUser, saveSession } from '../../lib/auth';
import { api } from '../../lib/api';

export default function AppShell({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getToken();
    const cachedUser = getUser();

    if (!token) {
      router.replace('/login');
      return;
    }

    if (cachedUser) {
      setUser(cachedUser);
    }

    api
      .get('/api/auth/me')
      .then(payload => {
        setUser(payload.user);
        saveSession({ token, user: payload.user });
      })
      .catch(() => router.replace('/login'))
      .finally(() => setReady(true));
  }, [router]);

  if (!ready && !user) {
    return <div className="flex min-h-screen items-center justify-center bg-ink text-slate-300">Loading CreatorOps OS...</div>;
  }

  return (
    <div className="min-h-screen bg-ink text-slate-100">
      <div className="flex">
        <Sidebar user={user} />
        <main className="min-h-screen flex-1 overflow-x-hidden p-6">{children}</main>
      </div>
    </div>
  );
}
