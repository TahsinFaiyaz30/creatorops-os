'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { api } from '../../lib/api';
import { getUser } from '../../lib/auth';
import { formatPlatform, platformOptions } from '../../lib/platforms';

const accountTypes = ['brand', 'creator', 'client', 'page', 'shop', 'blog'];
const statuses = ['connected', 'disconnected', 'expired', 'missing_permissions', 'blocked'];

export default function AccountsPage() {
  const [user, setUser] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [filters, setFilters] = useState({ platform: '', status: '' });
  const [form, setForm] = useState({
    platform: 'instagram',
    accountName: '',
    accountHandle: '',
    accountType: 'brand',
    status: 'connected'
  });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const payload = await api.get('/api/platform-accounts');
    setAccounts(payload.data.accounts || []);
  };

  useEffect(() => {
    setUser(getUser());
    load().catch(err => setMessage(err.message));
  }, []);

  const filteredAccounts = useMemo(
    () =>
      accounts.filter(account => {
        if (filters.platform && account.platform !== filters.platform) return false;
        if (filters.status && account.status !== filters.status) return false;
        return true;
      }),
    [accounts, filters]
  );

  const create = async event => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await api.post('/api/platform-accounts', form);
      setForm({ platform: 'instagram', accountName: '', accountHandle: '', accountType: 'brand', status: 'connected' });
      setMessage('Platform account created.');
      await load();
    } catch (err) {
      setMessage(err.status === 403 ? 'Backend blocked this action: only Creator/Admin can manage platform accounts.' : err.message);
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async account => {
    setBusy(true);
    setMessage('');
    try {
      await api.delete(`/api/platform-accounts/${account._id}`);
      setMessage('Platform account deactivated.');
      await load();
    } catch (err) {
      setMessage(err.status === 403 ? 'Backend blocked this action: only Creator/Admin can delete platform accounts.' : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="rounded-lg border border-line bg-panel p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-cyan">Simulated account management</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Platform Accounts</h1>
          <p className="mt-2 text-sm text-slate-400">Local connected account profiles for account-targeted publishing simulator jobs. No OAuth tokens or secrets are stored.</p>
        </header>

        <section className="grid gap-4 xl:grid-cols-[380px_1fr]">
          <form onSubmit={create} className="rounded-lg border border-line bg-panel p-4">
            <h2 className="text-base font-semibold text-white">Create Account</h2>
            <p className="mt-1 text-xs text-slate-400">Editors can try this; backend RBAC returns 403.</p>
            <div className="mt-4 grid gap-3">
              <select value={form.platform} onChange={event => setForm({ ...form, platform: event.target.value })} className="focus-ring rounded-md border border-line bg-ink px-3 py-2 text-sm text-white">
                {platformOptions.map(platform => <option key={platform} value={platform}>{formatPlatform(platform)}</option>)}
              </select>
              <input className="focus-ring rounded-md border border-line bg-ink px-3 py-2 text-sm text-white" placeholder="Account name" value={form.accountName} onChange={event => setForm({ ...form, accountName: event.target.value })} required />
              <input className="focus-ring rounded-md border border-line bg-ink px-3 py-2 text-sm text-white" placeholder="Account handle" value={form.accountHandle} onChange={event => setForm({ ...form, accountHandle: event.target.value })} required />
              <select value={form.accountType} onChange={event => setForm({ ...form, accountType: event.target.value })} className="focus-ring rounded-md border border-line bg-ink px-3 py-2 text-sm text-white">
                {accountTypes.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
              <select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })} className="focus-ring rounded-md border border-line bg-ink px-3 py-2 text-sm text-white">
                {statuses.map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            <button disabled={busy} className="focus-ring mt-4 inline-flex items-center gap-2 rounded-md bg-cyan px-4 py-2 text-sm font-semibold text-ink">
              <Plus size={16} />
              {busy ? 'Saving...' : 'Create account'}
            </button>
            {message && <p className="mt-3 text-sm text-slate-300">{message}</p>}
          </form>

          <div className="rounded-lg border border-line bg-panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-white">Workspace Accounts</h2>
              <div className="flex flex-wrap gap-2">
                <select value={filters.platform} onChange={event => setFilters({ ...filters, platform: event.target.value })} className="focus-ring rounded-md border border-line bg-ink px-3 py-2 text-xs text-white">
                  <option value="">All platforms</option>
                  {platformOptions.map(platform => <option key={platform} value={platform}>{formatPlatform(platform)}</option>)}
                </select>
                <select value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value })} className="focus-ring rounded-md border border-line bg-ink px-3 py-2 text-xs text-white">
                  <option value="">All statuses</option>
                  {statuses.map(status => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              {filteredAccounts.map(account => (
                <article key={account._id} className="rounded-md border border-line bg-ink p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{account.accountName}</div>
                      <div className="mt-1 text-xs text-slate-400">{account.accountHandle}</div>
                    </div>
                    <span className="rounded-full bg-cyan/10 px-2.5 py-1 text-xs text-cyan">{formatPlatform(account.platform)}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                    <span className="rounded-full bg-panel px-2 py-1">{account.accountType}</span>
                    <span className="rounded-full bg-panel px-2 py-1">{account.status}</span>
                    <span className="rounded-full bg-panel px-2 py-1">{account.isActive ? 'active' : 'inactive'}</span>
                  </div>
                  {user?.role === 'creator_admin' && account.isActive && (
                    <button type="button" onClick={() => deactivate(account)} disabled={busy} className="focus-ring mt-3 inline-flex items-center gap-2 rounded-md border border-rose/40 px-3 py-2 text-xs text-rose hover:bg-rose/10">
                      <Trash2 size={14} />
                      Deactivate
                    </button>
                  )}
                </article>
              ))}
              {filteredAccounts.length === 0 && <p className="text-sm text-slate-400">No accounts match these filters.</p>}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
