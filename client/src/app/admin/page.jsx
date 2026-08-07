'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Database, ExternalLink, Loader2, Save, Server, Shield, Users } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import RoleBadge from '../../components/layout/RoleBadge';
import { api } from '../../lib/api';
import { getToken, saveSession } from '../../lib/auth';
import { formatDuration } from '../../lib/duration';
import { ROLES, getRoleLabel, hasAdminRole, normalizeRoles } from '../../lib/roles';

const ROLE_OPTIONS = [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP, ROLES.ADMIN];
const DEFAULT_RETRY_RETENTION_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_STORAGE_HARD_DELETE_SECONDS = 30 * 24 * 60 * 60;
const defaultMediaSettings = {
  temporaryMediaRetentionSeconds: DEFAULT_RETRY_RETENTION_SECONDS,
  temporaryMediaStorageHardDeleteSeconds: DEFAULT_STORAGE_HARD_DELETE_SECONDS,
  temporaryUploadHardDeleteSeconds: DEFAULT_STORAGE_HARD_DELETE_SECONDS,
  temporaryMediaCleanup: null
};

const getUploadHardDeleteSeconds = settings =>
  settings?.temporaryUploadHardDeleteSeconds ??
  settings?.temporaryMediaStorageHardDeleteSeconds ??
  DEFAULT_STORAGE_HARD_DELETE_SECONDS;

const formatLastCleanupRun = value => {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  return date.toLocaleString();
};

