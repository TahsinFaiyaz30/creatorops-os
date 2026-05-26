'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../../../components/layout/AppShell';
import BrandCircularForm from '../../../components/circulars/BrandCircularForm';
import { api } from '../../../lib/api';

export default function CreateBrandCircularPage() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async form => {
    setBusy(true);
    setMessage('');
    try {
      const payload = await api.post('/api/brand-circulars', form);
      router.push(`/brand-circulars/${payload.data.circular._id}`);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-mint">New opportunity</p>
          <h1 className="mt-2 text-3xl font-bold text-[var(--text)]">Create Brand Circular</h1>
        </header>
        {message && <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--text)]">{message}</div>}
        <BrandCircularForm onSubmit={submit} busy={busy} />
      </div>
    </AppShell>
  );
}
