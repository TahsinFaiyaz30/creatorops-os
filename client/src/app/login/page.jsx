'use client';

/**
 * Login — converted from .tsx to .jsx by hand, types stripped.
 *
 * Every control on this page is an AnimatedButton now: the demo-account chips,
 * the password reveal and the submit. The submit previously used Aceternity's
 * StatefulButton, which ran its own spinner→check animation off the click
 * promise; that meant two different loading languages on one screen. It now
 * uses the shared `loading` state so the page matches the rest of the app.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Eye, EyeOff, LogIn } from 'lucide-react';

import { AuthShell, Field } from '../../components/auth/auth-shell';
import { AnimatedButton } from '../../components/ui/AnimatedButton';
import { HoverBorderGradient } from '../../components/ui/hover-border-gradient';
import { api } from '../../lib/api';
import { saveSession } from '../../lib/auth';
import { homePathForUser } from '../../lib/roles';

const DEMO_ACCOUNTS = [
  { label: 'Content Creator', email: 'creator@creatorops.dev', password: 'password123' },
  { label: 'Brand Rep',      email: 'brand@creatorops.dev',   password: 'password123' },
  { label: 'Admin',          email: 'admin@creatorops.dev',   password: 'password123' },
  { label: 'Creator Admin',  email: 'creator.admin@creatorops.dev', password: 'password123' },
  { label: 'Brand Admin',    email: 'brand.admin@creatorops.dev', password: 'password123' }
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const doLogin = async creds => {
    setBusy(creds.email);
    setError('');
    try {
      const payload = await api.post('/api/auth/login', creds);
      saveSession(payload);
      router.push(homePathForUser(payload.user));
    } catch (err) {
      setError(err?.message || 'Login failed. Check your credentials.');
    } finally {
      setBusy('');
    }
  };

  const anyBusy = Boolean(busy);

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your CreatorOps workspace."
      footer={
        <>
          <div className="mt-5">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--surface3)]" />
              <span className="text-xs text-[var(--muted)]">Demo accounts</span>
              <div className="h-px flex-1 bg-[var(--surface3)]" />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {DEMO_ACCOUNTS.map((account, i) => (
                <motion.div
                  key={account.email}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 + i * 0.05, duration: 0.5 }}
                >
                  <AnimatedButton
                    id={`demo-${account.label.toLowerCase().replace(/\s+/g, '-')}`}
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={anyBusy}
                    loading={busy === account.email}
                    onClick={() => doLogin(account)}
                    className="w-full rounded-full py-2.5 hover:border-[var(--accent-line)] hover:text-[var(--accent)]"
                  >
                    {busy === account.email ? null : account.label}
                  </AnimatedButton>
                </motion.div>
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
        onSubmit={event => {
          event.preventDefault();
          doLogin({ email, password });
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
          onChange={event => setEmail(event.target.value)}
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
            onChange={event => setPassword(event.target.value)}
            className="pr-11"
          />
          {/* top-[1.85rem] clears the label row; the field itself is 38px tall. */}
          <AnimatedButton
            type="button"
            variant="ghost"
            size="icon"
            tabIndex={-1}
            onClick={() => setShowPassword(value => !value)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-2 top-[1.95rem] z-10 rounded-full"
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </AnimatedButton>
        </div>

        {error ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger"
          >
            {error}
          </motion.div>
        ) : null}

        <AnimatedButton
          id="login-submit"
          type="submit"
          variant="primary"
          size="lg"
          disabled={anyBusy}
          loading={busy === email && Boolean(email)}
          className="w-full rounded-full"
        >
          {busy === email && email ? 'Signing in…' : (
            <>
              <LogIn size={15} />
              Sign in
            </>
          )}
        </AnimatedButton>
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
