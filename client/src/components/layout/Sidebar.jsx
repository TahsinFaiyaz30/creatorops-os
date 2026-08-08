'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Sidebar — CreatorOps.OS command rail.
 *
 * Hierarchy is the brief's, verbatim:
 *   PLAN · CREATE · REVIEW · DISTRIBUTE · MEASURE · MARKETPLACE · SYSTEM
 *
 * The rail has two states and they are laid out separately rather than by
 * fading one into the other, because the collapsed rail is only 48px of content
 * and anything sized for the 300px state leaks out of it:
 *
 *   · Expanded — icon, label, active pill spanning the row.
 *   · Collapsed — one centred 40px square per item. Labels are not rendered at
 *     all (a label kept at opacity 0 still claims layout width, which is what
 *     pushed the rows into horizontal overflow and shoved every icon off
 *     centre). The name comes back as a `title` tooltip, because the old
 *     absolutely-positioned tooltip was clipped by the rail's own overflow and
 *     could never be seen.
 *
 * Section headers are hidden when collapsed. Without their label the coloured
 * dot carries no meaning, and left-aligned dots beside centred icons read as a
 * rendering fault. The gradient separator still marks the grouping.
 *
 * No entrance animation and no looping animation anywhere. Every page mounts
 * its own AppShell, so the rail remounts on each navigation — a staggered
 * entrance re-dealt the whole nav like a hand of cards on every click, and a
 * permanent shimmer/pulse/breathe loop in a fixed navigation frame reads as a
 * fault rather than as polish.
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
import { motion, useReducedMotion } from 'motion/react';
import {
  LayoutDashboard, GitBranch, Edit3, Bot, Images, ShieldCheck,
  RadioTower, Send, BarChart3, Rss, MessagesSquare,
  BriefcaseBusiness, ClipboardList, Building2, Activity,
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
      { href: '/team',      label: 'Members',   icon: Users,           roles: [ROLES.CONTENT_CREATOR] },
      /*
       * Approvals belong here, not in a section of their own further down.
       * Reviewing is what a team head does about their team's work: it sits
       * beside the project the work came from and the members who submitted
       * it, and it gates whether anything reaches Distribute at all.
       */
      { href: '/review',    label: 'Approvals', icon: ShieldCheck,     roles: [ROLES.CONTENT_CREATOR] }
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
    label: 'Distribute',
    items: [
      /* Format rules live on the Connections page now — they describe what each
         connected platform accepts, so they belong beside the connection. */
      { href: '/accounts',   label: 'Connections', icon: RadioTower, roles: [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP], permission: TEAM_PERMISSIONS.ACCOUNTS_MANAGE },
      { href: '/publishing', label: 'Post Status', icon: Send,       roles: [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP], permission: TEAM_PERMISSIONS.PUBLISH_SCHEDULE }
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
      { href: '/activity', label: 'Activity', icon: Activity,  roles: [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP] },
      { href: '/admin',    label: 'Admin',    icon: ServerCog, roles: [ROLES.ADMIN] }
    ]
  }
];

/*
 * Two filters, deliberately independent: the platform role decides what the
 * account is, the team position decides what you may do in the team you are
 * currently acting in. A Designer in someone else's team should not be looking
 * at a Connections page they cannot use.
 *
 * `/team` and `/my-work` carry no permission — they are how a member reaches
 * their own work and their own membership, so hiding them could strand someone
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

/* Shared geometry: one number so the icon square, the logo and the footer
   avatar all land on the same centre line in the collapsed rail. */
const SQUARE = 'h-10 w-10';

/* ── Section header — only meaningful when the label is readable ──────────── */

function SectionHeader({ label, accent }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <span
        className="flex h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
      />
      <span
        className="truncate text-[10px] font-bold uppercase tracking-[0.18em]"
        style={{
          background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}
      >
        {label}
      </span>
    </div>
  );
}

/* ── One nav link ─────────────────────────────────────────────────────────── */

