'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Team — GET /api/teams/current
 *
 * Always the team you are currently in. There is deliberately no list of teams
 * here: the workspace switcher in the sidebar rail is the list, and having two
 * places that both enumerate your teams meant picking one in the rail and then
 * picking it again on the page.
 *
 * Every control is gated by the viewer's own permissions, which the server echoes
 * back in `viewer.permissions` — so a Manager sees the member list without the
 * position editor, and the page never renders a button the API would refuse.
 *
 * In a personal workspace there is no team to manage, so this becomes the place
 * to answer an invitation or start a team.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Users, UserPlus, Crown, ShieldCheck, Trash2, X, Plus, Mail, Settings2,
  UserCircle, Check, Lock, LogOut, ChevronRight
} from 'lucide-react';

import AppShell from '../../components/layout/AppShell';
import {
  Badge, Button, EmptyState, Input, Notice, Page, Section, Select, Skeleton, Textarea
} from '../../components/ds';
import { api } from '../../lib/api';
import { TEAM_PERMISSIONS, clearActiveWorkspace, getActiveWorkspaceId, setActiveWorkspace } from '../../lib/teams';

const EASE = [0.16, 1, 0.3, 1];

const idOf = item => String(item?._id || item?.id || '');

export default function TeamCurrentPage() {
  const [data, setData] = useState(null);
  const [permissionGroups, setPermissionGroups] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [tab, setTab] = useState('members');
  const [editingRole, setEditingRole] = useState(null);
  const [personal, setPersonal] = useState(false);

  const load = async () => {
    const [overview, permissions] = await Promise.all([
      api.get('/api/teams/current'),
      api.get('/api/teams/permissions').catch(() => null)
    ]);
    setData(overview.data);
    setPermissionGroups(permissions?.data?.groups || []);
  };

  useEffect(() => {
    /* No active team means the personal workspace: nothing to manage, so this
       becomes the join-or-create surface instead of an error. */
    if (!getActiveWorkspaceId()) {
      setPersonal(true);
      return;
    }
    load().catch(err => setError(err.message));
  }, []);

  const can = permission => Boolean(data?.viewer?.permissions?.includes(permission));

  const run = async (key, action, successMessage) => {
    setBusy(key);
    setError('');
    setNotice('');
    try {
      await action();
      if (successMessage) setNotice(successMessage);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  if (personal) {
    return (
      <AppShell>
        <PersonalWorkspaceView />
      </AppShell>
    );
  }

  if (error && !data) {
    return (
      <AppShell>
        <Page>
          <Notice tone="danger">{error}</Notice>
          <EmptyState
            icon={Users}
            title="This team could not be loaded"
            description="Pick a workspace from the switcher at the top of the sidebar rail."
          />
        </Page>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <Page>
          <Skeleton className="h-28" />
          <Skeleton className="h-64" />
        </Page>
      </AppShell>
    );
  }

  const { team, viewer, members, roles, pendingInvitations } = data;

  return (
    <AppShell>
      <Page>
        <header className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/75 p-5 backdrop-blur-xl">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_100%_at_0%_0%,var(--accent-soft),transparent_58%)]"
          />
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Team</p>
              <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-[var(--text)]">
                {team.name}
                {viewer.isOwner ? <Crown className="h-4 w-4 text-warning" /> : null}
              </h1>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--muted)]">
                {team.description || 'No description yet.'}
              </p>
              <p className="mt-2 text-[11px] text-[var(--muted)]">
                Owned by <span className="font-semibold text-[var(--text-2)]">{team.owner?.name}</span> ·{' '}
                {members.length} member{members.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge tone={viewer.isOwner ? 'accent' : 'neutral'}>
                <ShieldCheck className="h-2.5 w-2.5" />
                {viewer.role?.name || (viewer.isOwner ? 'Owner' : 'Member')}
              </Badge>
              {team.settings?.requirePublishApproval ? (
                <Badge tone="warning">
                  <Lock className="h-2.5 w-2.5" />
                  release approval required
                </Badge>
              ) : null}
              {!viewer.isOwner ? (
                <Button
                  size="sm"
                  variant="ghost"
                  loading={busy === 'leave'}
                  onClick={() =>
                    run('leave', async () => {
                      await api.post('/api/teams/current/leave', {});
                      clearActiveWorkspace();
                      window.location.href = '/team';
                    })
                  }
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Leave team
                </Button>
              ) : null}
            </div>
          </div>
        </header>

        {error ? <Notice tone="danger">{error}</Notice> : null}
        {notice ? <Notice tone="success">{notice}</Notice> : null}

        <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-1 backdrop-blur-xl">
          {[
            { id: 'members', label: 'Members', icon: Users },
            { id: 'positions', label: 'Positions', icon: ShieldCheck },
            ...(can(TEAM_PERMISSIONS.TEAM_MANAGE) ? [{ id: 'settings', label: 'Settings', icon: Settings2 }] : [])
          ].map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-pressed={tab === item.id}
              className={`focus-ring relative inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors ${
                tab === item.id ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              {tab === item.id ? (
                <motion.span
                  layoutId="team-tab"
                  className="absolute inset-0 rounded-lg bg-[var(--accent-soft)] ring-1 ring-inset ring-[var(--accent-line)]"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              ) : null}
              <item.icon className="relative h-3.5 w-3.5" />
              <span className="relative">{item.label}</span>
            </button>
          ))}
        </div>

        {tab === 'members' ? (
          <MembersTab
            data={data}
            can={can}
            busy={busy}
            run={run}
            pendingInvitations={pendingInvitations}
          />
        ) : null}

        {tab === 'positions' ? (
          <PositionsTab
            roles={roles}
            members={members}
            permissionGroups={permissionGroups}
            canEdit={can(TEAM_PERMISSIONS.TEAM_ROLES)}
            busy={busy}
            run={run}
            editingRole={editingRole}
            setEditingRole={setEditingRole}
          />
        ) : null}

        {tab === 'settings' ? <SettingsTab team={team} busy={busy} run={run} /> : null}
      </Page>
    </AppShell>
  );
}

/* ── Personal workspace ───────────────────────────────────────────────────── */

/*
 * What this page is when you are not in a team: answer an invitation, or start
 * one. Both used to live on a separate list page that duplicated the sidebar
 * switcher; the switcher is the list now, so these landed here instead.
 */
function PersonalWorkspaceView() {
  const [invitations, setInvitations] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = () =>
    api
      .get('/api/teams/invitations')
      .then(payload => setInvitations(payload.data.invitations || []))
      .catch(() => setInvitations([]));

  useEffect(() => {
    load();
  }, []);

  const respond = async (invitation, action) => {
    setBusy(`${invitation._id}:${action}`);
    setError('');
    try {
      const payload = await api.post(`/api/teams/invitations/${invitation._id}/${action}`, {});
      if (action === 'accept') {
        /* Drop straight into the team they just joined. */
        setActiveWorkspace({ _id: payload.data.workspaceId, name: invitation.workspaceId?.name, isPersonal: false });
        window.location.reload();
        return;
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const createTeam = async event => {
    event.preventDefault();
    if (!form.name.trim()) return;
    setBusy('create');
    setError('');
    try {
      const payload = await api.post('/api/teams', form);
      setActiveWorkspace({ _id: payload.data.team._id, name: payload.data.team.name, isPersonal: false });
      window.location.reload();
    } catch (err) {
      setError(err.message);
      setBusy('');
    }
  };

  return (
    <Page>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Plan</p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">Team</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
          You are in your personal workspace — your own accounts, media and posts, visible to nobody else. Start a team
          to hire other creators into positions you define, or accept an invitation to join someone else's.
        </p>
      </div>

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      {invitations?.length ? (
        <Section title="Invitations" description="Teams that want to hire you.">
          <div className="grid gap-2 lg:grid-cols-2">
            {invitations.map(invitation => (
              <article
                key={invitation._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)] p-3"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-[var(--text)]">
                    <Mail className="h-3.5 w-3.5 text-[var(--accent)]" />
                    {invitation.workspaceId?.name || 'A team'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                    {invitation.invitedBy?.name} invited you as{' '}
                    <span className="font-semibold text-[var(--text-2)]">{invitation.teamRoleId?.name}</span>
                  </p>
                  {invitation.message ? (
                    <p className="mt-1 text-[11px] italic text-[var(--text-2)]">“{invitation.message}”</p>
                  ) : null}
                </div>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="primary"
                    loading={busy === `${invitation._id}:accept`}
                    onClick={() => respond(invitation, 'accept')}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={busy === `${invitation._id}:decline`}
                    onClick={() => respond(invitation, 'decline')}
                  >
                    <X className="h-3.5 w-3.5" />
                    Decline
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Start a team" description="You become its owner and define every position in it.">
        <form
          onSubmit={createTeam}
          className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/75 p-4 backdrop-blur-xl"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[var(--muted)]">Team name</span>
              <Input
                value={form.name}
                onChange={event => setForm({ ...form, name: event.target.value })}
                placeholder="e.g. Hana Studio"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[var(--muted)]">What the team does</span>
              <Input
                value={form.description}
                onChange={event => setForm({ ...form, description: event.target.value })}
                placeholder="Cross-platform content crew"
              />
            </label>
          </div>
          <Button type="submit" variant="primary" size="sm" loading={busy === 'create'} disabled={!form.name.trim()}>
            <Plus className="h-3.5 w-3.5" />
            Create team
          </Button>
          <p className="text-[11px] text-[var(--muted)]">
            Switch between your workspaces from the control at the top of the sidebar rail.
          </p>
        </form>
      </Section>

      {invitations && invitations.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No invitations"
          description="When another creator hires you, the invitation appears here."
        />
      ) : null}
    </Page>
  );
}

/* ── Members ──────────────────────────────────────────────────────────────── */

function MembersTab({ data, can, busy, run, pendingInvitations }) {
  const { members, roles } = data;
  const [inviting, setInviting] = useState(false);
  const assignableRoles = roles.filter(role => !role.isOwner);
  const [invite, setInvite] = useState({ email: '', teamRoleId: '', title: '', message: '' });

  useEffect(() => {
    if (!invite.teamRoleId && assignableRoles.length) {
      setInvite(current => ({ ...current, teamRoleId: idOf(assignableRoles[0]) }));
    }
  }, [assignableRoles, invite.teamRoleId]);

  return (
    <>
      <Section
        title="Members"
        description={`${members.length} active`}
        actions={
          can(TEAM_PERMISSIONS.TEAM_INVITE) ? (
            <Button size="sm" variant="primary" onClick={() => setInviting(value => !value)}>
              <UserPlus className="h-3.5 w-3.5" />
              Hire a creator
            </Button>
          ) : null
        }
      >
        <AnimatePresence>
          {inviting ? (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              onSubmit={event => {
                event.preventDefault();
                run(
                  'invite',
                  async () => {
                    await api.post('/api/teams/current/invites', invite);
                    setInvite({ email: '', teamRoleId: idOf(assignableRoles[0]), title: '', message: '' });
                    setInviting(false);
                  },
                  'Invitation sent. They will see it under Teams.'
                );
              }}
              className="overflow-hidden"
            >
              <div className="mb-3 space-y-3 rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)] p-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-[var(--muted)]">Creator email</span>
                    <Input
                      type="email"
                      required
                      value={invite.email}
                      onChange={event => setInvite({ ...invite, email: event.target.value })}
                      placeholder="creator@example.com"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-[var(--muted)]">Position</span>
                    <Select
                      value={invite.teamRoleId}
                      onChange={event => setInvite({ ...invite, teamRoleId: event.target.value })}
                    >
                      {assignableRoles.map(role => (
                        <option key={role._id} value={role._id}>
                          {role.name}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-[var(--muted)]">Title (optional)</span>
                    <Input
                      value={invite.title}
                      onChange={event => setInvite({ ...invite, title: event.target.value })}
                      placeholder="Lead Editor"
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--muted)]">Message (optional)</span>
                  <Textarea
                    rows={2}
                    value={invite.message}
                    onChange={event => setInvite({ ...invite, message: event.target.value })}
                    placeholder="What you want them to work on"
                  />
                </label>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" variant="primary" loading={busy === 'invite'}>
                    <Mail className="h-3.5 w-3.5" />
                    Send invitation
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setInviting(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.form>
          ) : null}
        </AnimatePresence>

        <div className="grid gap-2 lg:grid-cols-2">
          {members.map((member, index) => (
            <MemberCard
              key={member._id}
              member={member}
              roles={assignableRoles}
              canManage={can(TEAM_PERMISSIONS.TEAM_INVITE)}
              canRemove={can(TEAM_PERMISSIONS.TEAM_REMOVE)}
              busy={busy}
              run={run}
              index={index}
            />
          ))}
        </div>
      </Section>

      {pendingInvitations?.length ? (
        <Section title="Pending invitations" description="Sent, not yet answered.">
          <div className="grid gap-2 lg:grid-cols-2">
            {pendingInvitations.map(invitation => (
              <div
                key={invitation._id}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-[var(--text)]">{invitation.email}</p>
                  <p className="text-[10px] text-[var(--muted)]">
                    {invitation.teamRoleId?.name} · expires {new Date(invitation.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={busy === `revoke:${invitation._id}`}
                  onClick={() =>
                    run(
                      `revoke:${invitation._id}`,
                      () => api.delete(`/api/teams/current/invites/${invitation._id}`),
                      'Invitation revoked.'
                    )
                  }
                >
                  <X className="h-3.5 w-3.5" />
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        </Section>
      ) : null}
    </>
  );
}

function MemberCard({ member, roles, canManage, canRemove, busy, run, index }) {
  const [changing, setChanging] = useState(false);
  const role = member.role;

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE, delay: Math.min(index, 8) * 0.03 }}
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/75 p-3 backdrop-blur-xl"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface2)]">
          {member.user?.profile?.avatarUrl ? (
            <img src={member.user.profile.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <UserCircle className="h-5 w-5 text-[var(--muted)]" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-bold text-[var(--text)]">
            {member.user?.name || 'Creator'}
            {member.isOwner ? <Crown className="h-3 w-3 shrink-0 text-warning" /> : null}
          </p>
          <p className="truncate text-[11px] text-[var(--muted)]">{member.user?.email}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {role ? (
              <span
                className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ borderColor: `${role.color}55`, color: role.color, background: `${role.color}14` }}
              >
                {role.name}
              </span>
            ) : null}
            {member.title ? (
              <span className="text-[10px] text-[var(--muted)]">{member.title}</span>
            ) : null}
            {member.status !== 'active' ? <Badge tone="warning">{member.status}</Badge> : null}
          </div>
        </div>
      </div>

      {canManage && !member.isOwner ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--border)] pt-2.5">
          {changing ? (
            <Select
              className="h-8 max-w-[12rem] py-1 text-xs"
              defaultValue={idOf(role)}
              onChange={event =>
                run(
                  `role:${member._id}`,
                  () => api.patch(`/api/teams/current/members/${member._id}`, { teamRoleId: event.target.value }),
                  'Position updated.'
                ).then(() => setChanging(false))
              }
            >
              {roles.map(item => (
                <option key={item._id} value={item._id}>
                  {item.name}
                </option>
              ))}
            </Select>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setChanging(true)}>
              Change position
            </Button>
          )}
          {canRemove ? (
            <Button
              size="sm"
              variant="danger"
              loading={busy === `remove:${member._id}`}
              onClick={() =>
                run(
                  `remove:${member._id}`,
                  () => api.delete(`/api/teams/current/members/${member._id}`),
                  `${member.user?.name} was removed from the team.`
                )
              }
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </Button>
          ) : null}
        </div>
      ) : null}
    </motion.article>
  );
}

/* ── Positions ────────────────────────────────────────────────────────────── */

function PositionsTab({ roles, members, permissionGroups, canEdit, busy, run, editingRole, setEditingRole }) {
  const [creating, setCreating] = useState(false);

  const memberCountByRole = useMemo(
    () =>
      members.reduce((counts, member) => {
        const key = idOf(member.role);
        counts[key] = (counts[key] || 0) + 1;
        return counts;
      }, {}),
    [members]
  );

  return (
    <Section
      title="Positions"
      description="What each position may do inside this team. Invent as many as you like."
      actions={
        canEdit ? (
          <Button size="sm" variant="primary" onClick={() => { setCreating(true); setEditingRole(null); }}>
            <Plus className="h-3.5 w-3.5" />
            New position
          </Button>
        ) : null
      }
    >
      {creating || editingRole ? (
        <RoleEditor
          role={editingRole}
          permissionGroups={permissionGroups}
          busy={busy}
          onCancel={() => { setCreating(false); setEditingRole(null); }}
          onSave={payload =>
            run(
              'role-save',
              async () => {
                if (editingRole) {
                  await api.patch(`/api/teams/current/roles/${editingRole._id}`, payload);
                } else {
                  await api.post('/api/teams/current/roles', payload);
                }
                setCreating(false);
                setEditingRole(null);
              },
              editingRole ? 'Position updated.' : 'Position created.'
            )
          }
        />
      ) : null}

      <div className="grid gap-2 lg:grid-cols-2">
        {roles.map(role => (
          <article
            key={role._id}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/75 p-3 backdrop-blur-xl"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="flex items-center gap-1.5 text-sm font-bold text-[var(--text)]">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: role.color }} />
                  <span className="truncate">{role.name}</span>
                  {role.isOwner ? <Lock className="h-3 w-3 shrink-0 text-[var(--muted)]" /> : null}
                </h3>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-[var(--muted)]">
                  {role.description || 'No description.'}
                </p>
              </div>
              <span className="shrink-0 rounded-md bg-[var(--surface2)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
                {memberCountByRole[idOf(role)] || 0} member{(memberCountByRole[idOf(role)] || 0) === 1 ? '' : 's'}
              </span>
            </div>

            <p className="mt-2 text-[10px] text-[var(--muted)]">
              {role.isOwner
                ? 'Every permission. Cannot be edited or removed.'
                : `${role.permissions.length} permission${role.permissions.length === 1 ? '' : 's'}`}
            </p>

            {canEdit && !role.isOwner ? (
              <div className="mt-2.5 flex gap-1.5 border-t border-[var(--border)] pt-2.5">
                <Button size="sm" variant="ghost" onClick={() => { setEditingRole(role); setCreating(false); }}>
                  Edit
                  <ChevronRight className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={busy === `role-del:${role._id}`}
                  onClick={() =>
                    run(
                      `role-del:${role._id}`,
                      () => api.delete(`/api/teams/current/roles/${role._id}`),
                      'Position deleted.'
                    )
                  }
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </Button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </Section>
  );
}

function RoleEditor({ role, permissionGroups, busy, onCancel, onSave }) {
  const [form, setForm] = useState({
    name: role?.name || '',
    color: role?.color || '#8b5cf6',
    description: role?.description || '',
    permissions: role?.permissions || []
  });

  const toggle = permission =>
    setForm(current => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter(value => value !== permission)
        : [...current.permissions, permission]
    }));

  return (
    <motion.form
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: EASE }}
      onSubmit={event => {
        event.preventDefault();
        onSave(form);
      }}
      className="mb-3 space-y-3 rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)] p-4"
    >
      <h3 className="text-sm font-bold text-[var(--text)]">{role ? `Edit ${role.name}` : 'New position'}</h3>

      <div className="grid gap-3 md:grid-cols-[1fr_6rem_2fr]">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-[var(--muted)]">Name</span>
          <Input
            required
            value={form.name}
            onChange={event => setForm({ ...form, name: event.target.value })}
            placeholder="Thumbnail Artist"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-[var(--muted)]">Colour</span>
          <input
            type="color"
            value={form.color}
            onChange={event => setForm({ ...form, color: event.target.value })}
            className="focus-ring h-9 w-full cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--surface2)] p-1"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-[var(--muted)]">Description</span>
          <Input
            value={form.description}
            onChange={event => setForm({ ...form, description: event.target.value })}
            placeholder="What this position is responsible for"
          />
        </label>
      </div>

      <div className="space-y-2.5">
        {permissionGroups.map(group => (
          <div key={group.key}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">{group.label}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {group.permissions.map(permission => {
                const on = form.permissions.includes(permission.key);
                return (
                  <button
                    key={permission.key}
                    type="button"
                    onClick={() => toggle(permission.key)}
                    aria-pressed={on}
                    className={`focus-ring inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold transition-colors ${
                      on
                        ? 'border-[var(--accent-line)] bg-[var(--accent)]/20 text-[var(--accent)]'
                        : 'border-[var(--border)] bg-[var(--surface2)] text-[var(--muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    {on ? <Check className="h-2.5 w-2.5" /> : null}
                    {permission.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-t border-[var(--border)] pt-3">
        <Button type="submit" size="sm" variant="primary" loading={busy === 'role-save'} disabled={!form.name.trim()}>
          {role ? 'Save position' : 'Create position'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <span className="ml-auto self-center text-[10px] text-[var(--muted)]">
          {form.permissions.length} permission{form.permissions.length === 1 ? '' : 's'} selected
        </span>
      </div>
    </motion.form>
  );
}

/* ── Settings ─────────────────────────────────────────────────────────────── */

function SettingsTab({ team, busy, run }) {
  const [form, setForm] = useState({
    name: team.name,
    description: team.description || '',
    requirePublishApproval: Boolean(team.settings?.requirePublishApproval),
    requireApprovalToHandoff: Boolean(team.settings?.requireApprovalToHandoff)
  });

  return (
    <Section title="Team settings" description="Only positions holding team.manage can change these.">
      <form
        onSubmit={event => {
          event.preventDefault();
          run(
            'settings',
            () =>
              api.patch('/api/teams/current', {
                name: form.name,
                description: form.description,
                settings: {
                  requirePublishApproval: form.requirePublishApproval,
                  requireApprovalToHandoff: form.requireApprovalToHandoff
                }
              }),
            'Team settings saved.'
          );
        }}
        className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/75 p-4 backdrop-blur-xl"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--muted)]">Team name</span>
            <Input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--muted)]">Description</span>
            <Input
              value={form.description}
              onChange={event => setForm({ ...form, description: event.target.value })}
            />
          </label>
        </div>

        <label className="flex items-start gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-3">
          <input
            type="checkbox"
            checked={form.requirePublishApproval}
            onChange={event => setForm({ ...form, requirePublishApproval: event.target.checked })}
            className="mt-0.5"
          />
          <span>
            <span className="block text-xs font-semibold text-[var(--text)]">Require release approval to publish</span>
            <span className="block text-[11px] leading-relaxed text-[var(--muted)]">
              A member can queue a cross-platform post, but nothing reaches your connected accounts until someone with
              approval rights releases it. Turned on automatically when a second member joins.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-3">
          <input
            type="checkbox"
            checked={form.requireApprovalToHandoff}
            onChange={event => setForm({ ...form, requireApprovalToHandoff: event.target.checked })}
            className="mt-0.5"
          />
          <span>
            <span className="block text-xs font-semibold text-[var(--text)]">Work must be approved before handoff</span>
            <span className="block text-[11px] leading-relaxed text-[var(--muted)]">
              Members cannot pass a deliverable to a teammate until it has cleared review.
            </span>
          </span>
        </label>

        <Button type="submit" size="sm" variant="primary" loading={busy === 'settings'}>
          Save settings
        </Button>
      </form>
    </Section>
  );
}
