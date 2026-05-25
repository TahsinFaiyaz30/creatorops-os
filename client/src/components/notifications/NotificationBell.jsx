'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);

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

  const unread = useMemo(() => notifications.filter(item => !item.readAt).length, [notifications]);

  const markRead = async notification => {
    await api.post(`/api/notifications/${notification._id}/read`, {});
    await load();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="focus-ring flex w-full items-center justify-between rounded-md border border-line px-3 py-2 text-sm text-slate-200 hover:bg-white/5"
      >
        <span className="inline-flex items-center gap-2"><Bell size={15} /> Notifications</span>
        {unread > 0 && <span className="rounded-full bg-rose px-2 py-0.5 text-xs font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-40 mb-2 max-h-80 w-80 overflow-auto rounded-lg border border-line bg-panel p-3 shadow-soft">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent notifications</div>
          <div className="mt-2 space-y-2">
            {notifications.slice(0, 8).map(notification => (
              <button
                key={notification._id}
                type="button"
                onClick={() => markRead(notification)}
                className={`w-full rounded-md border p-2 text-left text-xs ${notification.readAt ? 'border-line bg-ink text-slate-400' : 'border-cyan/30 bg-cyan/10 text-slate-200'}`}
              >
                <div className="font-semibold text-white">{notification.title}</div>
                <p className="mt-1">{notification.message}</p>
              </button>
            ))}
            {notifications.length === 0 && <p className="text-xs text-slate-500">No notifications yet.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
