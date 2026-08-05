'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Connections — GET /api/platform-connections{,/status}, GET /api/oauth/:p/start,
 * POST /:id/{disconnect,health-check,refresh}, DELETE /:id
 *
 * Wires POST /api/platform-connections/:id/refresh, which no client code called.
 * Access tokens expire; without it the only recovery was disconnecting and
 * running the whole OAuth dance again. Token expiry is now shown on the card, so
 * you can see a connection going stale before it fails mid-publish.
 *
 * Also surfaces what the status payload already returned and the old page threw
 * away: missingEnvNames, requiredScopes, callbackUrl, blockedReason — the exact
 * reasons a platform can't be connected, instead of a bare "not configured".
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  RefreshCw, ShieldAlert, Unplug, Plus, Trash2, Plug,
  Search, Check, X, KeyRound, Clock, Activity, Link2, Copy, ChevronDown,
  Send, CalendarClock, BarChart3, MessageSquare, CornerDownRight, Upload,
  AlertTriangle, CircleCheck
} from 'lucide-react';

import AppShell from '../../components/layout/AppShell';
import { TextGenerateEffect } from '../../components/ui/text-generate-effect';
import { BackgroundBeams } from '../../components/ui/background-beams';
import {
  Page, Section, Badge, Button, Input,
  EmptyState, Skeleton, Notice, GlareStat, GlareStatGrid, GLARE_TINTS
} from '../../components/ds';
import { api } from '../../lib/api';
import { formatPlatform } from '../../lib/platforms';

const EASE = [0.16, 1, 0.3, 1];

const MARKS = {
  facebook: 'Fb', instagram: 'Ig', tiktok: 'Tt', youtube: 'Yt',
  youtube_shorts: 'Sh', threads: 'Th', linkedin: 'In', x: 'X',
  pinterest: 'Pi', wordpress: 'Wp', shopify: 'Sp'
};

const CAPS = [
  { key: 'publish', label: 'Publish', icon: Send },
  { key: 'schedule', label: 'Schedule', icon: CalendarClock },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'comments', label: 'Comments', icon: MessageSquare },
  { key: 'replies', label: 'Replies', icon: CornerDownRight },
  { key: 'mediaUpload', label: 'Upload', icon: Upload },
  { key: 'delete', label: 'Delete', icon: Trash2 }
];

const STATUS_TONE = {
  connected: 'success', active: 'success',
  expired: 'warning', degraded: 'warning',
  revoked: 'danger', error: 'danger', disconnected: 'neutral'
};

/* Token expiry, expressed as urgency rather than a raw date. */
const expiryInfo = iso => {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor(ms / 3600000);
  if (ms <= 0) return { tone: 'danger', label: 'Token expired' };
  if (hours < 24) return { tone: 'danger', label: `Expires in ${hours}h` };
  if (days < 7) return { tone: 'warning', label: `Expires in ${days}d` };
  return { tone: 'neutral', label: `Valid ${days}d` };
};

/* ── Connected account card ───────────────────────────────────────────────── */

