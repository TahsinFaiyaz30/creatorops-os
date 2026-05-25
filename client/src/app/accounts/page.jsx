'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, RefreshCw, ShieldAlert, Unplug } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { api } from '../../lib/api';
import { getUser } from '../../lib/auth';
import { formatPlatform } from '../../lib/platforms';

const capabilityLabels = ['publish', 'schedule', 'analytics', 'comments', 'replies'];

const statusTone = status => {
  if (status === 'connected') return 'text-mint bg-mint/10';
  if (status === 'not_configured') return 'text-gold bg-gold/10';
  return 'text-rose bg-rose/10';
};

export default function AccountsPage() {
  const [user, setUser] = useState(null);
  const [platforms, setPlatforms] = useState([]);
  const [message, setMessage] = useState('');
  const [busyPlatform, setBusyPlatform] = useState('');
  const [busyConnection, setBusyConnection] = useState('');

  const load = async () => {
    const [statusPayload] = await Promise.all([
      api.get('/api/platform-connections/status'),
      api.get('/api/platform-connections')
    ]);
    setPlatforms(statusPayload.data.platforms || []);
  };

  useEffect(() => {
    setUser(getUser());
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const error = params.get('error');
    const platform = params.get('platform');
    const platformLabel = platform ? formatPlatform(platform) : 'Account';
    if (success) {
      setMessage(`${platformLabel} OAuth connection saved. Refreshing real connection status.`);
    } else if (error) {
      setMessage(`${platformLabel} OAuth error: ${error}`);
    }
    load().catch(err => setMessage(err.message));
  }, []);

  const totalConnected = useMemo(
    () => {
      const ids = new Set();
      platforms.forEach(platform => {
        (platform.connections || []).forEach(connection => ids.add(connection._id));
      });
      return ids.size;
    },
    [platforms]
  );

  const connect = async platform => {
    setBusyPlatform(platform.platform);
    setMessage('');
    try {
      const payload = await api.get(`/api/oauth/${platform.platform}/start`);
      if (payload.data.authorizationUrl) {
        window.location.href = payload.data.authorizationUrl;
        return;
      }
      setMessage(payload.data.message || 'Connection verified.');
      await load();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusyPlatform('');
    }
  };

  const disconnect = async connection => {
    setBusyConnection(connection._id);
    setMessage('');
    try {
      await api.post(`/api/platform-connections/${connection._id}/disconnect`, {});
      setMessage('Connection disconnected.');
      await load();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusyConnection('');
    }
  };

  const healthCheck = async connection => {
    setBusyConnection(connection._id);
    setMessage('');
    try {
      const payload = await api.post(`/api/platform-connections/${connection._id}/health-check`, {});
      setMessage(payload.data.result?.message || 'Health check complete.');
      await load();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusyConnection('');
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="rounded-lg border border-line bg-panel p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-cyan">Real account connections</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Connected Accounts</h1>
          <p className="mt-2 max-w-4xl text-sm text-slate-400">
            Connect accounts through official OAuth or server-side API credentials. CreatorOps never asks for social passwords, never exposes tokens to the browser, and blocks publish actions when credentials, scopes, or platform review are missing.
          </p>
          <div className="mt-4 rounded-md border border-gold/30 bg-gold/10 p-3 text-sm text-gold">
            {totalConnected} real connection{totalConnected === 1 ? '' : 's'} in this workspace. No simulated accounts are created by seed data.
          </div>
        </header>

        {message && <div className="rounded-md border border-line bg-panel p-3 text-sm text-slate-300">{message}</div>}

        <section className="grid gap-4 xl:grid-cols-2">
          {platforms.map(platform => (
            <article key={platform.platform} className="rounded-lg border border-line bg-panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">{formatPlatform(platform.platform)}</h2>
                  <p className="mt-1 text-sm text-slate-400">{platform.helperText}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs ${platform.configured ? 'bg-mint/10 text-mint' : 'bg-gold/10 text-gold'}`}>
                  {platform.configured ? 'configured' : 'not configured'}
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <InfoBlock label="Required env" values={platform.requiredEnv} empty="No env requirements" />
                <InfoBlock label="Required scopes" values={platform.requiredScopes} empty="No scope list" />
              </div>

              <div className="mt-3 grid gap-2 text-xs text-slate-400">
                <span>Callback URL: {platform.callbackUrl || 'n/a'}</span>
                <span>Connected records: {platform.connectedCount || 0}</span>
                {platform.missingEnvNames?.length > 0 && <span className="text-gold">Missing env: {platform.missingEnvNames.join(', ')}</span>}
                {platform.blockedReason && <span className="text-gold">Blocked: {platform.blockedReason}</span>}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {capabilityLabels.map(label => (
                  <span key={label} className={`rounded-full px-2 py-1 text-xs ${platform.capabilities?.[label] ? 'bg-cyan/10 text-cyan' : 'bg-white/5 text-slate-500'}`}>
                    {label}
                  </span>
                ))}
              </div>

              <button
                type="button"
                disabled={busyPlatform === platform.platform || user?.role !== 'creator_admin'}
                onClick={() => connect(platform)}
                className="focus-ring mt-4 inline-flex items-center gap-2 rounded-md bg-cyan px-3 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ExternalLink size={15} />
                {busyPlatform === platform.platform ? 'Starting...' : 'Connect Account'}
              </button>
              {user?.role !== 'creator_admin' && (
                <p className="mt-2 text-xs text-slate-500">Editors can view connections, but backend RBAC blocks connect/disconnect actions.</p>
              )}
              {!platform.configured && (
                <p className="mt-2 flex items-center gap-2 text-xs text-gold">
                  <ShieldAlert size={14} />
                  Server OAuth credentials are not configured for this platform.
                </p>
              )}

              <div className="mt-4 space-y-2">
                {(platform.connections || []).map(connection => (
                  <div key={connection._id} className="rounded-md border border-line bg-ink p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{connection.accountName || 'Unnamed account'}</div>
                        <div className="mt-1 text-xs text-slate-400">{connection.accountHandle || connection.externalAccountId}</div>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs ${statusTone(connection.status)}`}>{connection.status}</span>
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-slate-400">
                      <span>External ID: {connection.externalAccountId || 'n/a'}</span>
                      <span>Type: {connection.accountType}</span>
                      <span>Scopes: {(connection.scopes || []).join(', ') || 'none recorded'}</span>
                      {connection.missingScopes?.length > 0 && (
                        <span className="text-gold">
                          Missing granted scopes: {connection.missingScopes.join(', ')}. Reconnect this account after adding scopes in the provider console.
                        </span>
                      )}
                      <span>Expires: {connection.tokenExpiresAt ? new Date(connection.tokenExpiresAt).toLocaleString() : 'not provided'}</span>
                      <span>Last check: {connection.lastHealthCheckAt ? new Date(connection.lastHealthCheckAt).toLocaleString() : 'not checked'}</span>
                      {connection.lastErrorMessage && <span className="text-rose">Last error: {connection.lastErrorMessage}</span>}
                    </div>
                    {user?.role === 'creator_admin' && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" disabled={busyConnection === connection._id} onClick={() => healthCheck(connection)} className="focus-ring inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-xs text-slate-200 hover:bg-white/5">
                          <RefreshCw size={14} />
                          Health check
                        </button>
                        <button type="button" disabled={busyConnection === connection._id} onClick={() => disconnect(connection)} className="focus-ring inline-flex items-center gap-2 rounded-md border border-rose/40 px-3 py-2 text-xs text-rose hover:bg-rose/10">
                          <Unplug size={14} />
                          Disconnect
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {(platform.connections || []).length === 0 && (
                  <p className="rounded-md border border-line bg-ink p-3 text-sm text-slate-500">No real account connected.</p>
                )}
              </div>
            </article>
          ))}
        </section>
      </div>
    </AppShell>
  );
}

function InfoBlock({ label, values, empty }) {
  return (
    <div className="rounded-md border border-line bg-ink p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {(values || []).length ? (
          values.map(value => <span key={value} className="rounded-full bg-panel px-2 py-1 text-xs text-slate-300">{value}</span>)
        ) : (
          <span className="text-xs text-slate-500">{empty}</span>
        )}
      </div>
    </div>
  );
}
