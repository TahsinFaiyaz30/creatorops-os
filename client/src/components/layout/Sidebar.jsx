'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3, Bot, BriefcaseBusiness, ChevronLeft, ChevronRight,
  ClipboardList, Edit3, GitBranch, LayoutDashboard,
  LogOut, RadioTower, Send, ShieldCheck, UserCircle, X
} from 'lucide-react';
import { useTheme } from './ThemeProvider';
import RoleBadge from './RoleBadge';
import SiteLogo from './SiteLogo';
import NotificationBell from '../notifications/NotificationBell';
import { clearSession } from '../../lib/auth';
import { ROLES, normalizeRole } from '../../lib/roles';

// ── Nav groups by role ────────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP] },
    ],
  },
  {
    label: 'Content',
    items: [
      { href: '/campaigns',  label: 'Campaigns',  icon: GitBranch, roles: [ROLES.CONTENT_CREATOR] },
      { href: '/compose',    label: 'Compose',    icon: Edit3,     roles: [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP] },
      { href: '/scripting',  label: 'Script AI',  icon: Bot,       roles: [ROLES.CONTENT_CREATOR] },
    ],
  },
  {
    label: 'Review & Publish',
    items: [
      { href: '/approvals',  label: 'Approvals',  icon: ShieldCheck, roles: [ROLES.CONTENT_CREATOR] },
      { href: '/accounts',   label: 'Accounts',   icon: RadioTower,  roles: [ROLES.CONTENT_CREATOR] },
      { href: '/publishing', label: 'Publishing',  icon: Send,        roles: [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP] },
      { href: '/analytics',  label: 'Analytics',  icon: BarChart3,   roles: [ROLES.CONTENT_CREATOR] },
    ],
  },
  {
    label: 'Creator Economy',
    items: [
      { href: '/brand-circulars', label: 'Brand Circulars', icon: BriefcaseBusiness, roles: [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP] },
      { href: '/applications',    label: 'Applications',    icon: ClipboardList,     roles: [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP] },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/architecture', label: 'Architecture',  icon: BarChart3, roles: [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP] },
    ],
  },
];

export default function Sidebar({ user, collapsed, onCollapse, mobileOpen, onMobileClose }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { theme, toggle } = useTheme();
  const role = normalizeRole(user?.role);

  const logout = () => { clearSession(); router.push('/login'); };

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '??';

  // Filter groups/items for this role
  const visibleGroups = NAV_GROUPS.map(g => ({
    ...g,
    items: g.items.filter(item => item.roles.includes(role)),
  })).filter(g => g.items.length > 0);

  const NavItem = ({ href, label, icon: Icon }) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        href={href}
        onClick={onMobileClose}
        title={collapsed ? label : undefined}
        className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all
          ${active
            ? 'nav-active'
            : 'text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--text)]'
          }
          ${collapsed ? 'justify-center px-2' : ''}
        `}
      >
        <Icon size={18} strokeWidth={active ? 2.2 : 1.8} className="shrink-0" />
        {!collapsed && <span className="truncate">{label}</span>}
        {/* Tooltip when collapsed */}
        {collapsed && (
          <span className="pointer-events-none absolute left-full ml-2 hidden rounded-md bg-[#05130d] px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg group-hover:block dark:bg-slate-800 z-50">
            {label}
          </span>
        )}
      </Link>
    );
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo + collapse toggle */}
      <div className={`flex h-14 shrink-0 items-center border-b border-[var(--border)] px-3 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <SiteLogo />
        )}
        {collapsed && (
          <SiteLogo compact />
        )}
        <div className="flex items-center gap-1">
          {/* Mobile close */}
          {mobileOpen && (
            <button
              type="button"
              onClick={onMobileClose}
              className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--border)] hover:text-[var(--text)] lg:hidden"
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
          )}
          {/* Desktop collapse */}
          <button
            type="button"
            onClick={onCollapse}
            className="focus-ring hidden h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--border)] hover:text-[var(--text)] lg:flex"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {visibleGroups.map((group, gi) => (
          <div key={gi} className={gi > 0 ? 'mt-4' : ''}>
            {!collapsed && (
              <div className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                {group.label}
              </div>
            )}
            {collapsed && gi > 0 && <div className="my-3 mx-3 h-px bg-[var(--border)]" />}
            <div className="space-y-0.5">
              {group.items.map(item => (
                <NavItem key={item.href} {...item} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User section */}
      <div className={`shrink-0 border-t border-[var(--border)] p-3 flex flex-col gap-3 ${collapsed ? 'items-center' : ''}`}>
        {!collapsed && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-3 py-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-mint to-blue-500 text-xs font-bold text-[#05130d]">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-[var(--text)]">{user?.name || 'Unknown'}</div>
                <div className="truncate text-xs text-[var(--muted)]">{user?.email}</div>
              </div>
            </div>
            <RoleBadge role={role} />
          </div>
        )}
        
        <div className={`flex gap-2 ${collapsed ? 'flex-col items-center' : 'items-center'}`}>
          <NotificationBell compact={collapsed} />
          
          <button
            id="sidebar-theme-toggle"
            type="button"
            onClick={toggle}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--border)] hover:text-[var(--text)]"
          >
            {theme === 'dark'
              ? <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
              : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
            }
          </button>

          <Link
            href="/profile/me"
            title="My Profile"
            className={`focus-ring flex items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] transition hover:bg-mint/10 hover:text-mint hover:border-mint/20 ${collapsed ? 'h-9 w-9' : 'flex-1 py-2 gap-2 text-sm'}`}
          >
            <UserCircle size={15} /> {!collapsed && 'Profile'}
          </Link>

          <button
            id="sidebar-logout"
            type="button"
            onClick={logout}
            title="Logout"
            className={`focus-ring flex items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] transition hover:bg-rose/10 hover:text-rose hover:border-rose/20 ${collapsed ? 'h-9 w-9' : 'flex-1 py-2 gap-2 text-sm'}`}
          >
            <LogOut size={15} /> {!collapsed && 'Logout'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────────────────── */}
      <aside
        className={`sidebar-transition hidden lg:flex flex-col shrink-0 border-r border-[var(--border)] bg-[var(--surface)] ${
          collapsed ? 'w-[60px]' : 'w-64'
        }`}
        style={{ height: '100vh', position: 'sticky', top: 0 }}
      >
        {sidebarContent}
      </aside>

      {/* ── Mobile overlay ───────────────────────────────────────────────────── */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <aside className="fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r border-[var(--border)] bg-[var(--surface)] animate-slide-in-left lg:hidden">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
