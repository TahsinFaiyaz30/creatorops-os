'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Sidebar — CreatorOps.OS command rail (redesigned).
 *
 * Premium glassmorphic sidebar with:
 *   · Visible gradient section headers (PLAN · CREATE · REVIEW …)
 *   · Dynamic animated page icons with staggered entrance
 *   · Glowing active pill with shifting gradient + shimmer
 *   · Glassmorphic active-group wells
 *   · Animated profile footer with rotating avatar ring
 *   · Breathing logo glow
 *   · Collapsed-state icon glow feedback
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

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  LayoutDashboard, GitBranch, Edit3, Bot, Images, ShieldCheck,
  RadioTower, Ruler, Send, BarChart3, Rss, MessagesSquare,
  BriefcaseBusiness, ClipboardList, Building2, Activity, Network,
  ServerCog, LogOut, PanelLeftClose, PanelLeftOpen, Users, ListTodo
} from 'lucide-react';

import { AnimatedButton } from '../ui/AnimatedButton';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import { ROLES, hasRole, getRoleLabel } from '../../lib/roles';
import { TEAM_PERMISSIONS, canInTeam, getActiveTeam, onWorkspaceChange } from '../../lib/teams';

/* ── Group accent colours — each section gets a unique gradient tint ──────── */
const GROUP_ACCENTS = {
  Plan:        { from: '#818CF8', to: '#6366F1' },
  Create:      { from: '#F472B6', to: '#EC4899' },
  Review:      { from: '#34D399', to: '#10B981' },
  Distribute:  { from: '#38BDF8', to: '#0EA5E9' },
  Measure:     { from: '#FBBF24', to: '#F59E0B' },
  Marketplace: { from: '#C084FC', to: '#A855F7' },
  System:      { from: '#94A3B8', to: '#64748B' }
};

export const NAV_GROUPS = [
  {
    label: 'Plan',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP] },
      { href: '/campaigns', label: 'Projects',  icon: GitBranch,       roles: [ROLES.CONTENT_CREATOR] },
      { href: '/my-work',   label: 'My Work',   icon: ListTodo,        roles: [ROLES.CONTENT_CREATOR] },
      /* Always the team you are currently in — the switcher above is the list. */
      { href: '/team',      label: 'Members',   icon: Users,           roles: [ROLES.CONTENT_CREATOR] }
    ]
  },
  {
    label: 'Create',
    items: [
      { href: '/compose',   label: 'Compose',   icon: Edit3,  roles: [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP], permission: TEAM_PERMISSIONS.VARIANT_GENERATE },
      { href: '/scripting', label: 'Script AI', icon: Bot,    roles: [ROLES.CONTENT_CREATOR], permission: TEAM_PERMISSIONS.SCRIPT_USE },
      { href: '/media',     label: 'Media',     icon: Images, roles: [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP], permission: TEAM_PERMISSIONS.MEDIA_UPLOAD }
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
      { href: '/accounts',   label: 'Connections',  icon: RadioTower, roles: [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP], permission: TEAM_PERMISSIONS.ACCOUNTS_MANAGE },
      { href: '/formats',    label: 'Format Rules', icon: Ruler,      roles: [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP] },
      { href: '/publishing', label: 'Dispatch',     icon: Send,       roles: [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP], permission: TEAM_PERMISSIONS.PUBLISH_SCHEDULE }
    ]
  },
  {
    label: 'Measure',
    items: [
      { href: '/analytics', label: 'Analytics', icon: BarChart3,      roles: [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP], permission: TEAM_PERMISSIONS.ANALYTICS_VIEW },
      { href: '/posts',     label: 'Posts',     icon: Rss,            roles: [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP], permission: TEAM_PERMISSIONS.ANALYTICS_VIEW },
      { href: '/inbox',     label: 'Inbox',     icon: MessagesSquare, roles: [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP], permission: TEAM_PERMISSIONS.INBOX_REPLY }
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

/*
 * Two filters, deliberately independent: the platform role decides what the
 * account is, the team position decides what you may do in the team you are
 * currently acting in. A Designer in someone else's team should not be looking
 * at a Connections page they cannot use.
 *
 * `/teams` and `/my-work` carry no permission — they are how a member reaches
 * their own work and their own memberships, so hiding them could strand someone
 * with no route back.
 */
export function visibleGroupsFor(user, team = null) {
  return NAV_GROUPS
    .map(g => ({
      ...g,
      items: g.items.filter(
        i => (!i.roles || i.roles.some(r => hasRole(user, r))) && (!i.permission || canInTeam(team, i.permission))
      )
    }))
    .filter(g => g.items.length > 0);
}

/* ── Stagger variants for group entrance ─────────────────────────────────── */
const groupContainerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 }
  }
};

