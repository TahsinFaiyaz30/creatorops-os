'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Pin a media asset to a project — PATCH /api/media/:id { projectId }
 *
 * An asset in the shared library is visible to the whole team. Pinning it to a
 * project narrows it to that project's crew, which is the same boundary that
 * governs tasks, deliverables and chat. Unpinning returns it to the library.
 *
 * Only rendered inside a team: in a personal workspace there is nobody to hide
 * anything from, so the control would be a decision with no consequence.
 *
 * The menu is measured from the trigger and portalled to <body>: the tile it
 * sits in is `overflow-hidden`, and the surrounding cards carry backdrop
 * filters, which would otherwise both clip it and re-anchor it.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Popover from '../ui/Popover';
import { Check, FolderLock, Pin, Users } from 'lucide-react';

import { api } from '../../lib/api';

const EASE = [0.16, 1, 0.3, 1];
const MENU_WIDTH = 232;

const idOf = value => String(value?._id || value || '');

export default function ProjectPinControl({ asset, projects, onChanged, onError, compact = false }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const [busy, setBusy] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const pinnedTo = asset?.projectId || null;
  const pinnedId = pinnedTo ? idOf(pinnedTo) : '';

  const placeMenu = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.min(rect.left, window.innerWidth - MENU_WIDTH - 12);
    /* Flip above the trigger when there is no room beneath it. */
    const below = window.innerHeight - rect.bottom;
    const top = below < 220 ? Math.max(12, rect.top - 8 - Math.min(220, below + 200)) : rect.bottom + 6;
    setAnchor({ top, left: Math.max(12, left) });
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

  const pin = async projectId => {
    if (idOf(projectId) === pinnedId || (!projectId && !pinnedId)) {
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      await api.patch(`/api/media/${idOf(asset)}`, { projectId: projectId || null });
      setOpen(false);
      await onChanged?.(
        projectId
          ? `Pinned to ${projects.find(p => idOf(p) === idOf(projectId))?.name || 'the project'} — only its crew can see it now.`
          : 'Returned to the shared team library.'
      );
    } catch (error) {
      onError?.(error.message);
    } finally {
      setBusy(false);
    }
  };

  const label = pinnedTo?.name || 'Shared';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={event => {
          event.stopPropagation();
          setOpen(value => !value);
        }}
        disabled={busy}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={pinnedTo ? `Pinned to ${pinnedTo.name}. Change` : 'Shared with the team. Pin to a project'}
        title={pinnedTo ? `Only the ${pinnedTo.name} crew can see this` : 'Visible to the whole team'}
        className={
          compact
            ? `focus-ring inline-flex max-w-[10rem] items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold transition-colors disabled:opacity-50 ${
                pinnedTo
                  ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'border-[var(--border)] bg-[var(--surface2)] text-[var(--muted)] hover:text-[var(--text)]'
              }`
            : `focus-ring inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold transition-colors disabled:opacity-50 ${
                pinnedTo ? 'bg-[var(--accent)] text-[var(--accent-fg)]' : 'bg-white/15 text-white hover:bg-white/25'
              }`
        }
      >
        {pinnedTo ? <FolderLock className="h-3 w-3 shrink-0" /> : <Pin className="h-3 w-3 shrink-0" />}
        <span className="truncate">{label}</span>
      </button>

      <Popover>
      <AnimatePresence>
        {open && anchor ? (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: EASE }}
            role="listbox"
            style={{ position: 'fixed', top: anchor.top, left: anchor.left, width: MENU_WIDTH }}
            className="z-[100] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]"
          >
            <p className="border-b border-[var(--border)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Who can see this file
            </p>

            <div className="max-h-56 overflow-y-auto p-1">
              <button
                type="button"
                role="option"
                aria-selected={!pinnedId}
                onClick={() => pin(null)}
                className={`focus-ring flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                  !pinnedId ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--surface2)]'
                }`}
              >
                <Users className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                <span className="min-w-0 flex-1">
                  <span className={`block text-xs font-semibold ${!pinnedId ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}>
                    Whole team
                  </span>
                  <span className="block text-[10px] text-[var(--muted)]">Shared library</span>
                </span>
                {!pinnedId ? <Check className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" /> : null}
              </button>

              {projects.map(project => {
                const isPinned = idOf(project) === pinnedId;
                return (
                  <button
                    key={idOf(project)}
                    type="button"
                    role="option"
                    aria-selected={isPinned}
                    onClick={() => pin(idOf(project))}
                    className={`focus-ring flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                      isPinned ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--surface2)]'
                    }`}
                  >
                    <FolderLock className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-xs font-semibold ${
                          isPinned ? 'text-[var(--accent)]' : 'text-[var(--text)]'
                        }`}
                      >
                        {project.name}
                      </span>
                      <span className="block text-[10px] text-[var(--muted)]">
                        {(project.memberIds?.length || 0) + (project.leadId ? 1 : 0)} on this project
                      </span>
                    </span>
                    {isPinned ? <Check className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" /> : null}
                  </button>
                );
              })}

              {projects.length === 0 ? (
                <p className="px-2 py-3 text-center text-[11px] leading-relaxed text-[var(--muted)]">
                  No projects yet. Create one to keep files to a crew.
                </p>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      </Popover>
    </>
  );
}
