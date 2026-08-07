'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Notification bell.
 *
 * The panel used to be positioned `bottom-full` — opening upward from the
 * trigger. The bell sits in the top header bar, so the panel rendered above the
 * top of the viewport and clicking the bell appeared to do nothing at all.
 *
 * It now opens downward, measured from the trigger and portalled to <body>. The
 * portal is not cosmetic: the header carries `backdrop-blur-md`, and a
 * backdrop-filter makes an element a containing block for `position: fixed` —
 * so the panel was being measured against the viewport but positioned against
 * the header, landing 278px off the right edge of the screen.
 *
 * Each row is a real link: notifications carry an entityType/entityId, so
 * clicking one marks it read and goes to the thing it is about instead of
 * leaving you to hunt for it.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import Popover from '../ui/Popover';
import { Bell, Check, CheckCheck } from 'lucide-react';

import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';

const PANEL_WIDTH = 360;
const EASE = [0.16, 1, 0.3, 1];

/** Where a notification points, by what it is about. */
const routeFor = notification => {
  const id = String(notification.entityId || '');
  switch (notification.entityType) {
    case 'CircularApplication':
      return '/applications';
    case 'TeamInvitation':
      return '/team';
    case 'TeamMembership':
      return '/team';
    case 'Campaign':
      return id ? `/campaigns/${id}` : '/campaigns';
    case 'ContentItem':
      return '/my-work';
    case 'Deliverable':
      return '/review';
    case 'Handoff':
      return '/my-work';
    case 'ApprovalRequest':
      return '/review';
    default:
      return '';
  }
};

const relativeTime = value => {
  const then = new Date(value).getTime();
  if (!then) return '';
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const [busy, setBusy] = useState(false);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const load = useCallback(
    () =>
      api
        .get('/api/notifications')
        .then(payload => setNotifications(payload.data.notifications || []))
        .catch(() => {}),
    []
  );

  useEffect(() => {
    load();
    const socket = getSocket();
    const handler = () => load();
    socket.on('notification:created', handler);
    socket.on('notification:read', handler);
    return () => {
      socket.off('notification:created', handler);
      socket.off('notification:read', handler);
    };
  }, [load]);

  const placePanel = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    /* Right-aligned to the bell, clamped inside the viewport. */
    const left = Math.min(Math.max(12, rect.right - PANEL_WIDTH), window.innerWidth - PANEL_WIDTH - 12);
    setAnchor({ top: rect.bottom + 8, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) return undefined;
    placePanel();
    window.addEventListener('resize', placePanel);
    window.addEventListener('scroll', placePanel, true);
    return () => {
      window.removeEventListener('resize', placePanel);
      window.removeEventListener('scroll', placePanel, true);
    };
  }, [open, placePanel]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = event => {
      if (triggerRef.current?.contains(event.target)) return;
      if (panelRef.current?.contains(event.target)) return;
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

  const unread = useMemo(() => notifications.filter(n => !n.readAt).length, [notifications]);

  const openNotification = async notification => {
    if (!notification.readAt) {
      await api.post(`/api/notifications/${notification._id}/read`, {}).catch(() => {});
      await load();
    }
    const href = routeFor(notification);
    setOpen(false);
    if (href) router.push(href);
  };

  const markAllRead = async () => {
    setBusy(true);
    try {
      await Promise.all(
        notifications
          .filter(n => !n.readAt)
          .map(n => api.post(`/api/notifications/${n._id}/read`, {}).catch(() => {}))
      );
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        id="notification-bell-btn"
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        className="focus-ring relative flex h-9 w-9 items-center justify-center rounded-2xl text-[var(--muted)] transition-colors hover:bg-[var(--surface2)] hover:text-[var(--text)]"
      >
        <Bell size={17} />
        {unread > 0 ? (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold leading-none text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      <Popover>
      <AnimatePresence>
        {open && anchor ? (
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-label="Notifications"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: EASE }}
            style={{ position: 'fixed', top: anchor.top, left: anchor.left, width: PANEL_WIDTH }}
            className="z-[100] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-2.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                Notifications
              </span>
              {unread > 0 ? (
                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={busy}
                  className="focus-ring inline-flex items-center gap-1 rounded text-[11px] font-semibold text-[var(--accent)] transition-opacity hover:underline disabled:opacity-50"
                >
                  <CheckCheck className="h-3 w-3" />
                  Mark all read
                </button>
              ) : null}
            </div>

            <div className="max-h-[24rem] overflow-y-auto p-1.5">
              {notifications.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-[var(--muted)]">
                  Nothing yet. Approvals, handoffs and team invitations land here.
                </p>
              ) : null}

              {notifications.slice(0, 25).map(notification => {
                const isRead = Boolean(notification.readAt);
                return (
                  <button
                    key={notification._id}
                    type="button"
                    onClick={() => openNotification(notification)}
                    className={`mb-1 flex w-full gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors last:mb-0 ${
                      isRead
                        ? 'border-transparent hover:bg-[var(--surface2)]'
                        : 'border-[var(--accent-line)] bg-[var(--accent-soft)] hover:bg-[var(--accent)]/15'
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                        isRead ? 'bg-transparent' : 'bg-[var(--accent)]'
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-xs font-semibold ${
                          isRead ? 'text-[var(--text-2)]' : 'text-[var(--text)]'
                        }`}
                      >
                        {notification.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--muted)]">
                        {notification.message}
                      </span>
                      <span className="mt-1 flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
                        {relativeTime(notification.createdAt)}
                        {/* Which team it came from — a creator works in several. */}
                        {notification.workspaceId?.name ? (
                          <>
                            <span className="opacity-40">·</span>
                            <span className="truncate">{notification.workspaceId.name}</span>
                          </>
                        ) : null}
                      </span>
                    </span>
                    {isRead ? <Check className="mt-1 h-3 w-3 shrink-0 text-[var(--muted)] opacity-50" /> : null}
                  </button>
                );
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      </Popover>
    </>
  );
}
