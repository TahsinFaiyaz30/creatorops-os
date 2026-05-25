'use client';

const options = [
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
  { value: 'friends_only', label: 'Friends only' }
];

export default function VisibilitySelector({ value, onChange, mediaType = '' }) {
  return (
    <div className="rounded-md border border-line bg-ink p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Video visibility</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map(option => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-md border px-3 py-2 text-xs ${value === option.value ? 'border-cyan bg-cyan/10 text-cyan' : 'border-line text-slate-300 hover:bg-white/5'}`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {mediaType === 'video'
          ? 'Unsupported options are blocked by backend connector validation.'
          : 'Visibility controls apply to video posts; non-video private/friends-only requests are blocked honestly.'}
      </p>
    </div>
  );
}
