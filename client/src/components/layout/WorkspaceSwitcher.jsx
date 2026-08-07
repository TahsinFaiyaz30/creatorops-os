'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Workspace switcher.
 *
 * A team is a workspace, so switching teams is switching the scope every request
 * runs in. Selecting one writes the active id to storage; `api` attaches it as
 * X-Workspace-Id on every call from that point on.
 *
 * Two layout facts drive the structure here, and getting either wrong makes the
 * control silently dead:
 *
 *   · The rail collapses to an icon strip, so the trigger has to work in both
 *     states. An early `return` for the collapsed case leaves the popup
 *     unrendered and the button does nothing at all.
 *   · The rail scrolls with `overflow-x-hidden`, and its ancestors carry
 *     backdrop filters. The list is therefore measured from the trigger and
 *     portalled to <body>, so neither the clipping nor the filter can reach it.
 *
 * The page is reloaded on switch rather than re-fetched in place: half the app's
 * screens hold data loaded under the previous workspace, and a soft switch would
 * leave one team's projects sitting next to another team's media until each page
 * happened to refetch.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Popover from '../ui/Popover';
import { Check, ChevronsUpDown, Plus, Users, User as UserIcon } from 'lucide-react';

import { api } from '../../lib/api';
import { getActiveTeam, getActiveWorkspaceId, setActiveWorkspace } from '../../lib/teams';

const EASE = [0.16, 1, 0.3, 1];
const MENU_WIDTH = 248;

export default function WorkspaceSwitcher({ expanded = true }) {
  const [teams, setTeams] = useState(null);
  const [active, setActive] = useState(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    /* Cached row first so the rail is not blank while /api/teams is in flight. */
    setActive(getActiveTeam());

    api
      .get('/api/teams')
      .then(payload => {
        const list = payload.data.teams || [];
        setTeams(list);

        const activeId = getActiveWorkspaceId();
        const current = activeId ? list.find(team => String(team._id) === activeId) : list.find(team => team.isPersonal);

        /*
         * The stored team is gone — removed from it, or it was deleted. Fall back
         * to the personal workspace instead of leaving every request 403ing.
         */
        if (activeId && !current) {
          setActiveWorkspace(null);
          window.location.reload();
          return;
        }
        setActive(current || null);
      })
      .catch(() => setTeams([]));
  }, []);

  /* Measured rather than CSS-positioned, so the rail's clipping cannot reach it. */
  const placeMenu = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.min(rect.left, window.innerWidth - MENU_WIDTH - 12);
    setAnchor({ top: rect.bottom + 6, left: Math.max(12, left) });
  }, []);

  useLayoutEffect(() => {
    if (!open) return undefined;
    placeMenu();
    window.addEventListener('resize', placeMenu);
    window.addEventListener('scroll', placeMenu, true);
    return () => {
      window.removeEventListener('resize', placeMenu);
      window.removeEventListener('scroll', placeMenu, true);
    };
  }, [open, placeMenu]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = event => {
      if (triggerRef.current?.contains(event.target)) return;
      if (menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onKey = event => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const switchTo = team => {
    if (String(team._id) === String(active?._id)) {
      setOpen(false);
      return;
    }
    setActiveWorkspace(team);
    window.location.reload();
  };

  const isTeam = active?.isPersonal === false;
  const label = isTeam ? active.name : 'Personal';
  const Icon = isTeam ? Users : UserIcon;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Workspace: ${label}`}
        title={expanded ? undefined : label}
        className={
          expanded
            ? 'focus-ring mb-3 flex w-full items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface2)]/70 px-2.5 py-2 text-left transition-colors hover:border-[var(--border-strong)]'
            /* 40px square, same as every collapsed nav row — the rail is one
               centre line and a 36px trigger visibly broke it. */
            : 'focus-ring mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface2)] text-[var(--text-2)] transition-colors hover:border-[var(--accent-line)] hover:text-[var(--accent)]'
        }
      >
        {expanded ? (
          <>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold text-[var(--text)]">{label}</span>
              <span className="block truncate text-[10px] text-[var(--muted)]">
                {isTeam
                  ? `${active.role?.name || 'Member'} · ${active.memberCount} member${active.memberCount === 1 ? '' : 's'}`
                  : 'Your own workspace'}
              </span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
          </>
        ) : (
          <Icon className="h-[18px] w-[18px]" />
        )}
      </button>

      {/* Rendered in both rail states — see the note at the top of this file. */}
      <Popover>
      <AnimatePresence>
        {open && anchor ? (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: EASE }}
            role="listbox"
            style={{ position: 'fixed', top: anchor.top, left: anchor.left, width: MENU_WIDTH }}
            className="z-[100] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]"
          >
            <p className="border-b border-[var(--border)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Switch workspace
            </p>

            <div className="max-h-64 overflow-y-auto p-1">
              {(teams || []).map(team => {
                const isActive = String(team._id) === String(active?._id);
                return (
                  <button
                    key={team._id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => switchTo(team)}
                    className={`focus-ring flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                      isActive ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--surface2)]'
                    }`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--surface2)] text-[var(--muted)]">
                      {team.isPersonal ? <UserIcon className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-xs font-semibold ${
                          isActive ? 'text-[var(--accent)]' : 'text-[var(--text)]'
                        }`}
                      >
                        {team.isPersonal ? 'Personal' : team.name}
                      </span>
                      <span className="block truncate text-[10px] text-[var(--muted)]">
                        {team.isPersonal ? 'Your own workspace' : team.role?.name || 'Member'}
                      </span>
                    </span>
                    {isActive ? <Check className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" /> : null}
                  </button>
                );
              })}

              {teams === null ? (
                <p className="px-2 py-3 text-center text-[11px] text-[var(--muted)]">Loading workspaces…</p>
              ) : null}
              {teams && teams.length === 0 ? (
                <p className="px-2 py-3 text-center text-[11px] text-[var(--muted)]">No workspaces yet.</p>
              ) : null}
            </div>

            {/* This list IS the team list, so the footer goes to the current
                team's members rather than to another page of the same list. */}
            <a
              href="/team"
              className="focus-ring flex items-center gap-2 border-t border-[var(--border)] px-3 py-2 text-[11px] font-semibold text-[var(--muted)] transition-colors hover:bg-[var(--surface2)] hover:text-[var(--text)]"
            >
              {isTeam ? <Users className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {isTeam ? 'Members & positions' : 'Create a team'}
            </a>
          </motion.div>
        ) : null}
      </AnimatePresence>
      </Popover>
    </>
  );
}
