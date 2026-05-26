'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bot,
  BriefcaseBusiness,
  Edit3,
  GitBranch,
  LayoutDashboard,
  Menu,
  Send
} from 'lucide-react';
import { ROLES, normalizeRole } from '../../lib/roles';

// 4 key links per role for the bottom bar (5th will be Menu)
const BOTTOM_NAV = {
  [ROLES.CONTENT_CREATOR]: [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { href: '/campaigns', icon: GitBranch, label: 'Campaigns' },
    { href: '/compose', icon: Edit3, label: 'Compose' },
    { href: '/scripting', icon: Bot, label: 'Script AI' }
  ],
  [ROLES.BRAND_REP]: [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { href: '/brand-circulars', icon: BriefcaseBusiness, label: 'Circulars' },
    { href: '/compose', icon: Edit3, label: 'Compose' },
    { href: '/publishing', icon: Send, label: 'Publish' }
  ]
};

export default function BottomNav({ role, onMenuOpen }) {
  const pathname = usePathname();
  const links = BOTTOM_NAV[normalizeRole(role)] || BOTTOM_NAV[ROLES.CONTENT_CREATOR];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-stretch border-t border-[var(--border)] bg-[var(--surface)] lg:hidden">
      {links.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
              active ? 'text-mint' : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            {active && (
              <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-b-full bg-mint" />
            )}
            <Icon size={19} strokeWidth={active ? 2.2 : 1.8} />
            <span>{label}</span>
          </Link>
        );
      })}

      <button
        type="button"
        onClick={onMenuOpen}
        className="focus-ring relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-[var(--muted)] transition-colors hover:text-[var(--text)]"
      >
        <Menu size={19} strokeWidth={1.8} />
        <span>Menu</span>
      </button>
    </nav>
  );
}