function AccountCard({ account, busy, onDisconnect, onDelete, onHealth, onRefresh, onReconnect }) {
  const platform = account.platformData?.platform || account.platform;
  const exp = expiryInfo(account.tokenExpiresAt);
  const caps = account.capabilities || account.platformData?.capabilities || {};
  const hasError = Boolean(account.lastErrorCode || account.lastErrorMessage);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/75 shadow-[var(--shadow)] backdrop-blur-xl"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_70%_at_0%_0%,var(--accent-soft),transparent_55%)]"
      />
      <div className="relative space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--accent-line)] bg-[var(--accent-soft)] text-xs font-bold text-[var(--accent)]">
              {MARKS[platform] || String(platform).slice(0, 2)}
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold tracking-tight text-[var(--text)]">
                {account.accountName || formatPlatform(platform)}
              </h3>
              <p className="truncate text-[10px] text-[var(--muted)]">
                {account.accountHandle ? `@${account.accountHandle}` : formatPlatform(platform)}
                {account.accountType ? ` · ${account.accountType}` : ''}
              </p>
            </div>
          </div>
          <Badge tone={STATUS_TONE[account.status] || 'neutral'}>{account.status || 'unknown'}</Badge>
        </div>

        {/* Health strip */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-2.5 py-1.5">
            <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-[var(--muted)]">
              <KeyRound className="h-2.5 w-2.5" /> Token
            </p>
            <p className={`mt-0.5 text-[11px] font-semibold ${
              exp?.tone === 'danger' ? 'text-danger' : exp?.tone === 'warning' ? 'text-warning' : 'text-[var(--text)]'
            }`}>
              {exp?.label || 'No expiry'}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-2.5 py-1.5">
            <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-[var(--muted)]">
              <Activity className="h-2.5 w-2.5" /> Last check
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-[var(--text)]">
              {account.lastHealthCheckAt
                ? new Date(account.lastHealthCheckAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                : 'Never'}
            </p>
          </div>
        </div>

        {/* Capability dots */}
        <div className="flex flex-wrap gap-1">
          {CAPS.map(c => (
            <span
              key={c.key}
              title={`${c.label}: ${caps[c.key] ? 'available' : 'unavailable'}`}
              className={`flex h-6 w-6 items-center justify-center rounded-md border ${
                caps[c.key]
                  ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'border-[var(--border)] bg-[var(--surface2)] text-[var(--muted)] opacity-40'
              }`}
            >
              <c.icon className="h-3 w-3" />
            </span>
          ))}
        </div>

        {account.missingScopes?.length ? (
          <div className="rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-1.5">
            <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-warning">
              <ShieldAlert className="h-2.5 w-2.5" /> Missing scopes
            </p>
            <p className="mt-0.5 font-mono text-[10px] leading-relaxed text-warning/90">
              {account.missingScopes.join(', ')}
            </p>
          </div>
        ) : null}

        {hasError ? (
          <div className="rounded-lg border border-danger/30 bg-danger/10 px-2.5 py-1.5">
            <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-danger">
              <AlertTriangle className="h-2.5 w-2.5" /> {account.lastErrorCode || 'Error'}
            </p>
            {account.lastErrorMessage ? (
              <p className="mt-0.5 text-[10px] leading-relaxed text-danger/90">{account.lastErrorMessage}</p>
            ) : null}
          </div>
        ) : null}

        {/* Controls */}
        <div className="flex flex-wrap gap-1.5 border-t border-[var(--border)] pt-2.5">
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => onHealth(account)}>
            <Activity className="h-3.5 w-3.5" /> Health
          </Button>
          {/* POST /:id/refresh — previously unwired */}
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => onRefresh(account)}>
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} /> Refresh token
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => onReconnect(account)}>
            <Plug className="h-3.5 w-3.5" /> Reconnect
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => onDisconnect(account)}>
            <Unplug className="h-3.5 w-3.5" /> Disconnect
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={busy}
            onClick={() => onDelete(account)}
            aria-label={`Delete ${account.accountName || formatPlatform(platform)} connection`}
            title="Delete connection"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </motion.article>
  );
}

/* ── Available platform card ──────────────────────────────────────────────── */