const groupItemVariants = {
  hidden: { opacity: 0, x: -8, scale: 0.95 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 380, damping: 26, mass: 0.8 }
  }
};

/* ── Section header — visible gradient label ─────────────────────────────── */

function SectionHeader({ label, expanded, accent }) {
  const reduce = useReducedMotion();

  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      {/* Accent dot — always visible, acts as section marker when collapsed */}
      <motion.span
        layout
        className="flex h-1.5 w-1.5 shrink-0 rounded-full"
        style={{
          background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`
        }}
        animate={reduce ? undefined : { scale: [1, 1.3, 1] }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
      />

      {/* Label — fades in when expanded */}
      <motion.span
        animate={{ opacity: expanded ? 1 : 0, width: expanded ? 'auto' : 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="overflow-hidden whitespace-nowrap"
      >
        <span
          className="text-[10px] font-bold uppercase tracking-[0.18em]"
          style={{
            background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}
        >
          {label}
        </span>
      </motion.span>
    </div>
  );
}

/* ── One nav link — with dynamic icon animation ──────────────────────────── */

function NavRow({ item, active, expanded, index }) {
  const reduce = useReducedMotion();
  const Icon = item.icon;

  return (
    <motion.div
      variants={groupItemVariants}
      whileHover={reduce || active ? undefined : { x: 3 }}
      transition={{ duration: 0.18 }}
      className="relative"
    >
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className="focus-ring group/navrow relative isolate flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
      >
        {/* Active pill — glowing gradient with shimmer */}
        {active ? (
          <motion.span
            layoutId="nav-active-pill"
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="absolute inset-0 z-0 overflow-hidden rounded-xl sidebar-active-pill shadow-[0_8px_32px_-8px_var(--glow)]"
          >
            {/* Top-edge shimmer highlight */}
            <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
            {/* Moving sheen */}
            {!reduce && (
              <motion.span
                className="absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                initial={{ x: '-60%' }}
                animate={{ x: '360%' }}
                transition={{
                  duration: 2.8,
                  ease: 'easeInOut',
                  repeat: Infinity,
                  repeatDelay: 2
                }}
              />
            )}
          </motion.span>
        ) : null}

        {/* Icon container with glow ring on active */}
        <motion.span
          className="relative z-10 flex shrink-0 items-center justify-center"
          animate={reduce ? undefined : {
            scale: active ? 1.15 : 1,
          }}
          whileHover={reduce || active ? undefined : { scale: 1.12 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        >
          {/* Glow ring behind active icon */}
          {active && !reduce ? (
            <span className="absolute inset-[-4px] sidebar-icon-glow rounded-lg" />
          ) : null}
          <Icon
            size={19}
            strokeWidth={1.75}
            className={`relative transition-colors duration-200 ${
              active
                ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]'
                : 'text-[var(--muted)] group-hover/navrow:text-[var(--accent)]'
            }`}
          />
        </motion.span>

        {/* Label — slides in with spring */}
        <motion.span
          animate={{
            opacity: expanded ? 1 : 0,
            x: expanded ? 0 : -4
          }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className={`relative z-10 min-w-0 truncate whitespace-nowrap text-sm transition-colors ${
            active ? 'font-semibold text-white' : 'text-[var(--text-2)] group-hover/navrow:text-[var(--text)]'
          }`}
        >
          {item.label}
        </motion.span>

        {/* Trailing active dot — pulses */}
        {active && expanded ? (
          <motion.span
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.25 }}
            className="relative z-10 ml-auto flex h-2 w-2 shrink-0"
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white/90" />
          </motion.span>
        ) : null}

        {/* Collapsed hover tooltip peek */}
        {!expanded && !active ? (
          <span className="pointer-events-none absolute left-full z-50 ml-2 hidden rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-2.5 py-1.5 text-xs font-medium text-[var(--text)] shadow-lg group-hover/navrow:block">
            {item.label}
          </span>
        ) : null}
      </Link>

      {/* Collapsed active indicator — subtle glow dot on the left edge */}
      {active && !expanded ? (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -left-1 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-gradient-to-b from-[#5B34E8] to-[#9333EA] shadow-[0_0_10px_2px_var(--glow)]"
        />
      ) : null}
    </motion.div>
  );
}

/* ── Footer: profile + sign out ───────────────────────────────────────────── */

function ProfileFooter({ user, expanded, onSignOut, pinned, onTogglePin }) {
  const reduce = useReducedMotion();
  const name = user?.name || 'Account';
  const initials =
    name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'CO';
  const profileHref = user?._id || user?.id ? `/profile/${user._id || user.id}` : '/profile/edit';

  return (
    <div className="mt-2 shrink-0">
      <motion.div
        layout
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/40 p-1.5 backdrop-blur-md"
      >
        <Link
          href={profileHref}
          className="focus-ring group flex items-center gap-2.5 rounded-xl p-1.5 transition-colors hover:bg-[var(--surface2)]/60"
        >
          {/* Avatar with animated gradient ring */}
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
            {/* Rotating gradient ring */}
            {!reduce && (
              <span className="absolute inset-[-2px] rounded-[14px] sidebar-avatar-ring" />
            )}
            <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#5B34E8] to-[#9333EA] text-[11px] font-bold text-white shadow-[0_8px_20px_-8px_var(--glow)]">
              {initials}
              {/* Online status dot */}
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full border-2 border-[var(--surface)] bg-success">
                <span className="absolute h-full w-full animate-ping rounded-full bg-success opacity-60" />
              </span>
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
  const reduce = useReducedMotion();
  /*
   * The cached active team drives nav gating on first paint; canInTeam treats an
   * unknown team as "allow", so a slow first load never blacks out the rail.
   */
  const [activeTeam, setActiveTeam] = useState(null);

  useEffect(() => {
    setActiveTeam(getActiveTeam());
    return onWorkspaceChange(() => setActiveTeam(getActiveTeam()));
  }, []);

  const groups = visibleGroupsFor(user, activeTeam);

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
        {/* Brand — with breathing glow */}
        <Link href="/dashboard" className="focus-ring mb-5 flex items-center gap-2.5 rounded-xl px-1 py-1">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface2)] ${!reduce ? 'sidebar-logo-breathe' : ''}`}>
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

        {/* Which team every request below runs in. */}
        <WorkspaceSwitcher expanded={expanded} />

        {/* Navigation groups with staggered entrance */}
        <motion.div
          variants={groupContainerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-0.5"
        >
          {groups.map((group, groupIndex) => {
            const isActiveGroup = group.items.some(
              i => pathname === i.href || pathname.startsWith(i.href + '/')
            );
            const accent = GROUP_ACCENTS[group.label] || GROUP_ACCENTS.System;

            return (
              <motion.div
                key={group.label}
                variants={groupItemVariants}
              >
                {/* Separator between groups — subtle gradient line */}
                {groupIndex > 0 ? (
                  <div aria-hidden className="mx-3 my-1 h-px">
                    <div
                      className="h-full w-full opacity-30"
                      style={{
                        background: `linear-gradient(90deg, transparent, ${accent.from}40, transparent)`
                      }}
                    />
                  </div>
                ) : null}

                {/* Section header — gradient label */}
                <SectionHeader label={group.label} expanded={expanded} accent={accent} />

                {/* Group well — glassmorphic when active */}
                <div
                  aria-label={group.label}
                  className={`rounded-2xl p-1 transition-all duration-300 ${
                    isActiveGroup
                      ? 'sidebar-glass-well'
                      : ''
                  }`}
                >
                  <motion.div
                    variants={groupContainerVariants}
                    initial="hidden"
                    animate="visible"
                    className="flex flex-col gap-0.5"
                  >
                    {group.items.map((item, itemIndex) => (
                      <NavRow
                        key={item.href}
                        item={item}
                        expanded={expanded}
                        active={pathname === item.href || pathname.startsWith(item.href + '/')}
                        index={itemIndex}
                      />
                    ))}
                  </motion.div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
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
