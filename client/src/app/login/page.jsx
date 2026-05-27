'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, LogIn, UserPlus, Zap } from 'lucide-react';
import SiteLogo from '../../components/layout/SiteLogo';
import { api } from '../../lib/api';
import { saveSession } from '../../lib/auth';
import { ROLES, homePathForUser } from '../../lib/roles';

const DEMO_ACCOUNTS = [
  { label: 'Content Creator', email: 'creator@creatorops.dev', password: 'password123' },
  { label: 'Brand Rep',      email: 'brand@creatorops.dev',   password: 'password123' },
  { label: 'Admin',          email: 'admin@creatorops.dev',   password: 'password123' },
  { label: 'Creator Admin',  email: 'creator.admin@creatorops.dev', password: 'password123' },
  { label: 'Brand Admin',    email: 'brand.admin@creatorops.dev', password: 'password123' },
];

const FEATURES = [
  'AI-powered multi-platform content generation',
  'Creator review workflow (RBAC)',
  'Real OAuth platform connections',
  'Live publishing pipeline with validation',
  'Brand circulars & creator applications',
  'Real-time workflow event feed',
];

function PasswordInput({ value, onChange, placeholder, id }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={id === 'signup-password' ? 'new-password' : 'current-password'}
        required
        className="focus-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-3 pr-11 text-sm text-[var(--text)] placeholder-[var(--muted)] transition focus:border-mint"
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)]"
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState('login'); // 'login' | 'signup'

  // Login state
  const [loginEmail,    setLoginEmail]    = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup state
  const [signupName,     setSignupName]     = useState('');
  const [signupEmail,    setSignupEmail]    = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm,  setSignupConfirm]  = useState('');
  const [signupRole,     setSignupRole]     = useState(ROLES.CONTENT_CREATOR);

  const [error,  setError]  = useState('');
  const [busy,   setBusy]   = useState(false);
  const [notice, setNotice] = useState('');

  const doLogin = async (creds) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const payload = await api.post('/api/auth/login', creds);
      saveSession(payload);
      router.push(homePathForUser(payload.user));
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.');
    } finally { setBusy(false); }
  };

  const doSignup = async (e) => {
    e.preventDefault();
    if (signupPassword !== signupConfirm) { setError('Passwords do not match.'); return; }
    if (signupPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      await api.post('/api/auth/register', {
        name: signupName, email: signupEmail,
        password: signupPassword, role: signupRole,
      });
      setNotice('Account created! Signing you in…');
      await doLogin({ email: signupEmail, password: signupPassword });
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally { setBusy(false); }
  };

  return (
    <main className="flex min-h-screen bg-[var(--bg)]">
      {/* ── Left branding panel (hidden on small screens) ─────────────────── */}
      <div className="hidden lg:flex lg:w-[46%] flex-col justify-between bg-gradient-to-br from-[#05130d] via-[#0a2318] to-[#061811] p-12 text-white">
        <SiteLogo size="lg" />

        <div>
          <h1 className="text-3xl font-bold leading-snug text-white">
            The Operating System<br />for Creator Teams
          </h1>
          <p className="mt-4 text-base text-slate-400 leading-relaxed max-w-sm">
            One raw idea → platform-ready content → creator review → live publishing. All in one workflow.
          </p>
          <ul className="mt-8 space-y-3">
            {FEATURES.map(f => (
              <li key={f} className="flex items-center gap-3 text-sm text-slate-300">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mint/20 text-mint">
                  <Zap size={11} />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-slate-600">UIU Developers HUB Hackathon 2026</p>
      </div>

      {/* ── Right auth panel ───────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-10">
        {/* Mobile logo */}
        <SiteLogo size="md" className="mb-8 justify-center lg:hidden" />

        <div className="w-full max-w-md animate-fade-in">
          {/* Tab switcher */}
          <div className="mb-6 flex rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
            {[
              { key: 'login',  label: 'Sign In',  Icon: LogIn },
              { key: 'signup', label: 'Sign Up',  Icon: UserPlus },
            ].map(({ key, label, Icon }) => (
              <button
                key={key}
                id={`auth-tab-${key}`}
                type="button"
                onClick={() => { setTab(key); setError(''); setNotice(''); }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all
                  ${tab === key
                    ? 'bg-mint text-[#05130d] shadow'
                    : 'text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>

          {/* Card */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-7 shadow-soft">
            <h2 className="text-xl font-bold text-[var(--text)]">
              {tab === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {tab === 'login'
                ? 'Sign in to your CreatorOps workspace.'
                : 'Start your creator workflow in seconds.'}
            </p>

            {error  && <div className="mt-4 rounded-lg border border-rose/30 bg-rose/10 px-4 py-2.5 text-sm text-rose">{error}</div>}
            {notice && <div className="mt-4 rounded-lg border border-mint/30 bg-mint/10 px-4 py-2.5 text-sm text-mint">{notice}</div>}

            {/* ── Login form ─────────────────────────────────────────────── */}
            {tab === 'login' && (
              <form
                onSubmit={e => { e.preventDefault(); doLogin({ email: loginEmail, password: loginPassword }); }}
                className="mt-5 space-y-4"
              >
                <div>
                  <label htmlFor="login-email" className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Email address</label>
                  <input
                    id="login-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="focus-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-3 text-sm text-[var(--text)] placeholder-[var(--muted)] transition focus:border-mint"
                  />
                </div>
                <div>
                  <label htmlFor="login-password" className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Password</label>
                  <PasswordInput
                    id="login-password"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <button
                  id="login-submit"
                  type="submit"
                  disabled={busy}
                  className="focus-ring mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-mint py-3 text-sm font-bold text-[#05130d] shadow transition hover:brightness-110 disabled:opacity-50"
                >
                  {busy ? <Loader2 size={16} className="animate-spin-slow" /> : <LogIn size={16} />}
                  {busy ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            )}

            {/* ── Sign up form ───────────────────────────────────────────── */}
            {tab === 'signup' && (
              <form onSubmit={doSignup} className="mt-5 space-y-4">
                <div>
                  <label htmlFor="signup-name" className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Full name</label>
                  <input
                    id="signup-name"
                    type="text"
                    required
                    autoComplete="name"
                    value={signupName}
                    onChange={e => setSignupName(e.target.value)}
                    placeholder="Your name"
                    className="focus-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-3 text-sm text-[var(--text)] placeholder-[var(--muted)] transition focus:border-mint"
                  />
                </div>
                <div>
                  <label htmlFor="signup-email" className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Email address</label>
                  <input
                    id="signup-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={signupEmail}
                    onChange={e => setSignupEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="focus-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-3 text-sm text-[var(--text)] placeholder-[var(--muted)] transition focus:border-mint"
                  />
                </div>
                <div>
                  <label htmlFor="signup-password" className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Password</label>
                  <PasswordInput
                    id="signup-password"
                    value={signupPassword}
                    onChange={e => setSignupPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                  />
                </div>
                <div>
                  <label htmlFor="signup-confirm" className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Confirm password</label>
                  <PasswordInput
                    id="signup-confirm"
                    value={signupConfirm}
                    onChange={e => setSignupConfirm(e.target.value)}
                    placeholder="Repeat password"
                  />
                </div>
                <div>
                  <label htmlFor="signup-role" className="mb-1.5 block text-xs font-medium text-[var(--muted)]">I am a…</label>
                  <select
                    id="signup-role"
                    value={signupRole}
                    onChange={e => setSignupRole(e.target.value)}
                    className="focus-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-3 text-sm text-[var(--text)] transition focus:border-mint"
                  >
                    <option value={ROLES.CONTENT_CREATOR}>Content Creator</option>
                    <option value={ROLES.BRAND_REP}>Brand Representative</option>
                  </select>
                  <p className="mt-1.5 text-xs text-[var(--muted)]">Content creators manage the full creator workflow. Brand representatives manage circulars, accounts, and publishing.</p>
                </div>
                <button
                  id="signup-submit"
                  type="submit"
                  disabled={busy}
                  className="focus-ring mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-mint py-3 text-sm font-bold text-[#05130d] shadow transition hover:brightness-110 disabled:opacity-50"
                >
                  {busy ? <Loader2 size={16} className="animate-spin-slow" /> : <UserPlus size={16} />}
                  {busy ? 'Creating account…' : 'Create account'}
                </button>
              </form>
            )}
          </div>

          {/* Demo accounts */}
          <div className="mt-5">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--border)]" />
              <span className="text-xs text-[var(--muted)]">Demo accounts</span>
              <div className="h-px flex-1 bg-[var(--border)]" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {DEMO_ACCOUNTS.map(d => (
                <button
                  key={d.email}
                  id={`demo-${d.label.toLowerCase().replace(/\s+/g, '-')}`}
                  type="button"
                  disabled={busy}
                  onClick={() => doLogin(d)}
                  className="focus-ring rounded-xl border border-[var(--border)] bg-[var(--surface)] py-2.5 text-xs font-medium text-[var(--muted)] transition hover:border-mint/50 hover:text-mint disabled:opacity-40"
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
