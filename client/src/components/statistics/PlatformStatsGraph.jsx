'use client';

import { formatPlatform } from '../../lib/platforms';

export default function PlatformStatsGraph({ platformStat }) {
  const metrics = platformStat.metrics || {};
  const max = Math.max(metrics.views || 0, metrics.likes || 0, metrics.comments || 0, metrics.shares || 0, metrics.saves || 0, 1);
  const bars = [
    ['Views', metrics.views || 0],
    ['Likes', metrics.likes || 0],
    ['Comments', metrics.comments || 0],
    ['Shares', metrics.shares || 0],
    ['Saves', metrics.saves || 0]
  ];

  return (
    <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-[var(--text)]">{formatPlatform(platformStat.platform)}</h3>
        <span className={`rounded-full px-2 py-1 text-xs ${platformStat.source === 'real_sync' ? 'bg-mint/10 text-mint' : 'bg-gold/10 text-gold'}`}>
          {platformStat.source}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {bars.map(([label, value]) => (
          <div key={label}>
            <div className="flex justify-between text-xs text-[var(--muted)]"><span>{label}</span><span>{value}</span></div>
            <div className="mt-1 h-2 rounded-full bg-[var(--surface2)]">
              <div className="h-2 rounded-full bg-mint" style={{ width: `${Math.max(3, (value / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--muted)]">
        <span>Posts: {metrics.postCount || 0}</span>
        <span>Engagement: {metrics.engagementRate || 0}%</span>
        <span>Followers: {metrics.followers ?? 'Unavailable'}</span>
        <span>Reach: {metrics.reach ?? 'Unavailable'}</span>
      </div>
      {platformStat.unavailableReason && <p className="mt-3 text-xs text-gold">{platformStat.unavailableReason}</p>}
    </article>
  );
}
