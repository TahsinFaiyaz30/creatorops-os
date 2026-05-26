'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import BrandCircularCard from '../../components/circulars/BrandCircularCard';
import { api } from '../../lib/api';
import { getUser } from '../../lib/auth';

export default function BrandCircularsPage() {
  const [user, setUser] = useState(null);
  const [circulars, setCirculars] = useState([]);
  const [message, setMessage] = useState('');

  const load = async () => {
    const payload = await api.get('/api/brand-circulars');
    setCirculars(payload.data.circulars || []);
  };

  useEffect(() => {
    setUser(getUser());
    load().catch(err => setMessage(err.message));
  }, []);

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-mint">Brand representative workflow</p>
              <h1 className="mt-2 text-3xl font-bold text-[var(--text)]">Brand Circulars</h1>
              <p className="mt-2 max-w-4xl text-sm text-[var(--muted)]">Brand reps publish creator opportunities; creators apply with real synced stats where available.</p>
            </div>
            {user?.role === 'brand_rep' && (
              <Link href="/brand-circulars/create" className="focus-ring inline-flex items-center gap-2 rounded-xl bg-mint px-3 py-2 text-sm font-semibold text-[#05130d]">
                <Plus size={15} /> Create circular
              </Link>
            )}
          </div>
        </header>
        {message && <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--text)]">{message}</div>}
        <section className="grid gap-4 xl:grid-cols-2">
          {circulars.map(circular => <BrandCircularCard key={circular._id} circular={circular} />)}
          {circulars.length === 0 && <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">No circulars available.</p>}
        </section>
      </div>
    </AppShell>
  );
}
