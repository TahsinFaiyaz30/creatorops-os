'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Sign in.
 *
 * The page used to carry five one-click demo accounts with their passwords in
 * the source. That is a set of live credentials published to anyone who opens
 * the page, and it made the real form the smaller half of its own screen. Gone.
 *
 * What remains is one form: email, password, submit — plus the routes out, to
 * signup and back to the marketing site.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Eye, EyeOff, LogIn } from 'lucide-react';

import { AuthShell, Field } from '../../components/auth/auth-shell';
import { AnimatedButton } from '../../components/ui/AnimatedButton';
import { api } from '../../lib/api';
import { saveSession } from '../../lib/auth';
import { homePathForUser } from '../../lib/roles';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = await api.post('/api/auth/login', { email, password });
      saveSession(payload);
      router.push(homePathForUser(payload.user));
    } catch (err) {
      setError(err?.message || 'Login failed. Check your credentials.');
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your CreatorOps workspace."
      footer={
        <p className="mt-6 text-center text-sm text-[var(--muted)]">
          New here?{' '}
          <Link href="/signup" className="font-semibold text-[var(--accent)] hover:underline">
            Create an account
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="mt-6 space-y-4">
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
          {/* top-[1.95rem] clears the label row; the field itself is 38px tall. */}
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
            role="alert"
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
          loading={busy}
          className="w-full rounded-full"
        >
          {busy ? 'Signing in…' : (
            <>
              <LogIn size={15} />
              Sign in
            </>
          )}
        </AnimatedButton>

        <p className="pt-1 text-center text-[11px] text-[var(--muted)]">
          Roles and permissions are enforced server-side.
        </p>
      </form>
    </AuthShell>
  );
}
