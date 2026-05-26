'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';

export default function NotificationBell({ compact = false }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const load = async () => {
    const payload = await api.get('/api/notifications');
    setNotifications(payload.data.notifications || []);
  };

  useEffect(() => {
    load().catch(() => {});
    const socket = getSocket();
    const handler = () => load().catch(() => {});
    socket.on('notification:created', handler);
    socket.on('notification:read', handler);
    return () => {
      socket.off('notification:created', handler);
      socket.off('notification:read', handler);
    };
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unread = useMemo(() => notifications.filter(n => !n.readAt).length, [notifications]);

  const markRead = async n => {
    await api.post(`/api/notifications/${n._id}/read`, {});
    await load();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        id="notification-bell-btn"
        type="button"
        onClick={() => setOpen(v => !v)}
        className="focus-ring relative flex h-9 w-9 items-center justify-center rounded-2xl text-[var(--muted)] transition hover:bg-[var(--border)] hover:text-[var(--text)]"
        aria-label="Notifications"
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose text-[9px] font-bold leading-none text-[var(--text)]">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute z-50 w-80 animate-scale-in rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-soft ${compact ? 'bottom-0 left-full ml-2' : 'bottom-full left-0 mb-2'}`}>
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Notifications</span>
            {unread > 0 && (
              <span className="rounded-full bg-rose/15 px-2 py-0.5 text-xs font-semibold text-rose">{unread} new</span>
            )}
          </div>
          <div className="max-h-80 overflow-auto p-2">
            {notifications.length === 0 && (
              <p className="p-4 text-center text-sm text-[var(--muted)]">No notifications yet.</p>
            )}
            {notifications.slice(0, 10).map(n => (
              <button
                key={n._id}
                type="button"
                onClick={() => markRead(n)}
                className={`w-full rounded-xl border p-3 text-left text-xs transition hover:bg-[var(--border)] mb-1
                  ${n.readAt
                    ? 'border-transparent text-[var(--muted)]'
                    : 'border-mint/20 bg-mint/5 text-[var(--text)]'
                  }`}
              >
                <div className="font-semibold">{n.title}</div>
                <p className="mt-1 text-[var(--muted)]">{n.message}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
