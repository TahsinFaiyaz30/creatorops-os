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
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  LayoutDashboard, GitBranch, Edit3, Bot, Images, ShieldCheck,
  RadioTower, Ruler, Send, BarChart3, Rss, MessagesSquare,
  BriefcaseBusiness, ClipboardList, Building2, Activity, Network,
  ServerCog, LogOut, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';

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

/* ── One nav link — solid pill that slides between rows ───────────────────── */

function NavRow({ item, active, expanded }) {
  const reduce = useReducedMotion();
  const Icon = item.icon;

  return (
    <motion.div whileHover={reduce || active ? undefined : { x: 2 }} transition={{ duration: 0.18 }}>
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        /* `isolate` pins a stacking context to the row so the pill's z-0 and the
           content's z-10 are compared against each other and nothing else. */
        className="focus-ring relative isolate flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
      >
        {/*
          One shared layoutId across every row, so switching routes slides the
          pill from the old item to the new one instead of cross-fading two.

          z-0 / z-10 is load-bearing, not tidiness: motion promotes a
          layout-animating element with a transform, which gives it its own
          stacking context. At z-auto the pill then painted OVER the icon and
          label mid-slide, so the row you just selected went blank.
        */}
        {active ? (
          <motion.span
            layoutId="nav-active-pill"
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="absolute inset-0 z-0 rounded-xl bg-gradient-to-r from-[#5B34E8] to-[#9333EA] shadow-[0_10px_28px_-12px_var(--glow)]"
          />
        ) : null}

        <motion.span
          className="relative z-10 flex shrink-0"
          animate={reduce ? undefined : { scale: active ? 1.08 : 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        >
          <Icon
            size={19}
            strokeWidth={1.75}
            className={`transition-colors ${
              active ? 'text-white' : 'text-[var(--muted)] group-hover/sidebar:text-[var(--text)]'
            }`}
          />
        </motion.span>

        <motion.span
          animate={{ opacity: expanded ? 1 : 0 }}
          transition={{ duration: 0.18 }}
          className={`relative z-10 min-w-0 truncate whitespace-nowrap text-sm transition-colors ${
            active ? 'font-semibold text-white' : 'text-[var(--text-2)]'
          }`}
        >
          {item.label}
        </motion.span>

        {/* Trailing dot marks the current row once the label has faded out. */}
        {active && expanded ? (
          <motion.span
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.25 }}
            className="relative z-10 ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-white/80"
          />
        ) : null}
      </Link>
    </motion.div>
  );
}

/* ── Footer: profile + sign out ───────────────────────────────────────────── */

function ProfileFooter({ user, expanded, onSignOut, pinned, onTogglePin }) {
  /* Name comes from the authenticated session, not a constant — hardcoding a
     name would mislabel whoever is actually signed in. */
  const name = user?.name || 'Account';
  const initials =
    name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'CO';
  const profileHref = user?._id || user?.id ? `/profile/${user._id || user.id}` : '/profile/edit';

  return (
    <div className="mt-2 shrink-0">
      {/*
        The old footer was three stacked full-width rows that read as three more
        nav items. It is one card now: identity on top, actions as icon buttons
        underneath, so the rail ends with a clear base rather than trailing off.
      */}
      <motion.div
        layout
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-2xl border border-[var(--border)] bg-[var(--bg)]/60 p-1.5"
      >
        <Link
          href={profileHref}
          className="focus-ring group flex items-center gap-2.5 rounded-xl p-1.5 transition-colors hover:bg-[var(--surface2)]"
        >
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#5B34E8] to-[#9333EA] text-[11px] font-bold text-white shadow-[0_8px_20px_-8px_var(--glow)]">
            {initials}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full border-2 border-[var(--surface)] bg-success">
              <span className="absolute h-full w-full animate-ping rounded-full bg-success opacity-60" />
            </span>
          </span>

          <motion.span
            animate={{ opacity: expanded ? 1 : 0 }}
            transition={{ duration: 0.18 }}
            className="min-w-0 flex-1 overflow-hidden text-left"
          >
            <span className="block truncate text-xs font-semibold text-[var(--text)]">{name}</span>
            <span className="block truncate text-[10px] text-[var(--muted)]">
              {user ? getRoleLabel(user.role) : 'Signed out'}
            </span>
          </motion.span>
        </Link>

        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-1.5 flex gap-1.5 border-t border-[var(--border)] pt-1.5">
                {/* Pin the rail open. Without this it only widens on hover, so it
                    collapsed the moment the pointer moved to the page. */}
                <AnimatedButton
                  variant="ghost"
                  size="sm"
                  onClick={onTogglePin}
                  aria-pressed={pinned}
                  title={pinned ? 'Collapse sidebar' : 'Keep sidebar expanded'}
                  className="flex-1 gap-2"
                >
                  {pinned ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
                  <span className="whitespace-nowrap text-xs">{pinned ? 'Collapse' : 'Pin open'}</span>
                </AnimatedButton>

                <AnimatedButton
                  variant="ghost"
                  size="icon"
                  onClick={onSignOut}
                  aria-label="Sign out"
                  title="Sign out"
                  className="shrink-0 hover:bg-danger/10 hover:text-danger"
                >
                  <LogOut size={16} />
                </AnimatedButton>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>

      {/* Collapsed rail keeps sign-out reachable without the label row. */}
      {!expanded ? (
        <AnimatedButton
          variant="ghost"
          size="sm"
          onClick={onSignOut}
          aria-label="Sign out"
          title="Sign out"
          className="mt-1 w-full justify-start px-2.5 hover:bg-danger/10 hover:text-danger"
        >
          <LogOut size={18} className="shrink-0" />
        </AnimatedButton>
      ) : null}
    </div>
  );
}

/* ── Public: the rail's inner content ─────────────────────────────────────── */

export default function Sidebar({ user, expanded, onSignOut, pinned, onTogglePin }) {
  const pathname = usePathname();
  const groups = visibleGroupsFor(user);

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
        {/* Brand */}
        <Link href="/dashboard" className="focus-ring mb-4 flex items-center gap-2.5 rounded-xl px-1 py-1">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface2)]">
            <img src="/logo.jpeg" alt="" width={26} height={26} className="rounded-lg" />
          </span>
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

        {groups.map((group, groupIndex) => {
          const isActiveGroup = group.items.some(
            i => pathname === i.href || pathname.startsWith(i.href + '/')
          );
          return (
            <div key={group.label}>
              {/* A hairline instead of an uppercase header. Seven stacked
                  section labels turned the rail into a wall of text; the
                  reference carries none, and grouping still reads from the
                  spacing plus the active well. */}
              {groupIndex > 0 ? (
                <div aria-hidden className="mx-3 my-1.5 h-px bg-[var(--border)]" />
              ) : null}

              {/* The section you are working in recesses into a well, so the rail
                  reads as "you are here" even collapsed to 60px of icons. */}
              <div
                aria-label={group.label}
                className={`rounded-2xl p-1.5 transition-colors ${
                  isActiveGroup ? 'bg-[var(--bg)]/60 ring-1 ring-inset ring-[var(--border)]' : ''
                }`}
              >
                <div className="flex flex-col gap-1">
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
            </div>
          );
        })}
      </div>

      <ProfileFooter
        user={user}
        expanded={expanded}
        onSignOut={onSignOut}
        pinned={pinned}
        onTogglePin={onTogglePin}
      />
    </>
  );
}