function PlatformCard({ platform, busy, onConnect, expanded, onToggle }) {
  const ready = platform.configured && platform.connectAllowedForCurrentUser;
  const caps = platform.capabilities || {};

  return (
    <motion.article
      layout
      className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 backdrop-blur-xl"
    >
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${
                ready
                  ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'border-[var(--border)] bg-[var(--surface2)] text-[var(--muted)]'
              }`}
            >
              {MARKS[platform.platform] || platform.platform.slice(0, 2)}
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold tracking-tight text-[var(--text)]">
                {platform.displayName || formatPlatform(platform.platform)}
              </h3>
              <p className="truncate text-[10px] text-[var(--muted)]">{platform.helperText}</p>
            </div>
          </div>
          <Badge tone={ready ? 'success' : 'warning'}>
            {ready ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
            {platform.configured ? 'ready' : 'not set up'}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-1">
          {CAPS.map(c => (
            <span
              key={c.key}
              title={c.label}
              className={caps[c.key] ? 'text-[var(--accent)]' : 'text-[var(--muted)] opacity-30'}
            >
              <c.icon className="h-3 w-3" />
            </span>
          ))}
          <span className="ml-auto flex items-center gap-1 text-[10px] text-[var(--muted)]">
            <Plug className="h-2.5 w-2.5" />
            {platform.connectedCount || 0} linked
          </span>
        </div>

        {/* The exact blocker, not a bare "not configured" */}
        {platform.blockedReason ? (
          <div className="rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-1.5">
            <p className="text-[10px] leading-relaxed text-warning">{platform.blockedReason}</p>
          </div>
        ) : null}

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant={ready ? 'primary' : 'secondary'}
            disabled={busy || !ready}
            onClick={() => onConnect(platform)}
            className="flex-1"
          >
            {busy ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {ready ? 'Connect' : 'Unavailable'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onToggle(platform.platform)}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Hide' : 'Show'} setup details for ${platform.displayName || platform.platform}`}
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </Button>
        </div>

        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="space-y-2 overflow-hidden"
            >
              {platform.missingEnvNames?.length ? (
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Missing env
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] leading-relaxed text-warning">
                    {platform.missingEnvNames.join(', ')}
                  </p>
                </div>
              ) : null}
              {platform.requiredScopes?.length ? (
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    OAuth scopes
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] leading-relaxed text-[var(--text-2)]">
                    {platform.requiredScopes.join(', ')}
                  </p>
                </div>
              ) : null}
              {platform.callbackUrl ? (
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Callback URL
                  </p>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(platform.callbackUrl)}
                    className="focus-ring mt-0.5 flex w-full items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--surface2)] px-2 py-1 text-left font-mono text-[9px] text-[var(--text-2)] transition-colors hover:border-[var(--accent-line)]"
                    title="Copy"
                  >
                    <Copy className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">{platform.callbackUrl}</span>
                  </button>
                </div>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function AccountsPage() {
  const [platforms, setPlatforms] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busyPlatform, setBusyPlatform] = useState('');
  const [busyConnection, setBusyConnection] = useState('');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState({});

  const load = async () => {
    const [statusPayload] = await Promise.all([
      api.get('/api/platform-connections/status'),
      api.get('/api/platform-connections')
    ]);
    setPlatforms(statusPayload.data.platforms || []);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const err = params.get('error');
    const platform = params.get('platform');
    const label = platform ? formatPlatform(platform) : 'Account';
    if (success) setMessage(`${label} OAuth connection saved. Refreshing real connection status.`);
    else if (err) setError(`${label} OAuth error: ${err}`);
    load().catch(e => setError(e.message));
  }, []);

  const connectedAccounts = useMemo(() => {
    const out = [];
    (platforms || []).forEach(p =>
      (p.connections || []).forEach(c => out.push({ ...c, platformData: p }))
    );
    return out;
  }, [platforms]);

  const connect = async platform => {
    setBusyPlatform(platform.platform);
    setError('');
    try {
      const payload = await api.get(`/api/oauth/${platform.platform}/start`);
      if (payload.data.authorizationUrl) {
        window.location.href = payload.data.authorizationUrl;
        return;
      }
      setMessage(payload.data.message || 'Connection verified.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyPlatform('');
    }
  };

  const runOnConnection = async (connection, fn, okMessage) => {
    setBusyConnection(connection._id);
    setError('');
    setMessage('');
    try {
      await fn();
      setMessage(okMessage);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyConnection('');
    }
  };

  const disconnect = c =>
    runOnConnection(c, () => api.post(`/api/platform-connections/${c._id}/disconnect`, {}), 'Connection disconnected.');
  const deleteConnection = c =>
    runOnConnection(c, () => api.delete(`/api/platform-connections/${c._id}`), 'Connection deleted.');
  /*
   * health-check returns { connection, result:{ ok, message, data:{ refreshed } } }.
   * A failing probe is a 200 with ok:false, so it has to be read out of the body
   * rather than caught — otherwise a dead connection reports "complete".
   */
  const healthCheck = async c => {
    setBusyConnection(c._id);
    setError('');
    setMessage('');
    try {
      const payload = await api.post(`/api/platform-connections/${c._id}/health-check`, {});
      const result = payload?.data?.result || {};
      const refreshed = result.data?.refreshed ? ' Token was refreshed automatically.' : '';
      if (result.ok) setMessage(`${c.accountName || formatPlatform(c.platform)} is healthy.${refreshed}`);
      else setError(`${result.code || 'Health check failed'}: ${result.message || 'Unknown error'}`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyConnection('');
    }
  };
  /* Previously unwired. */
  const refreshToken = c =>
    runOnConnection(c, () => api.post(`/api/platform-connections/${c._id}/refresh`, {}), 'Access token refreshed.');
  const reconnect = c =>
    connect({ platform: c.platformData?.platform || c.platform, configured: true });

  const filtered = useMemo(() => {
    if (!platforms) return null;
    const q = query.trim().toLowerCase();
    return q
      ? platforms.filter(
          p => p.platform.toLowerCase().includes(q) || p.displayName?.toLowerCase().includes(q)
        )
      : platforms;
  }, [platforms, query]);

  const stats = useMemo(() => {
    if (!platforms) return null;
    const expiring = connectedAccounts.filter(a => {
      const e = expiryInfo(a.tokenExpiresAt);
      return e && (e.tone === 'danger' || e.tone === 'warning');
    }).length;
    return {
      linked: connectedAccounts.length,
      ready: platforms.filter(p => p.configured).length,
      total: platforms.length,
      needsAttention: connectedAccounts.filter(a => a.lastErrorCode || a.missingScopes?.length).length,
      expiring
    };
  }, [platforms, connectedAccounts]);

  return (
    <AppShell>
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <BackgroundBeams className="opacity-25 dark:opacity-50" />
        <div className="absolute inset-0 bg-blueprint [mask-image:radial-gradient(ellipse_at_top,black_10%,transparent_70%)]" />
      </div>

      <Page>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
            Distribute
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
            Connections
          </h1>
          <div className="max-w-3xl">
            <TextGenerateEffect
              words="Real OAuth links to every platform you publish through. Tokens are exchanged and stored server-side, scoped per account, and never handed to the browser."
              className="font-normal"
              duration={0.5}
            />
          </div>
        </div>

        {error ? <Notice tone="danger">{error}</Notice> : null}
        {message ? <Notice tone="success">{message}</Notice> : null}

        {stats ? (
          <GlareStatGrid>
            <GlareStat label="Linked accounts" value={stats.linked} icon={Link2} tint={GLARE_TINTS[0]} />
            <GlareStat label="Platforms ready" value={`${stats.ready}/${stats.total}`} icon={Plug} tint={GLARE_TINTS[1]} hint="Credentials present" />
            <GlareStat label="Needs attention" value={stats.needsAttention} icon={ShieldAlert} tint={GLARE_TINTS[2]} />
            <GlareStat label="Token expiring" value={stats.expiring} icon={Clock} tint={GLARE_TINTS[3]} />
            <GlareStat label="Healthy" value={Math.max(0, stats.linked - stats.needsAttention)} icon={CircleCheck} tint={GLARE_TINTS[4]} />
          </GlareStatGrid>
        ) : null}

        {/* Linked accounts */}
        <Section
          title="Linked accounts"
          description={connectedAccounts.length ? `${connectedAccounts.length} connected` : undefined}
        >
          {!platforms ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64" />)}
            </div>
          ) : connectedAccounts.length === 0 ? (
            <EmptyState
              icon={Plug}
              title="No accounts linked yet"
              description="Connect a platform below to publish through it. Every platform currently shows the exact credentials it still needs."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {connectedAccounts.map(a => (
                  <AccountCard
                    key={a._id}
                    account={a}
                    busy={busyConnection === a._id}
                    onDisconnect={disconnect}
                    onDelete={deleteConnection}
                    onHealth={healthCheck}
                    onRefresh={refreshToken}
                    onReconnect={reconnect}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </Section>

        {/* Available platforms */}
        <Section
          title="Available platforms"
          description={filtered ? `${filtered.length} of ${platforms?.length ?? 0}` : undefined}
          actions={
            <div className="relative w-40 sm:w-52">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Filter platforms…"
                aria-label="Filter platforms"
                className="pl-8"
              />
            </div>
          }
        >
          {!filtered ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Search} title="No platforms match" description="Try a different name." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map(p => (
                <PlatformCard
                  key={p.platform}
                  platform={p}
                  busy={busyPlatform === p.platform}
                  onConnect={connect}
                  expanded={Boolean(expanded[p.platform])}
                  onToggle={name => setExpanded(prev => ({ ...prev, [name]: !prev[name] }))}
                />
              ))}
            </div>
          )}
        </Section>
      </Page>
    </AppShell>
  );
}