function NavRow({ item, active, expanded }) {
  const reduce = useReducedMotion();
  const Icon = item.icon;

  return (
    <motion.div
      /* Only nudge in the expanded rail: in the collapsed rail the row is
         centred by hand, and 3px of hover travel visibly breaks that column. */
      whileHover={reduce || active || !expanded ? undefined : { x: 3 }}
      transition={{ duration: 0.18 }}
      className="relative"
    >
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        title={expanded ? undefined : item.label}
        className={`focus-ring group/navrow relative isolate flex items-center rounded-xl transition-colors ${
          expanded ? 'gap-3 px-3 py-2.5' : `mx-auto justify-center ${SQUARE}`
        }`}
      >
        {/* Active pill */}
        {active ? (
          <motion.span
            layoutId="nav-active-pill"
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="sidebar-active-pill absolute inset-0 z-0 overflow-hidden rounded-xl shadow-[0_8px_32px_-8px_var(--glow)]"
          >
            {/* Top-edge highlight — static, not a travelling sheen. */}
            <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
          </motion.span>
        ) : null}

        <span className="relative z-10 flex shrink-0 items-center justify-center">
          {active ? <span className="sidebar-icon-glow absolute inset-[-4px] rounded-lg" /> : null}
          <Icon
            size={19}
            strokeWidth={1.75}
            className={`relative transition-colors duration-200 ${
              active
                ? 'text-white'
                : 'text-[var(--muted)] group-hover/navrow:text-[var(--accent)]'
            }`}
          />
        </span>

        {/* Not rendered when collapsed — an opacity-0 label still claims width. */}
        {expanded ? (
          <span
            className={`relative z-10 min-w-0 flex-1 truncate whitespace-nowrap text-sm transition-colors ${
              active ? 'font-semibold text-white' : 'text-[var(--text-2)] group-hover/navrow:text-[var(--text)]'
            }`}
          >
            {item.label}
          </span>
        ) : null}

        {active && expanded ? (
          <span aria-hidden className="relative z-10 ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-white/90" />
        ) : null}
      </Link>
    </motion.div>
  );
}

/* ── Footer: profile + sign out ───────────────────────────────────────────── */

function ProfileFooter({ user, expanded, onSignOut }) {
  const name = user?.name || 'Account';
  const initials =
    name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'CO';
  const profileHref = user?._id || user?.id ? `/profile/${user._id || user.id}` : '/profile/edit';

  const avatar = (
    <span className={`relative flex shrink-0 items-center justify-center ${SQUARE}`}>
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#5B34E8] to-[#9333EA] text-[11px] font-bold text-white shadow-[0_8px_20px_-8px_var(--glow)]">
        {initials}
        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--surface)] bg-success" />
      </span>
    </span>
  );

  /*
   * Collapsed: two bare 40px squares on the rail's centre line. The bordered
   * card is expanded-only — its padding left 30px of content in a 46px rail,
   * so the avatar spilled out of the box it was supposed to sit inside.
   */
  if (!expanded) {
    return (
      <div className="mt-2 flex shrink-0 flex-col items-center gap-1">
        <Link
          href={profileHref}
          title={name}
          className={`focus-ring flex items-center justify-center rounded-xl transition-colors hover:bg-[var(--surface2)]/60 ${SQUARE}`}
        >
          {avatar}
        </Link>
        <button
          type="button"
          onClick={onSignOut}
          aria-label="Sign out"
          title="Sign out"
          className={`focus-ring flex items-center justify-center rounded-xl text-[var(--muted)] transition-colors hover:bg-danger/10 hover:text-danger ${SQUARE}`}
        >
          <LogOut size={18} />
        </button>
      </div>
    );
  }

  /*
   * Profile and sign-out share one row. They used to be stacked with a divider
   * between them, which cost a second row of rail height to hold a single icon.
   * The link is its own element beside the button rather than wrapping it — a
   * <button> inside an <a> is invalid, and nesting them made the whole row
   * navigate when you meant to sign out.
   */
  return (
    <div className="mt-2 shrink-0">
      <div className="flex items-center gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/40 p-1.5 backdrop-blur-md">
        <Link
          href={profileHref}
          className="focus-ring group flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1 transition-colors hover:bg-[var(--surface2)]/60"
        >
          {avatar}
          <span className="min-w-0 flex-1 overflow-hidden text-left">
            <span className="block truncate text-xs font-semibold text-[var(--text)]">{name}</span>
            <span className="block truncate text-[10px] text-[var(--muted)]">
              {user ? getRoleLabel(user.role) : 'Signed out'}
            </span>
          </span>
        </Link>

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
    </div>
  );
}

/* ── Public: the rail's inner content ─────────────────────────────────────── */

