'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Sidebar — CreatorOps.OS command rail.
 *
 * Nav lives here; AppShell owns layout + auth. Built on the Aceternity Sidebar
 * primitive (icon rail that expands on hover; controlled `open` state so the
 * mobile sheet shares one source of truth).
 *
 * Hierarchy is the brief's, verbatim:
 *   PLAN · CREATE · REVIEW · DISTRIBUTE · MEASURE · MARKETPLACE · SYSTEM
 *
 * Two entries the brief omits are kept but role-gated, because dropping them
 * from the nav would orphan working pages with no other route in:
 *   · Admin (ADMIN only) — /admin is otherwise unreachable
 *   · Brand Profile (BRAND_REP only) — drives AI tone; nothing else links it
 * Neither is visible to a plain content creator, so what that role sees is
 * exactly the brief's structure.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import {
  LayoutDashboard, GitBranch, Edit3, Bot, Images, ShieldCheck,
  RadioTower, Ruler, Send, BarChart3, Rss, MessagesSquare,
  BriefcaseBusiness, ClipboardList, Building2, Activity, Network,
  ServerCog, LogOut
} from 'lucide-react';

import { SidebarLink } from '../ui/sidebar';
import { AnimatedButton } from '../ui/AnimatedButton';
import { ROLES, hasRole, getRoleLabel } from '../../lib/roles';

export const NAV_GROUPS = [
  {
    label: 'Plan',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP] },
      { href: '/campaigns', label: 'Campaigns', icon: GitBranch,       roles: [ROLES.CONTENT_CREATOR] }
    ]
  },
  {
    label: 'Create',
    items: [
      { href: '/compose',   label: 'Compose',   icon: Edit3,  roles: [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP] },
      { href: '/scripting', label: 'Script AI', icon: Bot,    roles: [ROLES.CONTENT_CREATOR] },
      { href: '/media',     label: 'Media',     icon: Images, roles: [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP] }
    ]
  },
  {
    label: 'Review',
    items: [
      { href: '/review', label: 'Approvals', icon: ShieldCheck, roles: [ROLES.CONTENT_CREATOR] }
    ]
  },
  {
    label: 'Distribute',
    items: [
      { href: '/accounts',   label: 'Connections',  icon: RadioTower, roles: [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP] },
      { href: '/formats',    label: 'Format Rules', icon: Ruler,      roles: [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP] },
      { href: '/publishing', label: 'Dispatch',     icon: Send,       roles: [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP] }
    ]
  },
  {
    label: 'Measure',
    items: [
      { href: '/analytics', label: 'Analytics', icon: BarChart3,      roles: [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP] },
      { href: '/posts',     label: 'Posts',     icon: Rss,            roles: [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP] },
      { href: '/inbox',     label: 'Inbox',     icon: MessagesSquare, roles: [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP] }
    ]
  },
  {
    label: 'Marketplace',
    items: [
      { href: '/brand-circulars', label: 'Circulars',     icon: BriefcaseBusiness, roles: [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP] },
      { href: '/applications',    label: 'Applications',  icon: ClipboardList,     roles: [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP] },
      { href: '/brand-profile',   label: 'Brand Profile', icon: Building2,         roles: [ROLES.BRAND_REP] }
    ]
  },
  {
    label: 'System',
    items: [
      { href: '/activity',     label: 'Activity',     icon: Activity,  roles: [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP] },
      { href: '/architecture', label: 'Architecture', icon: Network,   roles: [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP] },
      { href: '/admin',        label: 'Admin',        icon: ServerCog, roles: [ROLES.ADMIN] }
    ]
  }
];

export function visibleGroupsFor(user) {
  return NAV_GROUPS
    .map(g => ({ ...g, items: g.items.filter(i => !i.roles || i.roles.some(r => hasRole(user, r))) }))
    .filter(g => g.items.length > 0);
}

/* ── One nav link with a glowing active state ─────────────────────────────── */

