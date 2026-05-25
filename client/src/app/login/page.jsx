'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { api } from '../../lib/api';
import { saveSession } from '../../lib/auth';

const demos = [
  { label: 'Login as Editor', email: 'editor@creatorops.dev', password: 'password123' },
  { label: 'Login as Creator/Admin', email: 'admin@creatorops.dev', password: 'password123' },
  { label: 'Login as Brand Rep', email: 'brand@creatorops.dev', password: 'password123' }
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('editor@creatorops.dev');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const login = async (credentials = { email, password }) => {
    setBusy(true);
    setError('');
    try {
      const payload = await api.post('/api/auth/login', credentials);
      saveSession(payload);
      router.push('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink p-6 text-slate-100">
      <section className="w-full max-w-md rounded-lg border border-line bg-panel p-6 shadow-soft">
        <div className="mb-6">
          <div className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan">CreatorOps OS</div>
          <h1 className="mt-3 text-3xl font-bold text-white">Demo login</h1>
          <p className="mt-2 text-sm text-slate-400">Use the seeded accounts to run the full workflow.</p>
        </div>

        <form
          onSubmit={event => {
            event.preventDefault();
            login();
          }}
          className="space-y-3"
        >
          <input
            className="focus-ring w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-white"
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder="Email"
            type="email"
          />
          <input
            className="focus-ring w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-white"
            value={password}
            onChange={event => setPassword(event.target.value)}
            placeholder="Password"
            type="password"
          />
          {error && <p className="text-sm text-rose">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-md bg-cyan px-4 py-2 font-semibold text-ink"
          >
            <LogIn size={17} />
            {busy ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="mt-5 grid gap-2">
          {demos.map(demo => (
            <button
              key={demo.email}
              type="button"
              onClick={() => login(demo)}
              className="focus-ring rounded-md border border-line px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
            >
              {demo.label}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
