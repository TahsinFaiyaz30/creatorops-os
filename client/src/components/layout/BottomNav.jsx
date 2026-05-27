'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BriefcaseBusiness,
  Edit3,
  GitBranch,
  LayoutDashboard,
  Menu,
  RadioTower,
  ServerCog
} from 'lucide-react';
import { ROLES, hasRole } from '../../lib/roles';

const addUnique = (links, next) => {
  if (!links.some(link => link.href === next.href)) links.push(next);
};

const linksForUser = user => {
  const links = [];
  const hasCreator = hasRole(user, ROLES.CONTENT_CREATOR);
  const hasBrand = hasRole(user, ROLES.BRAND_REP);
  const hasAdmin = hasRole(user, ROLES.ADMIN);

  if (hasCreator || hasBrand) addUnique(links, { href: '/dashboard', icon: LayoutDashboard, label: 'Home' });
  if (hasCreator) addUnique(links, { href: '/campaigns', icon: GitBranch, label: 'Campaigns' });
  if (hasCreator || hasBrand) addUnique(links, { href: '/compose', icon: Edit3, label: 'Compose' });
  if (hasAdmin) addUnique(links, { href: '/admin', icon: ServerCog, label: 'Admin' });
  if (hasBrand) addUnique(links, { href: '/accounts', icon: RadioTower, label: 'Accounts' });
  if (hasBrand && !hasCreator) addUnique(links, { href: '/brand-circulars', icon: BriefcaseBusiness, label: 'Circulars' });

  return links.slice(0, 4);
};

export default function BottomNav({ user, onMenuOpen }) {
  const pathname = usePathname();
  const links = linksForUser(user);

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