function NavRow({ item, active, expanded }) {
  const Icon = item.icon;
  return (
    <div className="relative">
      {/* Active glow — a shared layoutId slides it between links */}
      {active && (
        <motion.span
          layoutId="nav-active-glow"
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="pointer-events-none absolute inset-0 rounded-lg border border-[var(--accent-line)] bg-[var(--accent-soft)] shadow-[0_0_18px_-6px_var(--glow)]"
        />
      )}
      {/* Left rail tick — stays legible when the rail is collapsed to icons */}
      {active && (
        <span className="pointer-events-none absolute left-0 top-1/2 z-10 h-4 w-[2px] -translate-y-1/2 rounded-full bg-[var(--accent)]" />
      )}
      <SidebarLink
        link={{
          href: item.href,
          label: item.label,
          icon: (
            <Icon
              size={18}
              className={`shrink-0 transition-colors ${
                active ? 'text-[var(--accent)]' : 'text-[var(--muted)] group-hover/sidebar:text-[var(--text)]'
              }`}
            />
          )
        }}
        className={`relative z-10 rounded-lg px-2.5 py-1.5 transition-colors ${
          active
            ? 'font-semibold text-[var(--accent)]'
            : 'text-[var(--text-2)] hover:bg-[var(--surface2)]'
        }`}
      />
    </div>
  );
}

/* ── Footer: profile + sign out ───────────────────────────────────────────── */

function ProfileFooter({ user, expanded, onSignOut }) {
  /* Name comes from the authenticated session, not a constant — hardcoding a
     name would mislabel whoever is actually signed in. */
  const name = user?.name || 'Account';
  const initials =
    name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'CO';
  const profileHref = user?._id || user?.id ? `/profile/${user._id || user.id}` : '/profile/edit';

  return (
    <div className="mt-2 shrink-0 border-t border-[var(--border)] pt-3">
      <Link
        href={profileHref}
        className="focus-ring group flex items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-[var(--surface2)]"
      >
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#6344F5] to-[#AE48FF] text-[11px] font-bold text-white shadow-[0_0_16px_-6px_var(--glow)]">
          {initials}
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--surface)] bg-success" />
        </span>
        <motion.span
          animate={{ opacity: expanded ? 1 : 0 }}
          className="min-w-0 flex-1 overflow-hidden text-left"
        >
          <span className="block truncate text-xs font-semibold text-[var(--text)]">{name}</span>
          <span className="block truncate text-[10px] text-[var(--muted)]">
            {user ? getRoleLabel(user.role) : 'Signed out'}
          </span>
        </motion.span>
      </Link>

      {/* `justify-start` overrides the centred default so the icon stays put on
          the 60px collapsed rail while the label fades in and out beside it. */}
      <AnimatedButton
        variant="ghost"
        size="sm"
        onClick={onSignOut}
        className="mt-1 w-full justify-start gap-2.5 px-2.5 text-sm hover:bg-danger/10 hover:text-danger"
      >
        <LogOut size={18} className="shrink-0" />
        <motion.span animate={{ opacity: expanded ? 1 : 0 }} className="whitespace-nowrap">
          Sign out
        </motion.span>
      </AnimatedButton>
    </div>
  );
}

/* ── Public: the rail's inner content ─────────────────────────────────────── */

export default function Sidebar({ user, expanded, onSignOut }) {
  const pathname = usePathname();
  const groups = visibleGroupsFor(user);

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
        {/* Brand */}
        <Link href="/dashboard" className="mb-5 flex items-center gap-2.5 px-1.5">
          <img src="/logo.jpeg" alt="" width={26} height={26} className="shrink-0 rounded-md" />
          <motion.span
            animate={{ opacity: expanded ? 1 : 0 }}
            className="min-w-0 overflow-hidden whitespace-nowrap"
          >
            <span className="block text-sm font-bold leading-tight tracking-tight text-[var(--text)]">
              CreatorOps<span className="text-[var(--accent)]">.OS</span>
            </span>
            <span className="block text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">
              Command Center
            </span>
          </motion.span>
        </Link>

        {groups.map(group => (
          <div key={group.label} className="mb-3.5">
            <motion.p
              animate={{ opacity: expanded ? 1 : 0 }}
              className="mb-1 whitespace-nowrap px-2.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]"
            >
              {group.label}
            </motion.p>
            <div className="flex flex-col gap-0.5">
              {group.items.map(item => (
                <NavRow
                  key={item.href}
                  item={item}
                  expanded={expanded}
                  active={pathname === item.href || pathname.startsWith(item.href + '/')}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <ProfileFooter user={user} expanded={expanded} onSignOut={onSignOut} />
    </>
  );
}
