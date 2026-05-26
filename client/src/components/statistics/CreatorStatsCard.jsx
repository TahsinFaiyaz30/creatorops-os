'use client';

export default function CreatorStatsCard({ label, value, note }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-2xl font-bold text-[var(--text)]">{value ?? 'Unavailable'}</div>
      {note && <p className="mt-1 text-xs text-[var(--muted)]">{note}</p>}
    </div>
  );
}
