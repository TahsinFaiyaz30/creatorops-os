'use client';

const options = [
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
  { value: 'friends_only', label: 'Friends only' }
];

export default function VisibilitySelector({ value, onChange, mediaType = '' }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Video visibility</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map(option => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-xl border px-3 py-2 text-xs ${value === option.value ? 'border-mint bg-mint/10 text-mint' : 'border-[var(--border)] text-[var(--text)] hover:bg-white/5'}`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">
        {mediaType === 'video'
          ? 'Unsupported options are blocked by backend connector validation.'
          : 'Visibility controls apply to video posts; non-video private/friends-only requests are blocked honestly.'}
      </p>
    </div>
  );
}
