'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { platformOptions, formatPlatform } from '../../lib/platforms';
import CalendarEventBadge from './CalendarEventBadge';

const eventTypes = ['', 'scheduled_post', 'published_post', 'circular_deadline', 'application_deadline', 'upcoming_event', 'workflow_milestone'];

export default function FloatingCalendarDrawer() {
  const [open, setOpen] = useState(false);
  const [feed, setFeed] = useState({ events: [], recentActivity: [] });
  const [filters, setFilters] = useState({ platform: '', status: '', eventType: '' });
  const [message, setMessage] = useState('');

  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [filters]);

  const load = async () => {
    const payload = await api.get(`/api/calendar/feed${query ? `?${query}` : ''}`);
    setFeed(payload.data.feed || { events: [], recentActivity: [] });
  };

  useEffect(() => {
    load().catch(err => setMessage(err.message));
    const socket = getSocket();
    const handler = () => load().catch(() => {});
    socket.on('calendar:updated', handler);
    socket.on('publishing:job_updated', handler);
    socket.on('workflow:event', handler);
    return () => {
      socket.off('calendar:updated', handler);
      socket.off('publishing:job_updated', handler);
      socket.off('workflow:event', handler);
    };
  }, [query]);

  return (
    <>
      <button
        type="button"
        aria-label="Open calendar"
        onClick={() => setOpen(true)}
        className={`fixed right-0 top-1/2 z-40 -translate-y-1/2 rounded-l-lg border border-r-0 border-line bg-cyan px-2 py-6 font-bold text-ink shadow-soft transition ${open ? 'translate-x-full' : ''}`}
      >
        <ChevronLeft size={18} />
      </button>
      <aside className={`fixed right-0 top-0 z-50 h-screen w-[380px] max-w-[94vw] border-l border-line bg-[#0f141b] p-4 shadow-soft transition-transform duration-200 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-cyan">Calendar</p>
            <h2 className="mt-1 text-xl font-bold text-white">Operations Feed</h2>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="focus-ring rounded-md border border-line p-2 text-slate-300 hover:bg-white/5">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="mt-4 grid gap-2 rounded-lg border border-line bg-panel p-3">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase text-slate-500"><Filter size={13} /> Filters</div>
          <select value={filters.platform} onChange={event => setFilters({ ...filters, platform: event.target.value })} className="focus-ring rounded-md border border-line bg-ink px-2 py-2 text-xs text-white">
            <option value="">All platforms</option>
            {platformOptions.map(platform => <option key={platform} value={platform}>{formatPlatform(platform)}</option>)}
          </select>
          <select value={filters.eventType} onChange={event => setFilters({ ...filters, eventType: event.target.value })} className="focus-ring rounded-md border border-line bg-ink px-2 py-2 text-xs text-white">
            {eventTypes.map(type => <option key={type || 'all'} value={type}>{type || 'All event types'}</option>)}
          </select>
          <input value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value })} placeholder="status filter" className="focus-ring rounded-md border border-line bg-ink px-2 py-2 text-xs text-white" />
        </div>

        {message && <div className="mt-3 rounded-md border border-line bg-panel p-2 text-xs text-slate-300">{message}</div>}

        <div className="mt-4 max-h-[calc(100vh-250px)] space-y-3 overflow-auto pr-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-white"><CalendarDays size={16} /> Scheduled, deadlines, and milestones</div>
          {feed.events?.map(event => <CalendarEventBadge key={event.id} event={event} />)}
          {feed.events?.length === 0 && <p className="rounded-md border border-line bg-panel p-3 text-sm text-slate-500">No calendar items match these filters.</p>}
          <div className="pt-3 text-sm font-semibold text-white">Recent activity</div>
          {feed.recentActivity?.slice(0, 5).map(event => <CalendarEventBadge key={`recent-${event.id}`} event={event} />)}
        </div>
      </aside>
    </>
  );
}
