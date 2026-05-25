'use client';

import { formatPlatform } from '../../lib/platforms';

const tones = {
  scheduled_post: 'border-cyan/30 bg-cyan/10 text-cyan',
  published_post: 'border-mint/30 bg-mint/10 text-mint',
  circular_deadline: 'border-gold/30 bg-gold/10 text-gold',
  application_deadline: 'border-purple-400/30 bg-purple-400/10 text-purple-200',
  upcoming_event: 'border-white/15 bg-white/5 text-slate-300',
  workflow_milestone: 'border-line bg-ink text-slate-400'
};

export default function CalendarEventBadge({ event }) {
  return (
    <article className={`rounded-md border p-3 text-xs ${tones[event.eventType] || tones.workflow_milestone}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-white">{event.title}</span>
        <span>{event.date ? new Date(event.date).toLocaleDateString() : 'No date'}</span>
      </div>
      <p className="mt-1 text-slate-300">{event.description || event.eventType}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {event.platform && <span className="rounded-full bg-ink px-2 py-1">{formatPlatform(event.platform)}</span>}
        {event.status && <span className="rounded-full bg-ink px-2 py-1">{event.status}</span>}
        <span className="rounded-full bg-ink px-2 py-1">{event.eventType}</span>
      </div>
    </article>
  );
}
