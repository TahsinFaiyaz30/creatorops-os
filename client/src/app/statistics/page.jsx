'use client';

import { useEffect, useState } from 'react';
import AppShell from '../../components/layout/AppShell';
import CreatorStatsCard from '../../components/statistics/CreatorStatsCard';
import CombinedStatsGraph from '../../components/statistics/CombinedStatsGraph';
import PlatformStatsGraph from '../../components/statistics/PlatformStatsGraph';
import { api } from '../../lib/api';

export default function StatisticsPage() {
  const [statistics, setStatistics] = useState(null);
  const [message, setMessage] = useState('');

  const load = async () => {
    const payload = await api.get('/api/statistics/creator');
    setStatistics(payload.data.statistics);
  };

  useEffect(() => {
    load().catch(err => setMessage(err.message));
  }, []);

  const snapshot = async () => {
    try {
      await api.post('/api/statistics/snapshot', {});
      setMessage('Statistics snapshot created for applications.');
      await load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const combined = statistics?.combinedStats || {};

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="rounded-lg border border-line bg-panel p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-cyan">Real creator statistics</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Statistics</h1>
          <p className="mt-2 max-w-4xl text-sm text-slate-400">Only official synced platform metrics are counted. Unsupported or unsynced metrics stay unavailable.</p>
          <button onClick={snapshot} className="focus-ring mt-4 rounded-md bg-cyan px-3 py-2 text-sm font-semibold text-ink">Create application snapshot</button>
        </header>
        {message && <div className="rounded-md border border-line bg-panel p-3 text-sm text-slate-300">{message}</div>}
        {statistics?.unavailableMessage && <div className="rounded-md border border-gold/30 bg-gold/10 p-3 text-sm text-gold">{statistics.unavailableMessage}</div>}
        <section className="grid gap-4 md:grid-cols-4">
          <CreatorStatsCard label="Views" value={combined.views || 0} />
          <CreatorStatsCard label="Likes" value={combined.likes || 0} />
          <CreatorStatsCard label="Comments" value={combined.comments || 0} />
          <CreatorStatsCard label="Engagement rate" value={`${combined.engagementRate || 0}%`} />
        </section>
        <CombinedStatsGraph graph={statistics?.combinedGraph || []} />
        <section className="grid gap-4 xl:grid-cols-2">
          {(statistics?.platformStats || []).map(item => <PlatformStatsGraph key={item.platform} platformStat={item} />)}
        </section>
      </div>
    </AppShell>
  );
}
