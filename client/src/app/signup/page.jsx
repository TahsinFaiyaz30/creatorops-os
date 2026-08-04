'use client';

/** Signup — converted from .tsx to .jsx by hand, types stripped. */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Eye, EyeOff, UserPlus } from 'lucide-react';

import { AuthSplitShell } from '../../components/auth/auth-split-shell';
import { Field } from '../../components/auth/auth-shell';
import { AnimatedButton } from '../../components/ui/AnimatedButton';
import { api } from '../../lib/api';
import { saveSession } from '../../lib/auth';
import { ROLES, homePathForUser } from '../../lib/roles';

const ROLE_CHOICES = [
  {
    value: ROLES.CONTENT_CREATOR,
    title: 'Content Creator',
    blurb: 'Manage the full creator workflow — scripting, repurposing, publishing.'
  },
  {
    value: ROLES.BRAND_REP,
    title: 'Brand Representative',
    blurb: 'Manage circulars, connected accounts, and campaign publishing.'
  }
];

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [role, setRole] = useState(ROLES.CONTENT_CREATOR);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const doSignup = async () => {
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.post('/api/auth/register', { name, email, password, role });
      setNotice('Account created! Signing you in…');
      const payload = await api.post('/api/auth/login', { email, password });
      saveSession(payload);
      router.push(homePathForUser(payload.user));
    } catch (err) {
      setError(err?.message || 'Registration failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthSplitShell
      title="Create your account"
      subtitle="Start your creator workflow in seconds."
      footer={
        <p className="mt-4 text-center text-[13px] text-[var(--muted)]">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-[var(--accent)] hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form
        onSubmit={event => {
          event.preventDefault();
          doSignup();
        }}
        className="mt-4 space-y-3"
      >
        <Field
          id="signup-name"
          label="Full name"
          type="text"
          required
          autoComplete="name"
          placeholder="Your name"
          value={name}
          onChange={event => setName(event.target.value)}
        />

        <Field
          id="signup-email"
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
            id="signup-password"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="new-password"
            placeholder="Min. 8 characters"
            value={password}
            onChange={event => setPassword(event.target.value)}
            className="pr-11"
          />
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

        <Field
          id="signup-confirm"
          label="Confirm password"
          type={showPassword ? 'text' : 'password'}
          required
          autoComplete="new-password"
          placeholder="Repeat password"
          value={confirm}
          onChange={event => setConfirm(event.target.value)}
        />

        {/* Role picker — animated selectable cards */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="signup-role" className="text-xs font-medium text-[var(--muted)]">
            I am a…
          </label>
          <div id="signup-role" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ROLE_CHOICES.map(choice => {
              const active = role === choice.value;
              return (
                <motion.button
                  key={choice.value}
                  type="button"
                  onClick={() => setRole(choice.value)}
                  aria-pressed={active}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`focus-ring relative overflow-hidden rounded-xl border p-2.5 text-left transition-colors ${
                    active
                      ? 'border-[var(--accent-line)] bg-[var(--accent-soft)]'
                      : 'border-[var(--border)] bg-[var(--surface2)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  {active ? (
                    <motion.span
                      layoutId="role-glow"
                      className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(174,72,255,0.22),transparent_70%)]"
                      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                    />
                  ) : null}
                  <span className="relative block text-sm font-semibold text-[var(--text)]">
                    {choice.title}
                  </span>
                  <span className="relative mt-1 block text-[11px] leading-snug text-[var(--muted)]">
                    {choice.blurb}
                  </span>
                </motion.button>
              );
            })}
          </div>
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

        {notice ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="rounded-lg border border-success/30 bg-success/10 px-4 py-2.5 text-sm text-success"
          >
            {notice}
          </motion.div>
        ) : null}

        <AnimatedButton
          id="signup-submit"
          type="submit"
          variant="primary"
          size="lg"
          disabled={busy}
          loading={busy}
          className="w-full rounded-full"
        >
          {busy ? 'Creating account…' : (
            <>
              <UserPlus size={15} />
              Create account
            </>
          )}
        </AnimatedButton>
      </form>
    </AuthSplitShell>
  );
}
