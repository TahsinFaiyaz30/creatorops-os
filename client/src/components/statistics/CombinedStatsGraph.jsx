'use client';

export default function CombinedStatsGraph({ graph = [] }) {
  const max = Math.max(...graph.map(item => item.value || 0), 1);
  return (
    <section className="rounded-lg border border-line bg-panel p-4">
      <h2 className="text-lg font-semibold text-white">Combined weighted signal</h2>
      <p className="mt-1 text-sm text-slate-400">Uses only stored real synced platform metrics. Purple bars are the cross-platform combined graph.</p>
      <div className="mt-4 space-y-3">
        {graph.map(item => (
          <div key={item.label}>
            <div className="flex justify-between text-xs text-slate-400"><span>{item.label}</span><span>{item.value}</span></div>
            <div className="mt-1 h-3 rounded-full bg-ink">
              <div className="h-3 rounded-full bg-purple-400" style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }} />
            </div>
          </div>
        ))}
        {graph.length === 0 && <p className="text-sm text-slate-500">No real synced data yet, so the combined graph is empty.</p>}
      </div>
    </section>
  );
}
