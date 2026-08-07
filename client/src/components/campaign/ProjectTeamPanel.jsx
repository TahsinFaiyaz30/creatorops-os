'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Project crew, deliverables and chat.
 *
 * This is the surface the isolation rule protects: only members of this project
 * can read it, and the server enforces that on every endpoint below. A creator
 * who is in the team but not on this project gets a 404 from all of them, which
 * is why the panel simply does not render for them.
 *
 * Hidden entirely in a personal workspace — a team of one has nobody to hand
 * work to and nobody to talk to.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Users, MessagesSquare, PackageCheck, Send, Plus, UserCircle, Camera, ImageOff,
  Share2, Check, Clock3, X
} from 'lucide-react';

import { Badge, Button, EmptyState, Input, Notice, Select, Textarea } from '../ds';
import { api } from '../../lib/api';
import { getActiveWorkspaceId } from '../../lib/teams';
import { getSocket } from '../../lib/socket';

const EASE = [0.16, 1, 0.3, 1];

const idOf = item => String(item?._id || item?.id || '');

const STATUS_TONE = {
  draft: 'neutral',
  in_review: 'accent',
  approved: 'success',
  changes_requested: 'warning',
  rejected: 'danger'
};

export default function ProjectTeamPanel({ project, onRefresh }) {
  const [tab, setTab] = useState('crew');
  const [members, setMembers] = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const projectId = idOf(project);
  const inTeam = Boolean(getActiveWorkspaceId());

  const load = async () => {
    const [memberPayload, deliverablePayload, messagePayload] = await Promise.all([
      api.get('/api/teams/current/members/assignable').catch(() => null),
      api.get(`/api/collab/deliverables?projectId=${projectId}`).catch(() => null),
      api.get(`/api/collab/projects/${projectId}/messages`).catch(() => null)
    ]);
    setMembers(memberPayload?.data?.members || []);
    setDeliverables(deliverablePayload?.data?.deliverables || []);
    setMessages(messagePayload?.data?.messages || []);
  };

  useEffect(() => {
    if (!inTeam || !projectId) return undefined;
    load().catch(err => setError(err.message));

    /*
     * Join this project's socket room. Membership is re-checked server-side
     * before the join is honoured, so asking for a room you are not in is a
     * no-op rather than a leak.
     */
    const socket = getSocket();
    socket.emit('project:join', projectId);
    const onMessage = message => {
      if (String(message.projectId) !== projectId) return;
      setMessages(current => (current.some(item => idOf(item) === idOf(message)) ? current : [...current, message]));
    };
    socket.on('project:message', onMessage);

    return () => {
      socket.emit('project:leave', projectId);
      socket.off('project:message', onMessage);
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [projectId, inTeam]);

  if (!inTeam) return null;

  const crew = [project?.leadId, ...(project?.memberIds || [])].filter(Boolean);

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/75 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border)] p-2">
        {[
          { id: 'crew', label: 'Crew', icon: Users, count: crew.length },
          { id: 'work', label: 'Deliverables', icon: PackageCheck, count: deliverables.length },
          { id: 'chat', label: 'Chat', icon: MessagesSquare, count: messages.length }
        ].map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            aria-pressed={tab === item.id}
            className={`focus-ring relative inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors ${
              tab === item.id ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            {tab === item.id ? (
              <motion.span
                layoutId="project-panel-tab"
                className="absolute inset-0 rounded-lg bg-[var(--accent-soft)]"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            ) : null}
            <item.icon className="relative h-3.5 w-3.5" />
            <span className="relative">{item.label}</span>
            <span className="relative rounded-full bg-[var(--surface2)] px-1.5 text-[10px] tabular-nums">
              {item.count}
            </span>
          </button>
        ))}
      </div>

      <div className="p-3">
        {error ? <Notice tone="danger">{error}</Notice> : null}

        {tab === 'crew' ? <CrewTab project={project} members={members} onRefresh={onRefresh} /> : null}
        {tab === 'work' ? (
          <DeliverablesTab
            projectId={projectId}
            deliverables={deliverables}
            members={members}
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            reload={load}
          />
        ) : null}
        {tab === 'chat' ? (
          <ChatTab projectId={projectId} messages={messages} setMessages={setMessages} setError={setError} />
        ) : null}
      </div>
    </section>
  );
}

/* ── Crew ─────────────────────────────────────────────────────────────────── */

function CrewTab({ project, members, onRefresh }) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState((project?.memberIds || []).map(idOf));
  const [saving, setSaving] = useState(false);

  const toggle = userId =>
    setSelected(current =>
      current.includes(userId) ? current.filter(value => value !== userId) : [...current, userId]
    );

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/api/campaigns/${idOf(project)}`, { memberIds: selected });
      setEditing(false);
      await onRefresh?.();
    } finally {
      setSaving(false);
    }
  };

  const assigned = project?.memberIds || [];

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-[var(--muted)]">
        Only these people can open this project, its tasks, its files and this conversation. Everyone else in the team
        sees nothing of it.
      </p>

      {project?.brief ? (
        <div className="rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)]">The brief</p>
          <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-[var(--text-2)]">{project.brief}</p>
        </div>
      ) : null}

      {editing ? (
        <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-3">
          <p className="text-xs font-semibold text-[var(--text)]">Who is on this project</p>
          <div className="flex flex-wrap gap-1.5">
            {members.map(member => {
              const on = selected.includes(String(member.userId));
              return (
                <button
                  key={member.userId}
                  type="button"
                  onClick={() => toggle(String(member.userId))}
                  aria-pressed={on}
                  className={`focus-ring inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold transition-colors ${
                    on
                      ? 'border-[var(--accent-line)] bg-[var(--accent)]/20 text-[var(--accent)]'
                      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {on ? <Check className="h-2.5 w-2.5" /> : null}
                  {member.name}
                  {member.role ? <span className="opacity-60">· {member.role.name}</span> : null}
                </button>
              );
            })}
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" variant="primary" loading={saving} onClick={save}>
              Save crew
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {project?.leadId ? (
              <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--accent-line)] bg-[var(--accent-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--accent)]">
                <UserCircle className="h-3 w-3" />
                {project.leadId.name || 'Lead'} · lead
              </span>
            ) : null}
            {assigned.map(member => (
              <span
                key={idOf(member)}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-2 py-1 text-[10px] font-semibold text-[var(--text-2)]"
              >
                <UserCircle className="h-3 w-3 text-[var(--muted)]" />
                {member.name || 'Member'}
              </span>
            ))}
            {assigned.length === 0 && !project?.leadId ? (
              <span className="text-[11px] text-[var(--muted)]">Nobody assigned yet.</span>
            ) : null}
          </div>
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <Plus className="h-3.5 w-3.5" />
            Manage crew
          </Button>
        </>
      )}
    </div>
  );
}

/* ── Deliverables ─────────────────────────────────────────────────────────── */

function DeliverablesTab({ projectId, deliverables, members, busy, setBusy, setError, reload }) {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', kind: 'media_set', notes: '' });
  const [handoffFor, setHandoffFor] = useState(null);

  const act = async (key, action) => {
    setBusy(key);
    setError('');
    try {
      await action();
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] leading-relaxed text-[var(--muted)]">
          What members hand in. Approving one unlocks any task waiting on it.
        </p>
        <Button size="sm" variant="secondary" onClick={() => setCreating(value => !value)}>
          <Plus className="h-3.5 w-3.5" />
          New
        </Button>
      </div>

      <AnimatePresence>
        {creating ? (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={event => {
              event.preventDefault();
              act('create', async () => {
                await api.post('/api/collab/deliverables', { ...form, projectId });
                setForm({ title: '', kind: 'media_set', notes: '' });
                setCreating(false);
              });
            }}
            className="overflow-hidden"
          >
            <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-3">
              <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
                <Input
                  required
                  value={form.title}
                  onChange={event => setForm({ ...form, title: event.target.value })}
                  placeholder="Hero image set"
                  className="text-xs"
                />
                <Select
                  value={form.kind}
                  onChange={event => setForm({ ...form, kind: event.target.value })}
                  className="text-xs"
                >
                  <option value="media_set">Media set</option>
                  <option value="caption_set">Captions</option>
                  <option value="script">Script</option>
                  <option value="full_post">Full post</option>
                  <option value="other">Other</option>
                </Select>
              </div>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={event => setForm({ ...form, notes: event.target.value })}
                placeholder="What this is and what you need back"
                className="text-xs"
              />
              <Button type="submit" size="sm" variant="primary" loading={busy === 'create'} disabled={!form.title.trim()}>
                Create deliverable
              </Button>
            </div>
          </motion.form>
        ) : null}
      </AnimatePresence>

      {deliverables.length === 0 ? (
        <EmptyState icon={PackageCheck} title="Nothing handed in yet" description="Create a deliverable to bundle your work and submit it for approval." />
      ) : (
        <div className="space-y-2">
          {deliverables.map(deliverable => (
            <article key={idOf(deliverable)} className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-[var(--text)]">{deliverable.title}</p>
                  <p className="text-[10px] text-[var(--muted)]">
                    {deliverable.ownerId?.name} · revision {deliverable.revision}
                  </p>
                </div>
                <Badge tone={STATUS_TONE[deliverable.status] || 'neutral'}>
                  {deliverable.status.replace(/_/g, ' ')}
                </Badge>
              </div>

              {deliverable.notes ? (
                <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-[var(--text-2)]">{deliverable.notes}</p>
              ) : null}

              <div className="mt-2 flex flex-wrap gap-1.5 border-t border-[var(--border)] pt-2">
                {['draft', 'changes_requested'].includes(deliverable.status) ? (
                  <Button
                    size="sm"
                    variant="primary"
                    loading={busy === `submit:${idOf(deliverable)}`}
                    onClick={() =>
                      act(`submit:${idOf(deliverable)}`, () =>
                        api.post(`/api/collab/deliverables/${idOf(deliverable)}/submit`, {})
                      )
                    }
                  >
                    <Send className="h-3 w-3" />
                    Submit for approval
                  </Button>
                ) : null}

                {deliverable.status === 'approved' ? (
                  <Button size="sm" variant="secondary" onClick={() => setHandoffFor(deliverable)}>
                    <Share2 className="h-3 w-3" />
                    Hand to a teammate
                  </Button>
                ) : null}

                {deliverable.status === 'in_review' ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-[var(--muted)]">
                    <Clock3 className="h-3 w-3" />
                    waiting on review
                  </span>
                ) : null}
              </div>

              {handoffFor && idOf(handoffFor) === idOf(deliverable) ? (
                <HandoffForm
                  deliverable={deliverable}
                  members={members}
                  busy={busy}
                  onCancel={() => setHandoffFor(null)}
                  onSend={payload =>
                    act(`handoff:${idOf(deliverable)}`, async () => {
                      await api.post('/api/collab/handoffs', { deliverableId: idOf(deliverable), ...payload });
                      setHandoffFor(null);
                    })
                  }
                />
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function HandoffForm({ deliverable, members, busy, onCancel, onSend }) {
  const [toUserIds, setToUserIds] = useState([]);
  const [note, setNote] = useState('');

  const toggle = userId =>
    setToUserIds(current => (current.includes(userId) ? current.filter(value => value !== userId) : [...current, userId]));

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-[var(--accent-line)] bg-[var(--accent-soft)] p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)]">
        Hand “{deliverable.title}” to
      </p>
      <div className="flex flex-wrap gap-1.5">
        {members.map(member => {
          const on = toUserIds.includes(String(member.userId));
          return (
            <button
              key={member.userId}
              type="button"
              onClick={() => toggle(String(member.userId))}
              aria-pressed={on}
              className={`focus-ring inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold transition-colors ${
                on
                  ? 'border-[var(--accent-line)] bg-[var(--accent)]/20 text-[var(--accent)]'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]'
              }`}
            >
              {on ? <Check className="h-2.5 w-2.5" /> : null}
              {member.name}
            </button>
          );
        })}
      </div>
      <Input
        value={note}
        onChange={event => setNote(event.target.value)}
        placeholder="A note for them"
        className="text-xs"
      />
      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant="primary"
          loading={busy === `handoff:${idOf(deliverable)}`}
          disabled={toUserIds.length === 0}
          onClick={() => onSend({ toUserIds, note })}
        >
          Send handoff
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

/* ── Chat ─────────────────────────────────────────────────────────────────── */

function ChatTab({ projectId, messages, setMessages, setError }) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);

  const send = async event => {
    event.preventDefault();
    const text = body.trim();
    if (!text) return;
    setSending(true);
    setError('');
    try {
      const payload = await api.post(`/api/collab/projects/${projectId}/messages`, { body: text });
      /*
       * Append from the response rather than waiting for the socket to echo it
       * back. Socket.IO does not deliver a broadcast to a member who has not
       * finished joining the room, so the author was the one person who could
       * miss their own message.
       */
      const message = payload?.data?.message;
      if (message) {
        setMessages(current =>
          current.some(item => idOf(item) === idOf(message)) ? current : [...current, message]
        );
      }
      setBody('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] leading-relaxed text-[var(--muted)]">
        Visible only to people on this project.
      </p>

      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--border)] px-3 py-4 text-center text-[11px] text-[var(--muted)]">
            No messages yet.
          </p>
        ) : null}
        {messages.map(message => (
          <div key={idOf(message)} className="rounded-lg border border-[var(--border)] bg-[var(--surface2)] p-2.5">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-2)]">
              <UserCircle className="h-3 w-3 text-[var(--muted)]" />
              {message.authorId?.name || 'Member'}
              <span className="font-normal text-[var(--muted)]">
                {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </p>
            <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-[var(--text)]">{message.body}</p>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="flex gap-1.5">
        <Input
          value={body}
          onChange={event => setBody(event.target.value)}
          placeholder="Message the crew"
          className="text-xs"
        />
        <Button type="submit" size="sm" variant="primary" loading={sending} disabled={!body.trim()}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  );
}
