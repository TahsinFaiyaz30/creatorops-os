'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * My Work — GET /api/content/mine, /api/collab/handoffs, /api/collab/deliverables
 *
 * One place a hired creator can answer "what is on me right now": tasks assigned
 * to them, work handed to them by teammates, and their own submissions waiting on
 * the head. Blocked tasks say what they are waiting on rather than simply looking
 * uneditable.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  ListTodo, Lock, Inbox, Send, Clock3, CheckCircle2, AlertTriangle, ArrowRight, PackageCheck
} from 'lucide-react';

import AppShell from '../../components/layout/AppShell';
import { Badge, Button, EmptyState, Page, Section, Skeleton } from '../../components/ds';
import { api } from '../../lib/api';
import { useToastState } from '../../components/ui/toast';

const EASE = [0.16, 1, 0.3, 1];

const DELIVERABLE_TONE = {
  draft: 'neutral',
  submitted: 'accent',
  in_review: 'accent',
  approved: 'success',
  changes_requested: 'warning',
  rejected: 'danger'
};

export default function MyWorkPage() {
  const [tasks, setTasks] = useState(null);
  const [handoffs, setHandoffs] = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [error, setError] = useToastState('danger');
  const [busy, setBusy] = useState('');

  const load = async () => {
    const [tasksPayload, handoffPayload, deliverablePayload] = await Promise.all([
      api.get('/api/content/mine'),
      api.get('/api/collab/handoffs').catch(() => null),
      api.get('/api/collab/deliverables?mine=true').catch(() => null)
    ]);
    setTasks(tasksPayload.data.tasks || []);
    setHandoffs(handoffPayload?.data?.handoffs || []);
    setDeliverables(deliverablePayload?.data?.deliverables || []);
  };

  useEffect(() => {
    load().catch(err => setError(err.message));
  }, []);

  const respond = async (handoff, status) => {
    setBusy(handoff._id);
    setError('');
    try {
      await api.post(`/api/collab/handoffs/${handoff._id}/respond`, { status });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const blocked = (tasks || []).filter(task => task.isBlocked);
  const open = (tasks || []).filter(task => !task.isBlocked);
  const incoming = handoffs.filter(handoff => handoff.status === 'sent');

  return (
    <AppShell>
      <Page>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Plan</p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">My Work</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
            Everything assigned to you across the projects you are on, work teammates handed you, and what you have
            submitted for approval.
          </p>
        </div>


        {incoming.length > 0 ? (
          <Section title="Handed to you" description="Work a teammate passed over.">
            <div className="grid gap-2 lg:grid-cols-2">
              {incoming.map(handoff => (
                <article
                  key={handoff._id}
                  className="rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[var(--text)]">
                        {handoff.deliverableId?.title || 'Work bundle'}
                      </p>
                      <p className="text-[11px] text-[var(--muted)]">
                        from {handoff.fromUserId?.name} · {handoff.projectId?.name}
                      </p>
                      {handoff.note ? (
                        <p className="mt-1 text-[11px] italic leading-relaxed text-[var(--text-2)]">“{handoff.note}”</p>
                      ) : null}
                    </div>
                    <Badge tone="accent">{handoff.status}</Badge>
                  </div>
                  <div className="mt-2.5 flex gap-1.5 border-t border-[var(--border)] pt-2.5">
                    <Button size="sm" variant="primary" loading={busy === handoff._id} onClick={() => respond(handoff, 'accepted')}>
                      <PackageCheck className="h-3.5 w-3.5" />
                      Accept
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => respond(handoff, 'returned')}>
                      Return
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </Section>
        ) : null}

        <Section
          title="Assigned to you"
          description={tasks ? `${open.length} ready · ${blocked.length} waiting` : undefined}
        >
          {!tasks ? (
            <div className="grid gap-2 lg:grid-cols-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-24" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <EmptyState
              icon={ListTodo}
              title="Nothing assigned yet"
              description="Tasks appear here when a team lead puts you on one. Switch teams from the sidebar if you expected work from another team."
            />
          ) : (
            <div className="grid gap-2 lg:grid-cols-2">
              {[...open, ...blocked].map((task, index) => (
                <TaskCard key={task._id} task={task} index={index} />
              ))}
            </div>
          )}
        </Section>

        {deliverables.length > 0 ? (
          <Section title="Your submissions" description="What you handed in and where it stands.">
            <div className="grid gap-2 lg:grid-cols-2">
              {deliverables.map(deliverable => (
                <article
                  key={deliverable._id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/75 p-3 backdrop-blur-xl"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[var(--text)]">{deliverable.title}</p>
                      <p className="text-[11px] text-[var(--muted)]">
                        {deliverable.projectId?.name} · revision {deliverable.revision}
                      </p>
                    </div>
                    <Badge tone={DELIVERABLE_TONE[deliverable.status] || 'neutral'}>
                      {deliverable.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  {deliverable.status === 'changes_requested' ? (
                    <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-warning">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      Changes were requested — open the project to see the notes and resubmit.
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </Section>
        ) : null}
      </Page>
    </AppShell>
  );
}

function TaskCard({ task, index }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE, delay: Math.min(index, 8) * 0.03 }}
      className={`rounded-xl border p-3 backdrop-blur-xl ${
        task.isBlocked
          ? 'border-warning/30 bg-warning/5'
          : 'border-[var(--border)] bg-[var(--surface)]/75'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[var(--text)]">{task.title}</p>
          <p className="text-[11px] text-[var(--muted)]">{task.campaignId?.name || 'No project'}</p>
        </div>
        {task.isBlocked ? (
          <Badge tone="warning">
            <Lock className="h-2.5 w-2.5" />
            waiting
          </Badge>
        ) : (
          <Badge tone="neutral">{task.status}</Badge>
        )}
      </div>

      <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-[var(--text-2)]">{task.rawIdea}</p>

      {task.isBlocked ? (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-[var(--surface2)] px-2 py-1.5 text-[10px] leading-relaxed text-[var(--muted)]">
          <Clock3 className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
          <span>
            Unlocks once {task.openBlockers.map(blocker => `"${blocker.title}"`).join(', ')}{' '}
            {task.openBlockers.length === 1 ? 'is' : 'are'} approved.
          </span>
        </p>
      ) : null}

      <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-2.5">
        {task.dueAt ? (
          <span className="text-[10px] text-[var(--muted)]">due {new Date(task.dueAt).toLocaleDateString()}</span>
        ) : null}
        {task.campaignId?._id ? (
          <Button as="a" size="sm" variant="ghost" href={`/campaigns/${task.campaignId._id}`} className="ml-auto">
            Open project
            <ArrowRight className="h-3 w-3" />
          </Button>
        ) : null}
      </div>
    </motion.article>
  );
}
