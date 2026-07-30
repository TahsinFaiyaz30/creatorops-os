'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Eye, EyeOff, UserPlus } from 'lucide-react';

import { AuthShell, Field } from '../../components/auth/auth-shell';
import { Button as StatefulButton } from '../../components/ui/stateful-button';
import { Label } from '../../components/ui/label';
import { api } from '../../lib/api';
import { saveSession } from '../../lib/auth';
import { ROLES, homePathForUser } from '../../lib/roles';

const ROLE_CHOICES = [
  {
    value: ROLES.CONTENT_CREATOR,
    title: 'Content Creator',
    blurb: 'Manage the full creator workflow — scripting, repurposing, publishing.',
  },
  {
    value: ROLES.BRAND_REP,
    title: 'Brand Representative',
    blurb: 'Manage circulars, connected accounts, and campaign publishing.',
  },
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
      throw new Error('mismatch');
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      throw new Error('too-short');
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
    } catch (err: any) {
      setError(err?.message || 'Registration failed.');
      throw err;
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start your creator workflow in seconds."
      footer={
        <p className="mt-6 text-center text-sm text-[var(--muted)]">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-[var(--accent)] hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form
        onSubmit={e => {
          e.preventDefault();
          doSignup().catch(() => {});
        }}
        className="mt-5 space-y-4"
      >
        <Field
          id="signup-name"
          label="Full name"
          type="text"
          required
          autoComplete="name"
          placeholder="Your name"
          value={name}
          onChange={e => setName(e.target.value)}
        />

        <Field
          id="signup-email"
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
            id="signup-password"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="new-password"
            placeholder="Min. 8 characters"
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

        <Field
          id="signup-confirm"
          label="Confirm password"
          type={showPassword ? 'text' : 'password'}
          required
          autoComplete="new-password"
          placeholder="Repeat password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
        />

        {/* Role picker — animated selectable cards */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="signup-role" className="text-xs font-medium text-[var(--muted)]">
            I am a…
          </Label>
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
                  className={`focus-ring relative overflow-hidden rounded-xl border p-3 text-left transition-colors ${
                    active
                      ? 'border-[var(--accent-line)] bg-[var(--accent-soft)]'
                      : 'border-[var(--border)] bg-[var(--surface2)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="role-glow"
                      className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(174,72,255,0.22),transparent_70%)]"
                      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                    />
                  )}
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

        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger"
          >
            {error}
          </motion.div>
        )}
        {notice && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="rounded-lg border border-success/30 bg-success/10 px-4 py-2.5 text-sm text-success"
          >
            {notice}
          </motion.div>
        )}

        <StatefulButton
          id="signup-submit"
          type="submit"
          disabled={busy}
          onClick={async e => {
            e.preventDefault();
            await doSignup();
          }}
          className="w-full bg-[var(--accent)] text-[var(--accent-fg)] hover:brightness-110 hover:ring-[var(--ring)]"
        >
          <span className="flex items-center gap-2">
            <UserPlus size={15} /> Create account
          </span>
        </StatefulButton>
      </form>
    </AuthShell>
  );
}
