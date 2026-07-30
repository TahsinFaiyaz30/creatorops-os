'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Eye, EyeOff, LogIn } from 'lucide-react';

import { AuthShell, Field } from '../../components/auth/auth-shell';
import { Button as StatefulButton } from '../../components/ui/stateful-button';
import { HoverBorderGradient } from '../../components/ui/hover-border-gradient';
import { api } from '../../lib/api';
import { saveSession } from '../../lib/auth';
import { homePathForUser } from '../../lib/roles';

const DEMO_ACCOUNTS = [
  { label: 'Content Creator', email: 'creator@creatorops.dev', password: 'password123' },
  { label: 'Brand Rep',      email: 'brand@creatorops.dev',   password: 'password123' },
  { label: 'Admin',          email: 'admin@creatorops.dev',   password: 'password123' },
  { label: 'Creator Admin',  email: 'creator.admin@creatorops.dev', password: 'password123' },
  { label: 'Brand Admin',    email: 'brand.admin@creatorops.dev', password: 'password123' },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const doLogin = async (creds: { email: string; password: string }) => {
    setBusy(true);
    setError('');
    try {
      const payload = await api.post('/api/auth/login', creds);
      saveSession(payload);
      router.push(homePathForUser(payload.user));
    } catch (err: any) {
      setError(err?.message || 'Login failed. Check your credentials.');
      // Re-thrown so <StatefulButton> can reset out of its loading state.
      throw err;
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your CreatorOps workspace."
      footer={
        <>
          {/* Demo accounts */}
          <div className="mt-5">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--surface3)]" />
              <span className="text-xs text-[var(--muted)]">Demo accounts</span>
              <div className="h-px flex-1 bg-[var(--surface3)]" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {DEMO_ACCOUNTS.map((d, i) => (
                <motion.button
                  key={d.email}
                  id={`demo-${d.label.toLowerCase().replace(/\s+/g, '-')}`}
                  type="button"
                  disabled={busy}
                  onClick={() => doLogin(d).catch(() => {})}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 + i * 0.05, duration: 0.5 }}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  className="focus-ring rounded-xl border border-[var(--border)] bg-[var(--surface2)] py-2.5 text-xs font-medium text-[var(--muted)] transition-colors hover:border-[var(--accent-line)] hover:text-[var(--accent)] disabled:opacity-40"
                >
                  {d.label}
                </motion.button>
              ))}
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-[var(--muted)]">
            New here?{' '}
            <Link href="/signup" className="font-semibold text-[var(--accent)] hover:underline">
              Create an account
            </Link>
          </p>
        </>
      }
    >
      <form
        onSubmit={e => {
          e.preventDefault();
          doLogin({ email, password }).catch(() => {});
        }}
        className="mt-5 space-y-4"
      >
        <Field
          id="login-email"
          label="Email address"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />

        <div className="relative">
          <Field
            id="login-password"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="pr-11"
          />
          <button
            type="button"
            onClick={() => setShowPassword(s => !s)}
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-[2.1rem] text-[var(--muted)] transition-colors hover:text-[var(--text)]"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger"
          >
            {error}
          </motion.div>
        )}

        {/* Aceternity stateful button — spinner → check, driven by the real request.
            preventDefault stops the native submit so clicking runs this handler
            only, while the Enter key still goes through the form's onSubmit. */}
        <StatefulButton
          id="login-submit"
          type="submit"
          disabled={busy}
          onClick={async e => {
            e.preventDefault();
            await doLogin({ email, password });
          }}
          className="w-full bg-[var(--accent)] text-[var(--accent-fg)] hover:brightness-110 hover:ring-[var(--ring)]"
        >
          <span className="flex items-center gap-2">
            <LogIn size={15} /> Sign in
          </span>
        </StatefulButton>
      </form>

      <div className="mt-5 flex justify-center">
        <HoverBorderGradient
          as="div"
          containerClassName="rounded-full"
          className="bg-[var(--surface)] px-4 py-1.5 text-[11px] text-[var(--muted)]"
        >
          Protected workspace · roles enforced server-side
        </HoverBorderGradient>
      </div>
    </AuthShell>
  );
}
