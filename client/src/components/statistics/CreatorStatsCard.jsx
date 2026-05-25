'use client';

export default function CreatorStatsCard({ label, value, note }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-white">{value ?? 'Unavailable'}</div>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </div>
  );
}
