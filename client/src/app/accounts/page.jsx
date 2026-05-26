'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, RefreshCw, ShieldAlert, Unplug, Plus, Settings2, ChevronDown, ChevronUp } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { api } from '../../lib/api';
import { getUser } from '../../lib/auth';
import { formatPlatform } from '../../lib/platforms';

const capabilityLabels = ['publish', 'schedule', 'analytics', 'comments', 'replies'];

const statusTone = status => {
  if (status === 'connected') return 'text-mint bg-mint/10 border-mint/20';
  if (status === 'not_configured') return 'text-gold bg-gold/10 border-gold/20';
  return 'text-rose bg-rose/10 border-rose/20';
};

export default function AccountsPage() {
  const [user, setUser] = useState(null);
  const [platforms, setPlatforms] = useState([]);
  const [message, setMessage] = useState('');
  const [busyPlatform, setBusyPlatform] = useState('');
  const [busyConnection, setBusyConnection] = useState('');
  
  // UI States
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [expandedDetails, setExpandedDetails] = useState({}); // Track which platform's tech details are expanded

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

  const connectedAccounts = useMemo(() => {
    const accounts = [];
    platforms.forEach(platform => {
      (platform.connections || []).forEach(connection => {
        accounts.push({ ...connection, platformData: platform });
      });
    });
    return accounts;
  }, [platforms]);

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
      setShowAddAccount(false);
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

  const toggleDetails = (platformName) => {
    setExpandedDetails(prev => ({ ...prev, [platformName]: !prev[platformName] }));
  };

  return (
    <AppShell>
      <div className="space-y-8">
        <header className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-mint/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-mint mb-2">Workspace Integrations</p>
              <h1 className="text-4xl font-extrabold text-[var(--text)] tracking-tight">Connected Accounts</h1>
              <p className="mt-3 max-w-2xl text-sm text-[var(--muted)] leading-relaxed">
                Manage your official social media connections. CreatorOps uses highly secure OAuth protocols—we never ask for passwords and never expose tokens to the browser.
              </p>
            </div>
            
            <button 
              onClick={() => setShowAddAccount(!showAddAccount)}
              className="flex items-center gap-2 px-6 py-3 bg-mint text-[#05130d] font-bold rounded-2xl hover:brightness-110 hover:scale-105 transition-all shadow-[0_0_20px_rgba(var(--color-mint-rgb),0.3)]"
            >
              <Plus size={18} />
              {showAddAccount ? 'Close Directory' : 'Add Account'}
            </button>
          </div>
        </header>

        {message && (
          <div className="rounded-2xl border border-mint/30 bg-mint/10 p-4 text-sm font-medium text-mint shadow-sm">
            {message}
          </div>
        )}

        {/* Add Account Directory (Hidden by default) */}
        {showAddAccount && (
          <section className="animate-in fade-in slide-in-from-top-4 duration-300">
            <h2 className="text-xl font-bold text-[var(--text)] mb-4 flex items-center gap-2">
              <ExternalLink size={20} className="text-mint" /> 
              Platform Directory
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {platforms.map(platform => (
                <div key={platform.platform} className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 hover:border-mint transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-[var(--text)]">{formatPlatform(platform.platform)}</h3>
                      <span className={`inline-block mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${platform.configured ? 'border-mint/30 bg-mint/10 text-mint' : 'border-gold/30 bg-gold/10 text-gold'}`}>
                        {platform.configured ? 'Configured API' : 'Needs Config'}
                      </span>
                    </div>
                    {/* Tiny Capability Dots */}
                    <div className="flex gap-1">
                      {capabilityLabels.map(label => platform.capabilities?.[label] && (
                        <div key={label} title={label} className="w-1.5 h-1.5 rounded-full bg-mint opacity-60"></div>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-[var(--muted)] mb-5 min-h-[32px] line-clamp-2">
                    {platform.helperText}
                  </p>

                  <button
                    type="button"
                    disabled={busyPlatform === platform.platform || !platform.configured}
                    onClick={() => connect(platform)}
                    className="w-full py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface2)] text-sm font-bold text-[var(--text)] hover:bg-mint hover:text-[#05130d] hover:border-mint transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {busyPlatform === platform.platform ? 'Connecting...' : 'Connect'}
                  </button>
                  {!platform.configured && (
                    <p className="mt-3 text-[10px] text-gold flex items-center gap-1">
                      <ShieldAlert size={12} /> API Credentials missing on server
                    </p>
                  )}

                  {/* Expandable Tech Details (Keeps all the complex info, but hidden) */}
                  <div className="mt-4 pt-4 border-t border-[var(--border)]">
                    <button 
                      onClick={() => toggleDetails(platform.platform)}
                      className="flex items-center justify-between w-full text-xs text-[var(--muted)] hover:text-mint transition-colors"
                    >
                      <span className="flex items-center gap-1"><Settings2 size={12} /> Tech Details</span>
                      {expandedDetails[platform.platform] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    
                    {expandedDetails[platform.platform] && (
                      <div className="mt-3 space-y-3 animate-in fade-in duration-200">
                        <InfoBlock label="Required Env" values={platform.requiredEnv} empty="None" />
                        <InfoBlock label="Required Scopes" values={platform.requiredScopes} empty="None" />
                        <div className="grid gap-1 text-[10px] text-[var(--muted)] bg-[var(--surface2)] p-2 rounded-lg">
                          <div>Callback: <span className="font-mono text-[var(--text)]">{platform.callbackUrl || 'n/a'}</span></div>
                          {platform.missingEnvNames?.length > 0 && <div className="text-gold font-medium">Missing: {platform.missingEnvNames.join(', ')}</div>}
                          {platform.blockedReason && <div className="text-rose font-medium">Blocked: {platform.blockedReason}</div>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Active Connections Cards */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-[var(--text)]">Active Connections</h2>
            <span className="bg-[var(--surface2)] px-3 py-1 rounded-full text-xs font-semibold text-[var(--muted)] border border-[var(--border)]">
              {connectedAccounts.length} Total
            </span>
          </div>

          {connectedAccounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 rounded-3xl border border-dashed border-[var(--border)] text-[var(--muted)]">
              <Unplug size={40} className="mb-4 opacity-50" />
              <p className="text-lg font-medium text-[var(--text)] mb-1">No accounts connected</p>
              <p className="text-sm">Click "Add Account" above to link your first social profile.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {connectedAccounts.map(connection => (
                <div key={`${connection._id}-${connection.platformData.platform}`} className="relative group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 hover:shadow-lg transition-shadow overflow-hidden">
                  
                  {/* Status Indicator Bar */}
                  <div className={`absolute top-0 left-0 w-full h-1 ${connection.status === 'connected' ? 'bg-mint' : 'bg-rose'}`}></div>

                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] mb-1">
                        {formatPlatform(connection.platformData.platform)}
                      </div>
                      <h3 className="text-lg font-bold text-[var(--text)] truncate max-w-[180px]">
                        {connection.accountName || 'Unnamed Account'}
                      </h3>
                      <p className="text-sm text-[var(--muted)]">
                        {connection.accountHandle || connection.externalAccountId}
                      </p>
                    </div>
                    <span className={`border rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusTone(connection.status)}`}>
                      {connection.status}
                    </span>
                  </div>

                  <div className="space-y-1 mb-6 text-xs text-[var(--muted)]">
                    <div className="flex justify-between">
                      <span>Type:</span>
                      <span className="text-[var(--text)] capitalize">{connection.accountType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Expires:</span>
                      <span className="text-[var(--text)]">{connection.tokenExpiresAt ? new Date(connection.tokenExpiresAt).toLocaleDateString() : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Health:</span>
                      <span className="text-[var(--text)]">{connection.lastHealthCheckAt ? new Date(connection.lastHealthCheckAt).toLocaleDateString() : 'Unchecked'}</span>
                    </div>
                  </div>

                  {connection.lastErrorMessage && (
                    <div className="mb-4 p-2 rounded-lg bg-rose/10 border border-rose/20 text-[10px] text-rose">
                      <strong>Error:</strong> {connection.lastErrorMessage}
                    </div>
                  )}
                  {connection.missingScopes?.length > 0 && (
                    <div className="mb-4 p-2 rounded-lg bg-gold/10 border border-gold/20 text-[10px] text-gold">
                      <strong>Warning:</strong> Missing scopes ({connection.missingScopes.join(', ')}).
                    </div>
                  )}

                  <div className="flex gap-2 pt-4 border-t border-[var(--border)]">
                    <button 
                      type="button" 
                      disabled={busyConnection === connection._id} 
                      onClick={() => healthCheck(connection)} 
                      className="flex-1 flex justify-center items-center gap-1.5 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface2)] text-xs font-semibold text-[var(--text)] hover:border-mint hover:text-mint transition-colors"
                    >
                      <RefreshCw size={14} /> Check
                    </button>
                    <button 
                      type="button" 
                      disabled={busyConnection === connection._id} 
                      onClick={() => disconnect(connection)} 
                      className="flex-1 flex justify-center items-center gap-1.5 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface2)] text-xs font-semibold text-[var(--text)] hover:border-rose hover:text-rose hover:bg-rose/5 transition-colors"
                    >
                      <Unplug size={14} /> Disconnect
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function InfoBlock({ label, values, empty }) {
  return (
    <div className="bg-[var(--surface)] p-2 rounded-lg border border-[var(--border)]">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">
        {(values || []).length ? (
          values.map(value => <span key={value} className="bg-[var(--surface2)] px-1.5 py-0.5 rounded text-[10px] text-[var(--text)]">{value}</span>)
        ) : (
          <span className="text-[10px] text-[var(--muted)]">{empty}</span>
        )}
      </div>
    </div>
  );
}
