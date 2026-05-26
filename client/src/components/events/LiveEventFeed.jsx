'use client';

import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';

export default function LiveEventFeed({ compact = false }) {
  const [events, setEvents] = useState([]);
  const [socketStatus, setSocketStatus] = useState('connecting');

  useEffect(() => {
    let mounted = true;

    api
      .get('/api/events?limit=30')
      .then(payload => {
        if (mounted) setEvents(payload.data.events || []);
      })
      .catch(() => {
        if (mounted) setEvents([]);
      });

    const socket = getSocket();
    setSocketStatus(socket.connected ? 'live' : 'connecting');

    const onEvent = event => {
      setEvents(current => [event, ...current].slice(0, 30));
    };
    const onConnect = () => setSocketStatus('live');
    const onDisconnect = () => setSocketStatus('offline');
    const onConnectError = () => setSocketStatus('offline');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('workflow:event', onEvent);

    return () => {
      mounted = false;
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('workflow:event', onEvent);
    };
  }, []);

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="text-mint" size={18} />
          <h2 className="text-base font-semibold text-[var(--text)]">Live Workflow Events</h2>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs ${socketStatus === 'live' ? 'bg-mint/10 text-mint' : 'bg-gold/10 text-gold'}`}>
          {socketStatus}
        </span>
      </div>
      <div className={`space-y-3 ${compact ? 'max-h-[360px]' : 'max-h-[520px]'} overflow-auto pr-1`}>
        {events.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No events yet.</p>
        ) : (
          events.map(event => (
            <div key={event._id} className="rounded-xl border border-[var(--border)] bg-[var(--surface2)]/50 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-mint">{event.eventType}</span>
                <span className="text-[11px] text-[var(--muted)]">{event.createdAt ? new Date(event.createdAt).toLocaleTimeString() : ''}</span>
              </div>
              <p className="mt-1 text-sm text-[var(--text)]">{event.message}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
