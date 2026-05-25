'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, GitBranch, LayoutDashboard, LogOut, RadioTower, Send, ShieldCheck } from 'lucide-react';
import RoleBadge from './RoleBadge';
import { clearSession } from '../../lib/auth';

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/campaigns', label: 'Campaigns', icon: GitBranch },
  { href: '/accounts', label: 'Accounts', icon: RadioTower },
  { href: '/publishing', label: 'Publishing', icon: Send },
  { href: '/approvals', label: 'Approvals', icon: ShieldCheck },
  { href: '/architecture', label: 'Architecture', icon: BarChart3 }
];

export default function Sidebar({ user }) {
  const pathname = usePathname();
  const router = useRouter();

  const logout = () => {
    clearSession();
    router.push('/login');
  };

  return (
    <aside className="flex min-h-screen w-72 flex-col border-r border-line bg-[#0f141b] p-5">
      <div className="mb-8">
        <div className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan">CreatorOps</div>
        <div className="mt-2 text-2xl font-bold text-white">OS</div>
      </div>

      <nav className="space-y-2">
        {links.map(item => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                active
                  ? 'bg-cyan/12 text-cyan ring-1 ring-cyan/25'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-lg border border-line bg-panel p-4">
        <div className="text-sm font-semibold text-white">{user?.name || 'Unknown user'}</div>
        <div className="mt-1 break-all text-xs text-slate-400">{user?.email}</div>
        <div className="mt-3">
          <RoleBadge role={user?.role} />
        </div>
        <button
          onClick={logout}
          className="focus-ring mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-slate-200 hover:bg-white/5"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </aside>
  );
}