export default function Sidebar({ user, expanded, onSignOut, onToggleRail }) {
  const pathname = usePathname();
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
  /* Teams are a creator concept; a brand rep has no team to switch into. */
  const showWorkspaces = hasRole(user, ROLES.CONTENT_CREATOR);

  return (
    <>
      {/*
        Pinned header. The brand, the collapse control and the workspace
        switcher are the rail's fixed furniture — they identify where you are
        and what scope you are in, so scrolling the nav used to carry them off
        the top of the rail and leave an unlabelled strip of icons behind.
        Only the group list below this scrolls.
      */}
      <div className="shrink-0">
        {/*
          Brand and collapse control share the top row when there is width for
          it — the button on its own line above the logo cost a whole row of
          rail height to hold one 32px icon. Collapsed, they stack, because a
          46px rail cannot hold both side by side.

          The control is explicit, the way every assistant UI does it: one
          button, state persists. It replaced hover-to-expand, which made the
          rail move whenever the pointer merely passed over it. The mobile sheet
          has no rail to collapse, so it passes no handler and gets no button.
        */}
        <div className={`mb-4 flex items-center gap-2 ${expanded ? '' : 'flex-col'}`}>
          {onToggleRail && !expanded ? (
            <button
              type="button"
              onClick={onToggleRail}
              aria-label="Expand sidebar"
              aria-expanded={false}
              title="Expand sidebar"
              className="focus-ring mb-2 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface2)] hover:text-[var(--text)]"
            >
              <PanelLeftOpen size={17} />
            </button>
          ) : null}

          <Link
            href="/dashboard"
            title={expanded ? undefined : 'CreatorOps.OS'}
            className={`focus-ring flex min-w-0 items-center rounded-xl py-1 ${
              expanded ? 'flex-1 gap-2.5 px-1' : 'justify-center'
            }`}
          >
            <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface2)] ${SQUARE}`}>
              <img src="/logo.jpeg" alt="" width={26} height={26} className="rounded-lg" />
            </span>
            {expanded ? (
              <span className="min-w-0 overflow-hidden whitespace-nowrap">
                <span className="block text-sm font-bold leading-tight tracking-tight text-[var(--text)]">
                  CreatorOps<span className="text-[var(--accent)]">.OS</span>
                </span>
                <span className="block text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  Command Center
                </span>
              </span>
            ) : null}
          </Link>

          {onToggleRail && expanded ? (
            <button
              type="button"
              onClick={onToggleRail}
              aria-label="Collapse sidebar"
              aria-expanded
              title="Collapse sidebar"
              className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface2)] hover:text-[var(--text)]"
            >
              <PanelLeftClose size={17} />
            </button>
          ) : null}
        </div>

        {/* Which team every request below runs in. */}
        {showWorkspaces ? <WorkspaceSwitcher expanded={expanded} /> : null}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
      {/* `rail-scroll` hides the scrollbar: the collapsed rail has 46px of
          content width and a 10px gutter shoved every icon off centre. The
          fade at the bottom of this container is what signals more nav below
          instead. */}
      <div className="rail-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
        <div className="flex flex-col gap-0.5">
          {groups.map((group, groupIndex) => {
            const isActiveGroup = group.items.some(
              i => pathname === i.href || pathname.startsWith(i.href + '/')
            );
            const accent = GROUP_ACCENTS[group.label] || GROUP_ACCENTS.System;

            return (
              <div key={group.label}>
                {groupIndex > 0 ? (
                  <div aria-hidden className="mx-3 my-1 h-px">
                    <div
                      className="h-full w-full opacity-30"
                      style={{ background: `linear-gradient(90deg, transparent, ${accent.from}40, transparent)` }}
                    />
                  </div>
                ) : null}

                {expanded ? <SectionHeader label={group.label} accent={accent} /> : null}

                {/* Group well — glassmorphic when it holds the current page.
                    No side padding when collapsed: 40px squares inside a 46px
                    rail have nothing to spare, and 4px of it knocked the whole
                    icon column off the centre line. */}
                <div
                  aria-label={group.label}
                  className={`rounded-2xl transition-colors duration-300 ${expanded ? 'p-1' : 'px-0 py-1'} ${
                    isActiveGroup ? 'sidebar-glass-well' : ''
                  }`}
                >
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
              </div>
            );
          })}
        </div>
      </div>

        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-[var(--surface)] to-transparent"
        />
      </div>

      <ProfileFooter user={user} expanded={expanded} onSignOut={onSignOut} />
    </>
  );
}
