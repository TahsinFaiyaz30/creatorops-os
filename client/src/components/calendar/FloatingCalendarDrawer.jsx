'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
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
  const [open, setOpen] = useState(false);
  const [feed, setFeed] = useState({ events: [], recentActivity: [] });
  const [filters, setFilters] = useState({ platform: '', status: '', eventType: '' });
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState(null);
  const [today] = useState(() => new Date());
  const [cursor, setCursor] = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() }));
  const [direction, setDirection] = useState(0);

  const shouldReduceMotion = useReducedMotion();

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

  const eventsByDay = useMemo(() => {
    const map = {};
    const seen = new Set();
    const all = [...(feed.events || []), ...(feed.recentActivity || [])];
    for (const ev of all) {
      const key = toDateKey(ev.date);
      if (!key) continue;
      const uid = ev.id || ev._id;
      if (uid && seen.has(uid)) continue;
      if (uid) seen.add(uid);
      map[key] = map[key] || [];
      map[key].push(ev);
    }
    return map;
  }, [feed]);

  const dayEvents = useMemo(() => {
    if (!selected) return [];
    return eventsByDay[selected] || [];
  }, [selected, eventsByDay]);

  const calendarCells = useMemo(() => {
    const { year, month } = cursor;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [cursor]);

  const todayKey = toDateKey(today);

  const prevMonth = () => {
    setDirection(-1);
    setCursor(c => {
      if (c.month === 0) return { year: c.year - 1, month: 11 };
      return { year: c.year, month: c.month - 1 };
    });
  };

  const nextMonth = () => {
    setDirection(1);
    setCursor(c => {
      if (c.month === 11) return { year: c.year + 1, month: 0 };
      return { year: c.year, month: c.month + 1 };
    });
  };

  const goToday = () => {
    setDirection(0);
    setCursor({ year: today.getFullYear(), month: today.getMonth() });
    setSelected(todayKey);
  };

  const cellKey = day => day
    ? `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    : null;

  const monthVariants = {
    enter: (dir) => ({
      x: shouldReduceMotion ? 0 : dir > 0 ? 20 : -20,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        x: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.2 },
        staggerChildren: shouldReduceMotion ? 0 : 0.015
      }
    },
    exit: (dir) => ({
      x: shouldReduceMotion ? 0 : dir < 0 ? 20 : -20,
      opacity: 0,
      transition: { duration: 0.15 }
    })
  };

  const cellVariants = {
    enter: { scale: shouldReduceMotion ? 1 : 0.9, opacity: 0 },
    center: { scale: 1, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 25 } }
  };

  return (
    <>
      <button
        type="button"
        aria-label="Open calendar"
        onClick={() => setOpen(true)}
        className={`fixed right-0 top-1/2 z-40 -translate-y-1/2 rounded-l-lg border border-r-0 border-[var(--border)] bg-mint px-2 py-6 font-bold text-[var(--accent-fg)] shadow-soft transition-transform duration-300 ease-out hover:scale-[1.02] ${open ? 'translate-x-full' : ''}`}
      >
        <ChevronLeft size={18} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside
        className={`fixed right-0 top-0 z-50 flex h-screen w-[420px] max-w-[96vw] flex-col border-l border-white/10 bg-[#0c1118]/95 backdrop-blur-xl shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Glassmorphic Header */}
        <div className="relative shrink-0 flex items-center justify-between border-b border-white/10 px-5 py-4 overflow-hidden bg-gradient-to-r from-white/5 to-transparent">
          <div className="absolute inset-0 bg-mint/5 pointer-events-none" />
          <div className="flex items-center gap-2 relative z-10">
            <div className="p-1.5 rounded-lg bg-mint/10 border border-mint/20">
              <CalendarDays className="text-mint" size={18} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-mint font-semibold">Operations Feed</p>
              <h2 className="text-lg font-bold leading-tight text-white">Calendar</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="focus-ring relative z-10 rounded-xl border border-white/10 bg-white/5 p-2 text-[var(--muted)] hover:bg-white/10 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto custom-scrollbar">

          {/* ── Month navigator ─────────────────────────────────────────── */}
          <div className="shrink-0 border-b border-white/5 px-4 pt-4 pb-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={prevMonth}
                className="rounded-xl p-1.5 text-[var(--muted)] hover:bg-white/10 hover:text-white transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex items-center gap-3">
                <span className="text-[15px] font-semibold text-white tracking-wide">
                  {MONTHS[cursor.month]} <span className="text-[var(--muted)] font-normal">{cursor.year}</span>
                </span>
                <button
                  type="button"
                  onClick={goToday}
                  className="rounded-lg border border-mint/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-mint hover:bg-mint/10 hover:border-mint/50 transition-all active:scale-95"
                >
                  Today
                </button>
              </div>
              <button
                type="button"
                onClick={nextMonth}
                className="rounded-xl p-1.5 text-[var(--muted)] hover:bg-white/10 hover:text-white transition-colors"
                aria-label="Next month"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Day-of-week header */}
            <div className="mt-4 grid grid-cols-7 text-center">
              {DAYS.map(d => (
                <div key={d} className="py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="relative mt-2 overflow-hidden pb-1">
              <AnimatePresence mode="popLayout" custom={direction} initial={false}>
                <motion.div
                  key={`${cursor.year}-${cursor.month}`}
                  custom={direction}
                  variants={monthVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="grid grid-cols-7 gap-y-1"
                >
                  {calendarCells.map((day, idx) => {
                    const key = cellKey(day);
                    const evs = key ? (eventsByDay[key] || []) : [];
                    const isToday = key === todayKey;
                    const isSel = key === selected;
                    const dotTypes = [...new Set(evs.map(e => e.eventType))].slice(0, 3);

                    return (
                      <motion.button
                        key={`cell-${idx}`}
                        variants={cellVariants}
                        whileHover={day ? { scale: 1.1, backgroundColor: 'rgba(255,255,255,0.1)' } : {}}
                        whileTap={day ? { scale: 0.95 } : {}}
                        disabled={!day}
                        onClick={() => day && setSelected(key === selected ? null : key)}
                        className={`relative flex flex-col items-center rounded-2xl py-1.5 mx-0.5 transition-colors
                          ${!day ? 'pointer-events-none' : ''}
                          ${isSel ? 'bg-mint/20' : ''}
                        `}
                      >
                        {/* Glowing ring for today */}
                        {isToday && (
                          <motion.div
                            className={`absolute inset-0 rounded-2xl border ${isSel ? 'border-mint' : 'border-mint/50'}`}
                            animate={!shouldReduceMotion ? {
                              boxShadow: isSel ? '0 0 12px 2px rgba(0,255,170,0.4)' : ['0 0 0px 0px rgba(0,255,170,0)', '0 0 8px 1px rgba(0,255,170,0.3)', '0 0 0px 0px rgba(0,255,170,0)']
                            } : {}}
                            transition={!isSel && !shouldReduceMotion ? { repeat: Infinity, duration: 2.5, ease: "easeInOut" } : {}}
                          />
                        )}
                        <span className={`relative z-10 text-[13px] font-medium leading-none mt-0.5
                          ${isToday ? 'text-mint font-bold' : 'text-white/80'}
                          ${isSel && !isToday ? 'font-bold text-white' : ''}
                        `}>
                          {day || ''}
                        </span>
                        
                        {/* Event dots */}
                        {dotTypes.length > 0 && (
                          <div className="mt-1 flex gap-[3px] relative z-10 h-1.5 items-center">
                            {dotTypes.map((type, i) => (
                              <motion.span 
                                key={type} 
                                initial={!shouldReduceMotion ? { scale: 0 } : false}
                                animate={!shouldReduceMotion ? { scale: 1 } : false}
                                transition={{ delay: i * 0.1, type: "spring" }}
                                className={`h-1.5 w-1.5 rounded-full shadow-sm ${getStyle(type).dot}`} 
                                style={{ boxShadow: `0 0 6px ${getStyle(type).dot.replace('bg-', 'var(--')})` }}
                              />
                            ))}
                            {evs.length > 3 && (
                              <span className="h-1 w-1 rounded-full bg-slate-500 opacity-60" />
                            )}
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-white/5 pt-3">
              {Object.entries(TYPE_STYLES).map(([type, s]) => (
                <motion.div 
                  key={type} 
                  whileHover={{ scale: 1.05 }}
                  className="flex items-center gap-1.5 cursor-default"
                >
                  <span className={`h-2 w-2 rounded-full ${s.dot} shadow-sm`} />
                  <span className="text-[10px] font-medium text-[var(--muted)]">{s.label}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* ── Filters ─────────────────────────────────────────────────── */}
          <div className="shrink-0 border-b border-white/5 px-4 py-4 bg-white/[0.02]">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)] mb-3">
              <Filter size={12} className="text-mint/70" /> Filters
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative group">
                <select
                  value={filters.platform}
                  onChange={e => setFilters({ ...filters, platform: e.target.value })}
                  className="w-full appearance-none rounded-xl border border-white/10 bg-[var(--surface2)] px-3 py-2 text-xs font-medium text-white shadow-sm focus:border-mint/50 focus:outline-none focus:ring-1 focus:ring-mint/50 transition-all hover:border-white/20"
                >
                  <option value="">All platforms</option>
                  {platformOptions.map(p => <option key={p} value={p}>{formatPlatform(p)}</option>)}
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity">
                  <ChevronRight size={14} className="rotate-90" />
                </div>
              </div>
              <div className="relative group">
                <select
                  value={filters.eventType}
                  onChange={e => setFilters({ ...filters, eventType: e.target.value })}
                  className="w-full appearance-none rounded-xl border border-white/10 bg-[var(--surface2)] px-3 py-2 text-xs font-medium text-white shadow-sm focus:border-mint/50 focus:outline-none focus:ring-1 focus:ring-mint/50 transition-all hover:border-white/20"
                >
                  {eventTypes.map(t => (
                    <option key={t || 'all'} value={t}>{t ? getStyle(t).label : 'All types'}</option>
                  ))}
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity">
                  <ChevronRight size={14} className="rotate-90" />
                </div>
              </div>
            </div>
          </div>

          {message && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mx-4 mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">
              {message}
            </motion.div>
          )}

          {/* ── Selected day events ─────────────────────────────────────── */}
          <AnimatePresence>
            {selected && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                className="overflow-hidden"
              >
                <div className="shrink-0 border-b border-white/5 px-4 py-4 bg-mint/[0.03]">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock size={14} className="text-mint" />
                    <span className="text-[13px] font-bold text-white tracking-wide">
                      {new Date(selected + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                  {dayEvents.length === 0 ? (
                    <p className="text-xs text-[var(--muted)] italic">No events scheduled.</p>
                  ) : (
                    <motion.div 
                      className="space-y-2.5"
                      initial="hidden"
                      animate="visible"
                      variants={{
                        visible: { transition: { staggerChildren: 0.05 } }
                      }}
                    >
                      {dayEvents.map((ev, i) => (
                        <EventCard key={`day-${ev.id || i}`} event={ev} index={i} />
                      ))}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Full feed list ───────────────────────────────────────────── */}
          <div className="flex-1 px-4 py-5 space-y-6">
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
                Upcoming &amp; Scheduled
              </p>
              {feed.events?.length === 0 && (
                <p className="text-xs text-[var(--muted)]">No calendar items match these filters.</p>
              )}
              <motion.div 
                className="space-y-2.5"
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
              >
                {feed.events?.map((ev, i) => <EventCard key={ev.id} event={ev} index={i} />)}
              </motion.div>
            </div>

            {feed.recentActivity?.length > 0 && (
              <div>
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Recent Activity</p>
                <motion.div 
                  className="space-y-2.5"
                  initial="hidden"
                  animate="visible"
                  variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
                >
                  {feed.recentActivity.slice(0, 6).map((ev, i) => <EventCard key={`recent-${ev.id}`} event={ev} index={i} />)}
                </motion.div>
              </div>
            )}
          </div>

        </div>
      </aside>
    </>
  );
}

// ── Compact event card ────────────────────────────────────────────────────────
function EventCard({ event, index = 0 }) {
  const shouldReduceMotion = useReducedMotion();
  const s = getStyle(event.eventType);
  
  const variants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 10 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 400, damping: 30 } }
  };

  return (
    <motion.article 
      variants={variants}
      whileHover={!shouldReduceMotion ? { y: -2, scale: 1.01 } : {}}
      className={`rounded-2xl border p-3.5 text-xs shadow-sm transition-shadow hover:shadow-md backdrop-blur-md ${s.badge}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-bold text-white/95 leading-tight">{event.title}</span>
        {event.date && (
          <span className="shrink-0 text-[10px] font-medium opacity-75 bg-black/10 px-1.5 py-0.5 rounded-md">
            {new Date(event.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
      {event.description && event.description !== event.eventType && (
        <p className="mt-1.5 opacity-80 leading-snug line-clamp-2">{event.description}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {event.platform && (
          <span className="rounded-full bg-black/20 border border-white/5 px-2.5 py-0.5 font-medium">{formatPlatform(event.platform)}</span>
        )}
        {event.status && (
          <span className="rounded-full bg-black/20 border border-white/5 px-2.5 py-0.5 font-medium">{event.status}</span>
        )}
        <span className="rounded-full bg-white/10 border border-white/10 px-2.5 py-0.5 font-medium shadow-sm">{s.label}</span>
      </div>
    </motion.article>
  );
}