export default function AdminPanelPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [draftRoles, setDraftRoles] = useState({});
  const [roleBusy, setRoleBusy] = useState('');
  const [roleMessage, setRoleMessage] = useState('');
  const [settings, setSettings] = useState(null);
  const [settingsDraft, setSettingsDraft] = useState(defaultMediaSettings);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');

  useEffect(() => {
    const token = getToken();

    api.get('/api/auth/me')
      .then(payload => {
        const currentUser = payload.user;
        if (!hasAdminRole(currentUser)) {
          router.replace('/dashboard');
          return null;
        }

        setUser(currentUser);
        saveSession({ token, user: currentUser });
        return Promise.allSettled([
          api.get('/api/campaigns'),
          api.get('/api/platform-connections'),
          api.get('/api/publish/jobs'),
          api.get('/api/events?limit=5'),
          api.get('/api/admin/users'),
          api.get('/api/admin/settings')
        ]);
      })
      .then(results => {
        if (!results) return;
        const [campaigns, connections, jobs, events, adminUsers, adminSettings] = results;
        const users = adminUsers.value?.data?.users || [];
        const loadedSettings = adminSettings.value?.data?.settings || defaultMediaSettings;

        setStats({
          campaigns: campaigns.value?.data?.campaigns?.length ?? 'N/A',
          connections: connections.value?.data?.connections?.length ?? 'N/A',
          publishJobs: jobs.value?.data?.publishJobs?.length ?? 'N/A',
          events: events.value?.data?.events?.length ?? 'N/A'
        });
        setAccounts(users);
        setDraftRoles(Object.fromEntries(users.map(account => [account.id, normalizeRoles(account)])));
        setSettings(loadedSettings);
        setSettingsDraft({
          temporaryMediaRetentionSeconds: loadedSettings.temporaryMediaRetentionSeconds ?? DEFAULT_RETRY_RETENTION_SECONDS,
          temporaryMediaStorageHardDeleteSeconds: getUploadHardDeleteSeconds(loadedSettings),
          temporaryUploadHardDeleteSeconds: getUploadHardDeleteSeconds(loadedSettings)
        });
      })
      .catch(() => {
        router.replace('/dashboard');
      });
  }, [router]);

  if (!user) return null;

  const toggleDraftRole = (accountId, role) => {
    setDraftRoles(current => {
      const existing = current[accountId] || [];
      const next = existing.includes(role)
        ? existing.filter(item => item !== role)
        : [...existing, role];

      return next.length > 0 ? { ...current, [accountId]: next } : current;
    });
  };

  const saveRoles = async accountId => {
    setRoleBusy(accountId);
    setRoleMessage('');
    try {
      const payload = await api.patch(`/api/admin/users/${accountId}/roles`, {
        roles: draftRoles[accountId] || []
      });
      const updatedUser = payload.data.user;
      setAccounts(current => current.map(account => (account.id === accountId ? updatedUser : account)));
      setDraftRoles(current => ({ ...current, [accountId]: normalizeRoles(updatedUser) }));

      if (updatedUser.id === user.id) {
        setUser(updatedUser);
        saveSession({ token: getToken(), user: updatedUser });
      }

      setRoleMessage('Roles updated.');
    } catch (err) {
      setRoleMessage(err.message || 'Could not update roles.');
    } finally {
      setRoleBusy('');
    }
  };

  const saveSettings = async () => {
    setSettingsBusy(true);
    setSettingsMessage('');
    try {
      const payload = await api.patch('/api/admin/settings', {
        temporaryMediaRetentionSeconds: settingsDraft.temporaryMediaRetentionSeconds,
        temporaryUploadHardDeleteSeconds: settingsDraft.temporaryUploadHardDeleteSeconds
      });
      const updatedSettings = payload.data.settings;
      setSettings(updatedSettings);
      setSettingsDraft({
        temporaryMediaRetentionSeconds: updatedSettings.temporaryMediaRetentionSeconds,
        temporaryMediaStorageHardDeleteSeconds: getUploadHardDeleteSeconds(updatedSettings),
        temporaryUploadHardDeleteSeconds: getUploadHardDeleteSeconds(updatedSettings)
      });
      setSettingsMessage('Temporary media retention updated.');
    } catch (err) {
      setSettingsMessage(err.message || 'Could not update settings.');
    } finally {
      setSettingsBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-mint">Server control</p>
              <h1 className="mt-1 text-2xl font-bold text-[var(--text)]">Admin Panel</h1>
              <p className="mt-1 text-sm text-[var(--muted)]">Admin-only workspace and server workflow overview.</p>
            </div>
            <RoleBadge user={user} />
          </div>
        </header>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="mb-4 flex items-center gap-2">
            <Shield size={17} className="text-mint" />
            <h2 className="text-base font-semibold text-[var(--text)]">Current Session</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { label: 'Name', value: user.name },
              { label: 'Email', value: user.email },
              { label: 'Roles', value: <RoleBadge user={user} /> }
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-4">
                <div className="mb-1 text-xs uppercase tracking-wide text-[var(--muted)]">{label}</div>
                <div className="text-sm font-semibold text-[var(--text)]">{value}</div>
              </div>
            ))}
          </div>
        </section>

        {stats && (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="mb-4 flex items-center gap-2">
              <Database size={17} className="text-mint" />
              <h2 className="text-base font-semibold text-[var(--text)]">Workspace Overview</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Campaigns', value: stats.campaigns },
                { label: 'Connections', value: stats.connections },
                { label: 'Publish Jobs', value: stats.publishJobs },
                { label: 'Events', value: stats.events }
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-4">
                  <div className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</div>
                  <div className="mt-1 text-2xl font-bold text-[var(--text)]">{value}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {settings && (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Clock size={17} className="text-mint" />
                <h2 className="text-base font-semibold text-[var(--text)]">Temporary Media Expiry</h2>
              </div>
              {settingsMessage && <div className="text-sm text-[var(--muted)]">{settingsMessage}</div>}
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <label className="block">
                <span className="mb-1.5 block text-xs uppercase tracking-wide text-[var(--muted)]">Retry expiry seconds</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={settingsDraft.temporaryMediaRetentionSeconds}
                  onChange={event => setSettingsDraft(current => ({ ...current, temporaryMediaRetentionSeconds: event.target.value }))}
                  className="focus-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-sm text-[var(--text)]"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs uppercase tracking-wide text-[var(--muted)]">Upload hard-delete seconds</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={settingsDraft.temporaryUploadHardDeleteSeconds}
                  onChange={event => setSettingsDraft(current => ({
                    ...current,
                    temporaryMediaStorageHardDeleteSeconds: event.target.value,
                    temporaryUploadHardDeleteSeconds: event.target.value
                  }))}
                  className="focus-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-sm text-[var(--text)]"
                />
              </label>
              <button
                type="button"
                onClick={saveSettings}
                disabled={settingsBusy}
                className="focus-ring self-end inline-flex items-center justify-center gap-2 rounded-xl bg-mint px-3 py-2 text-sm font-semibold text-[var(--accent-fg)] disabled:opacity-50"
              >
                {settingsBusy ? <Loader2 size={15} className="animate-spin-slow" /> : <Save size={15} />}
                Save
              </button>
            </div>

            <p className="mt-3 text-sm text-[var(--muted)]">
              Current expiry: {formatDuration(settings.temporaryMediaRetentionSeconds)}. Use 0 for immediate deletion after a post group has no queued, publishing, or paused jobs. Scheduled queued jobs keep their media until they run.
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Upload hard delete: {formatDuration(getUploadHardDeleteSeconds(settings))} after a temporary upload starts. Use 0 for immediate deletion. This force-deletes abandoned temporary uploads and cloud media even if a platform dispatch is still queued, paused, or processing.
            </p>
            {settings.temporaryMediaCleanup && (
              <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { label: 'Last cleanup', value: formatLastCleanupRun(settings.temporaryMediaCleanup.lastRunAt) },
                  { label: 'Expired uploads', value: settings.temporaryMediaCleanup.expiredUploadSessions || 0 },
                  { label: 'Pruned sessions', value: settings.temporaryMediaCleanup.prunedUploadSessions || 0 },
                  { label: 'Hard deletes', value: settings.temporaryMediaCleanup.hardDeletedMediaAssets || 0 },
                  { label: 'Blocked jobs', value: settings.temporaryMediaCleanup.hardDeleteAffectedJobs || 0 },
                  { label: 'Retry deletes', value: settings.temporaryMediaCleanup.retryDeletedMediaAssets || 0 }
                ].map(item => (
                  <div key={item.label} className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-3">
                    <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">{item.label}</div>
                    <div className="mt-1 truncate text-sm font-semibold text-[var(--text)]">{item.value}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users size={17} className="text-mint" />
              <h2 className="text-base font-semibold text-[var(--text)]">Account Roles</h2>
            </div>
            {roleMessage && <div className="text-sm text-[var(--muted)]">{roleMessage}</div>}
          </div>

          <div className="space-y-3">
            {accounts.map(account => {
              const selectedRoles = draftRoles[account.id] || normalizeRoles(account);

              return (
                <div key={account.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-[var(--text)]">{account.name}</div>
                      <div className="text-sm text-[var(--muted)]">{account.email}</div>
                      <div className="mt-2">
                        <RoleBadge roles={selectedRoles} />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => saveRoles(account.id)}
                      disabled={roleBusy === account.id}
                      className="focus-ring inline-flex items-center gap-2 rounded-xl bg-mint px-3 py-2 text-sm font-semibold text-[var(--accent-fg)] disabled:opacity-50"
                    >
                      {roleBusy === account.id ? <Loader2 size={15} className="animate-spin-slow" /> : <Save size={15} />}
                      Save
                    </button>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {ROLE_OPTIONS.map(role => (
                      <label
                        key={`${account.id}-${role}`}
                        className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text)]"
                      >
                        <input
                          type="checkbox"
                          checked={selectedRoles.includes(role)}
                          onChange={() => toggleDraftRole(account.id, role)}
                          className="h-4 w-4 accent-mint"
                        />
                        {getRoleLabel(role)}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="mb-4 flex items-center gap-2">
            <Server size={17} className="text-mint" />
            <h2 className="text-base font-semibold text-[var(--text)]">Resources</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: 'Post Status', href: '/publishing' },
              { label: 'Connections & platform rules', href: '/accounts' }
            ].map(({ label, href }) => (
              <a
                key={label}
                href={href}
                className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-3 text-sm font-medium text-[var(--text)] transition hover:border-mint/50 hover:text-mint"
              >
                {label}
                <ExternalLink size={14} className="opacity-50" />
              </a>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
