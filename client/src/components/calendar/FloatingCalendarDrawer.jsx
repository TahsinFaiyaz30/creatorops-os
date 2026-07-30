'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, ChevronLeft, ChevronRight, X, Clock, Filter
} from 'lucide-react';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { platformOptions, formatPlatform } from '../../lib/platforms';

// ── colour tokens per event type ────────────────────────────────────────────
const TYPE_STYLES = {
  scheduled_post:       { dot: 'bg-mint',       badge: 'border-mint/30 bg-mint/10 text-mint',           label: 'Scheduled' },
  published_post:       { dot: 'bg-emerald-400', badge: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300', label: 'Published' },
  circular_deadline:    { dot: 'bg-amber-400',   badge: 'border-amber-400/30 bg-amber-400/10 text-amber-300',       label: 'Deadline' },
  application_deadline: { dot: 'bg-purple-400',  badge: 'border-purple-400/30 bg-purple-400/10 text-purple-300',    label: 'Application' },
  upcoming_event:       { dot: 'bg-slate-400',   badge: 'border-white/15 bg-white/5 text-[var(--text)]',    label: 'Event' },
  workflow_milestone:   { dot: 'bg-slate-600',   badge: 'border-[var(--border)] bg-[var(--surface2)] text-[var(--muted)]',             label: 'Milestone' },
};

const getStyle = type => TYPE_STYLES[type] || TYPE_STYLES.workflow_milestone;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const toDateKey = date => {
  const d = new Date(date);
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const eventTypes = ['', 'scheduled_post', 'published_post', 'circular_deadline', 'application_deadline', 'upcoming_event', 'workflow_milestone'];

export default function FloatingCalendarDrawer() {
  const [open, setOpen]       = useState(false);
  const [feed, setFeed]       = useState({ events: [], recentActivity: [] });
  const [filters, setFilters] = useState({ platform: '', status: '', eventType: '' });
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState(null); // selected date key
  const [today]   = useState(() => new Date());
  const [cursor, setCursor]   = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() }));

  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
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

  // ── index events by date key (deduplicated by id) ────────────────────────
  const eventsByDay = useMemo(() => {
    const map = {};
    const seen = new Set();
    const all = [...(feed.events || []), ...(feed.recentActivity || [])];
    for (const ev of all) {
      const key = toDateKey(ev.date);
      if (!key) continue;
      // deduplicate: same event can appear in both events + recentActivity
      const uid = ev.id || ev._id;
      if (uid && seen.has(uid)) continue;
      if (uid) seen.add(uid);
      map[key] = map[key] || [];
      map[key].push(ev);
    }
    return map;
  }, [feed]);

  // events for selected day
  const dayEvents = useMemo(() => {
    if (!selected) return [];
    return eventsByDay[selected] || [];
  }, [selected, eventsByDay]);

  // ── build calendar grid ───────────────────────────────────────────────────
  const calendarCells = useMemo(() => {
    const { year, month } = cursor;
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [cursor]);

  const todayKey = toDateKey(today);

  const prevMonth = () => setCursor(c => {
    if (c.month === 0) return { year: c.year - 1, month: 11 };
    return { year: c.year, month: c.month - 1 };
  });
  const nextMonth = () => setCursor(c => {
    if (c.month === 11) return { year: c.year + 1, month: 0 };
    return { year: c.year, month: c.month + 1 };
  });
  const goToday = () => {
    setCursor({ year: today.getFullYear(), month: today.getMonth() });
    setSelected(todayKey);
  };

  const cellKey = day => day
    ? `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    : null;

  return (
    <>
      {/* Tab trigger */}
      <button
        type="button"
        aria-label="Open calendar"
        onClick={() => setOpen(true)}
        className={`fixed right-0 top-1/2 z-40 -translate-y-1/2 rounded-l-lg border border-r-0 border-[var(--border)] bg-mint px-2 py-6 font-bold text-[var(--accent-fg)] shadow-soft transition-transform ${open ? 'translate-x-full' : ''}`}
      >
        <ChevronLeft size={18} />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed right-0 top-0 z-50 flex h-screen w-[420px] max-w-[96vw] flex-col border-l border-[var(--border)] bg-[#0c1118] shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="text-mint" size={20} />
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-mint">Operations Feed</p>
              <h2 className="text-lg font-bold leading-tight text-[var(--text)]">Calendar</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="focus-ring rounded-xl border border-[var(--border)] p-2 text-[var(--muted)] hover:bg-white/5"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">

          {/* ── Month navigator ─────────────────────────────────────────── */}
          <div className="shrink-0 border-b border-[var(--border)] px-4 pt-4 pb-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={prevMonth}
                className="rounded-xl p-1.5 text-[var(--muted)] hover:bg-white/5 hover:text-[var(--text)]"
                aria-label="Previous month"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-[var(--text)]">
                  {MONTHS[cursor.month]} {cursor.year}
                </span>
                <button
                  type="button"
                  onClick={goToday}
                  className="rounded-xl border border-mint/40 px-2 py-0.5 text-[10px] font-semibold text-mint hover:bg-mint/10"
                >
                  Today
                </button>
              </div>
              <button
                type="button"
                onClick={nextMonth}
                className="rounded-xl p-1.5 text-[var(--muted)] hover:bg-white/5 hover:text-[var(--text)]"
                aria-label="Next month"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Day-of-week header */}
            <div className="mt-3 grid grid-cols-7 text-center">
              {DAYS.map(d => (
                <div key={d} className="py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="mt-1 grid grid-cols-7 gap-y-1">
              {calendarCells.map((day, idx) => {
                const key = cellKey(day);
                const evs = key ? (eventsByDay[key] || []) : [];
                const isToday = key === todayKey;
                const isSel  = key === selected;
                // unique dot colours (max 3)
                const dotTypes = [...new Set(evs.map(e => e.eventType))].slice(0, 3);

                return (
                  <button
                    key={`cell-${idx}`}
                    type="button"
                    disabled={!day}
                    onClick={() => day && setSelected(key === selected ? null : key)}
                    className={`relative flex flex-col items-center rounded-2xl py-1.5 transition
                      ${!day ? 'pointer-events-none' : 'hover:bg-white/5'}
                      ${isToday && !isSel ? 'ring-1 ring-mint/50' : ''}
                      ${isSel ? 'bg-mint/15 ring-1 ring-mint' : ''}
                    `}
                  >
                    <span className={`text-xs font-medium leading-none
                      ${isToday ? 'text-mint' : 'text-[var(--text)]'}
                      ${isSel ? 'font-bold text-mint' : ''}
                    `}>
                      {day || ''}
                    </span>
                    {/* event dots */}
                    {dotTypes.length > 0 && (
                      <div className="mt-1 flex gap-0.5">
                        {dotTypes.map(type => (
                          <span key={type} className={`h-1 w-1 rounded-full ${getStyle(type).dot}`} />
                        ))}
                        {evs.length > 3 && (
                          <span className="h-1 w-1 rounded-full bg-slate-500" />
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-[var(--border)] pt-2">
              {Object.entries(TYPE_STYLES).map(([type, s]) => (
                <div key={type} className="flex items-center gap-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                  <span className="text-[9px] text-[var(--muted)]">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Filters ─────────────────────────────────────────────────── */}
          <div className="shrink-0 border-b border-[var(--border)] px-4 py-3">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
              <Filter size={11} /> Filters
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={filters.platform}
                onChange={e => setFilters({ ...filters, platform: e.target.value })}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-2 py-1.5 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-mint"
              >
                <option value="">All platforms</option>
                {platformOptions.map(p => <option key={p} value={p}>{formatPlatform(p)}</option>)}
              </select>
              <select
                value={filters.eventType}
                onChange={e => setFilters({ ...filters, eventType: e.target.value })}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-2 py-1.5 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-mint"
              >
                {eventTypes.map(t => (
                  <option key={t || 'all'} value={t}>{t ? getStyle(t).label : 'All types'}</option>
                ))}
              </select>
            </div>
          </div>

          {message && (
            <div className="mx-4 mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 text-xs text-[var(--text)]">{message}</div>
          )}

          {/* ── Selected day events ─────────────────────────────────────── */}
          {selected && (
            <div className="shrink-0 border-b border-[var(--border)] px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={13} className="text-mint" />
                <span className="text-xs font-semibold text-[var(--text)]">
                  {new Date(selected + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                </span>
              </div>
              {dayEvents.length === 0 ? (
                <p className="text-xs text-[var(--muted)]">No events on this day.</p>
              ) : (
                <div className="space-y-2">
                  {dayEvents.map((ev, i) => (
                    <EventCard key={`day-${ev.id || i}`} event={ev} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Full feed list ───────────────────────────────────────────── */}
          <div className="flex-1 px-4 py-3 space-y-4">
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                Upcoming &amp; scheduled
              </p>
              {feed.events?.length === 0 && (
                <p className="text-xs text-[var(--muted)]">No calendar items match these filters.</p>
              )}
              <div className="space-y-2">
                {feed.events?.map(ev => <EventCard key={ev.id} event={ev} />)}
              </div>
            </div>

            {feed.recentActivity?.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Recent activity</p>
                <div className="space-y-2">
                  {feed.recentActivity.slice(0, 6).map(ev => <EventCard key={`recent-${ev.id}`} event={ev} />)}
                </div>
              </div>
            )}
          </div>

        </div>
      </aside>
    </>
  );
}

// ── Compact event card ────────────────────────────────────────────────────────
function EventCard({ event }) {
  const s = getStyle(event.eventType);
  return (
    <article className={`rounded-2xl border p-3 text-xs ${s.badge}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-[var(--text)] leading-tight">{event.title}</span>
        {event.date && (
          <span className="shrink-0 text-[10px] opacity-70">
            {new Date(event.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
      {event.description && event.description !== event.eventType && (
        <p className="mt-1 opacity-80 leading-snug">{event.description}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-1">
        {event.platform && (
          <span className="rounded-full bg-black/20 px-2 py-0.5">{formatPlatform(event.platform)}</span>
        )}
        {event.status && (
          <span className="rounded-full bg-black/20 px-2 py-0.5">{event.status}</span>
        )}
        <span className="rounded-full bg-black/20 px-2 py-0.5">{s.label}</span>
      </div>
    </article>
  );
}
