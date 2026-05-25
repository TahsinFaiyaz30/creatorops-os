'use client';

import Link from 'next/link';
import { CalendarClock } from 'lucide-react';
import { formatPlatform } from '../../lib/platforms';

export default function BrandCircularCard({ circular }) {
  return (
    <article className="rounded-lg border border-line bg-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">{circular.title}</h2>
          <p className="mt-1 text-sm text-slate-400">{circular.productName} · {circular.productCategory || 'uncategorized'}</p>
        </div>
        <span className="rounded-full bg-cyan/10 px-2.5 py-1 text-xs font-semibold text-cyan">{circular.status}</span>
      </div>
      <p className="mt-3 line-clamp-3 text-sm text-slate-300">{circular.productDescription || circular.campaignObjective}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(circular.platforms || []).map(platform => <span key={platform} className="rounded-full bg-ink px-2 py-1 text-xs text-slate-300">{formatPlatform(platform)}</span>)}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1"><CalendarClock size={13} /> {circular.deadline ? new Date(circular.deadline).toLocaleString() : 'No deadline'}</span>
        <span>{circular.budgetAmount || 0} {circular.currency || 'USD'}</span>
      </div>
      <Link href={`/brand-circulars/${circular._id}`} className="focus-ring mt-4 inline-flex rounded-md border border-line px-3 py-2 text-sm text-slate-200 hover:bg-white/5">
        Open circular
      </Link>
    </article>
  );
}
