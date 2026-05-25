'use client';

import { useEffect, useState } from 'react';
import AppShell from '../../components/layout/AppShell';
import ApprovalQueue from '../../components/approvals/ApprovalQueue';
import LiveEventFeed from '../../components/events/LiveEventFeed';
import { getUser } from '../../lib/auth';

export default function ApprovalsPage() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  return (
    <AppShell>
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div>
          <header className="mb-4 rounded-lg border border-line bg-panel p-5">
            <p className="text-sm uppercase tracking-[0.18em] text-cyan">Review queue</p>
            <h1 className="mt-2 text-3xl font-bold text-white">Approvals</h1>
            <p className="mt-2 text-sm text-slate-400">Creator/Admin decisions are enforced by backend RBAC.</p>
          </header>
          <ApprovalQueue user={user} />
        </div>
        <LiveEventFeed compact />
      </div>
    </AppShell>
  );
}
