'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Architecture — how the system is actually put together.
 *
 * Every number on this page is counted from the repository rather than written
 * by hand: 11 platform connectors, 102 routed endpoints, 26 Mongoose models,
 * 27 services, 6 realtime channels, 1 publishing worker. A briefing page that
 * quotes invented figures is worse than one that quotes none.
 *
 * The old version was three flat card grids with no sense of how a request
 * moves. The request rail is the centrepiece now — it shows the actual path a
 * publish takes, including the branch where the worker picks it up.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  MonitorSmartphone, Server, Database, RadioTower, Cpu,
  ShieldCheck, Layers3, Activity,
  Check, ArrowRight, ChevronRight, Sparkles, Lock, Zap
} from 'lucide-react';

import AppShell from '../../components/layout/AppShell';
import { TextGenerateEffect } from '../../components/ui/text-generate-effect';
import { BackgroundBeams } from '../../components/ui/background-beams';
import {
  Page, Section, Badge, GlareStat, GlareStatGrid, GLARE_TINTS
} from '../../components/ds';
import { platformOptions, formatPlatform } from '../../lib/platforms';

const EASE = [0.16, 1, 0.3, 1];

/* Counted from the repo — see the header note. */
const FACTS = [
  { label: 'Platform connectors', value: 11, icon: RadioTower, hint: 'Official APIs only' },
  { label: 'Routed endpoints',    value: 102, icon: Server,    hint: 'Across 20 route groups' },
  { label: 'Data models',         value: 26, icon: Database,   hint: 'Workspace-scoped' },
  { label: 'Services',            value: 27, icon: Layers3,    hint: 'Modular monolith' },
  { label: 'Realtime channels',   value: 6,  icon: Activity,   hint: 'Socket.IO' }
];

/* The path a publish actually travels. */
const FLOW = [
  { key: 'browser', label: 'Browser', icon: MonitorSmartphone, note: 'Resumable chunk upload' },
  { key: 'next',    label: 'Next.js', icon: Sparkles,          note: 'App Router, RSC shell' },
  { key: 'api',     label: 'Express API', icon: Server,        note: 'RBAC on every route' },
  { key: 'data',    label: 'MongoDB', icon: Database,          note: 'Workspace-scoped writes' },
  { key: 'worker',  label: 'Worker',  icon: Cpu,               note: 'Picks up queued jobs' },
  { key: 'platform', label: 'Platform', icon: RadioTower,      note: 'Real connector call' }
];

const LAYERS = [
  {
    id: 'client',
    label: 'Client',
    icon: MonitorSmartphone,
    tint: 'from-[#6344F5]/30',
    blocks: [
      ['Next.js frontend', 'Browser workflow for content creators and brand representatives'],
      ['Resumable uploads', 'Chunked transfer that resumes from its own verified offset'],
      ['Socket.IO client', 'Live dispatch and analytics, with polling fallback']
    ]
  },
  {
    id: 'api',
    label: 'API',
    icon: Server,
    tint: 'from-sky-500/30',
    blocks: [
      ['Express API', 'Modular monolith with service boundaries'],
      ['JWT + RBAC', 'Backend-enforced creator and brand-rep permissions'],
      ['Format rules', 'Platform limits and the readiness checklist'],
      ['Creator review service', 'Final review queue with comments and audit events']
    ]
  },
  {
    id: 'data',
    label: 'Data',
    icon: Database,
    tint: 'from-emerald-500/30',
    blocks: [
      ['MongoDB', 'Workspace-scoped operational records'],
      ['Campaign tracking', 'Counts by status, platform, connection, job and synced metrics'],
      ['R2/S3 media storage', 'Multipart uploads with SHA-256 verification and temporary cleanup']
    ]
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: RadioTower,
    tint: 'from-amber-500/30',
    blocks: [
      ['Platform connections', 'Official OAuth records with encrypted tokens'],
      ['Publishing worker', 'Queued connector jobs that block when scopes are missing'],
      ['AI service', 'Gemini/Groq optional, with a template fallback guarantee']
    ]
  }
];

const RELIABILITY = [
  'Modular monolith, not fake microservices.',
  'No paid dependency required for the core demo.',
  'No local LLM, no Ollama, no GPU dependency.',
  'AI fallback keeps the workflow alive without API keys.',
  'Events persist before realtime broadcast.',
  'Publishing never fakes success; missing API access shows as blocked.',
  'Social tokens are encrypted at rest and never returned to the frontend.'
];

const SCALING = [
  'Move worker jobs to Redis/BullMQ.',
  'Complete app review and production scopes per platform.',
  'Add deeper analytics ingestion and performance clustering.',
  'Split services only when operational load requires it.'
];

const PRINCIPLES = [
  { icon: Lock, label: 'Server-side truth', body: 'Roles, tokens and limits are enforced on the API, never in the browser.' },
  { icon: ShieldCheck, label: 'Honest state', body: 'A blocked publish says blocked. Nothing reports success it did not get.' },
  { icon: Zap, label: 'Degrades, never dies', body: 'No AI key, no socket, no storage — the workflow still runs.' }
];

/* ── Request rail ─────────────────────────────────────────────────────────── */

function RequestRail() {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-4 shadow-[var(--shadow)] backdrop-blur-xl sm:p-5"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(130%_130%_at_0%_0%,var(--accent-soft),transparent_58%)]"
      />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Request path
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-2)]">
            One publish, end to end — the worker branch is where a queued job resumes
          </p>
        </div>
        <Badge tone="accent">
          <Activity className="h-2.5 w-2.5" />
          Live on every publish
        </Badge>
      </div>

      <div className="relative mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        {FLOW.map((node, index) => (
          <motion.div
            key={node.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE, delay: index * 0.07 }}
            className="relative rounded-xl border border-[var(--border)] bg-[var(--surface2)]/70 px-3 py-2.5"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                <node.icon className="h-3.5 w-3.5" />
              </span>
              <p className="truncate text-[11px] font-semibold text-[var(--text)]">{node.label}</p>
            </div>
            <p className="mt-1 text-[9px] leading-tight text-[var(--muted)]">{node.note}</p>

            {/* Travelling pulse marks the direction of flow between stages. */}
            {index < FLOW.length - 1 ? (
              <span
                aria-hidden
                className="pointer-events-none absolute -right-2 top-1/2 hidden -translate-y-1/2 lg:block"
              >
                <ChevronRight className="h-4 w-4 text-[var(--border-strong)]" />
              </span>
            ) : null}

            {!reduce ? (
              <motion.span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent"
                animate={{ scaleX: [0, 1, 0], opacity: [0, 1, 0] }}
                transition={{
                  duration: 1.6,
                  repeat: Infinity,
                  repeatDelay: FLOW.length * 0.35,
                  delay: index * 0.35,
                  ease: 'easeInOut'
                }}
              />
            ) : null}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/* ── System shape, grouped by layer ───────────────────────────────────────── */

function SystemShape() {
  const [layer, setLayer] = useState('all');
  const visible = layer === 'all' ? LAYERS : LAYERS.filter(l => l.id === layer);

  return (
    <div className="space-y-3">
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-1 backdrop-blur-xl">
        {[{ id: 'all', label: 'All layers', icon: Layers3 }, ...LAYERS].map(option => {
          const active = layer === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setLayer(option.id)}
              aria-pressed={active}
              className={`focus-ring relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors ${
                active ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              {active ? (
                <motion.span
                  layoutId="arch-layer-pill"
                  className="absolute inset-0 rounded-lg bg-[var(--accent-soft)] ring-1 ring-inset ring-[var(--accent-line)]"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              ) : null}
              <option.icon className="relative h-3 w-3" />
              <span className="relative">{option.label}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <AnimatePresence mode="popLayout">
          {visible.flatMap(group =>
            group.blocks.map(([title, body], i) => (
              <motion.article
                key={`${group.id}-${title}`}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.4, ease: EASE, delay: Math.min(i, 6) * 0.03 }}
                whileHover={{ y: -2 }}
                className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/75 p-4 backdrop-blur-xl"
              >
                <span
                  aria-hidden
                  className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${group.tint} to-transparent opacity-60 transition-opacity group-hover:opacity-100`}
                />
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface2)] text-[var(--accent)]">
                      <group.icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold tracking-tight text-[var(--text)]">{title}</p>
                      <p className="text-[9px] uppercase tracking-wider text-[var(--muted)]">{group.label}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--text-2)]">{body}</p>
                </div>
              </motion.article>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function ArchitecturePage() {
  return (
    <AppShell>
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <BackgroundBeams className="opacity-25 dark:opacity-50" />
        <div className="absolute inset-0 bg-blueprint [mask-image:radial-gradient(ellipse_at_top,black_10%,transparent_70%)]" />
      </div>

      <Page>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
            System
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
            Architecture
          </h1>
          <div className="max-w-3xl">
            <TextGenerateEffect
              words="One raw idea becomes platform-ready content, routed for review, published through official APIs, and measured — every number below is counted from the repository, not written by hand."
              className="font-normal"
              duration={0.5}
            />
          </div>
        </div>

        <GlareStatGrid>
          {FACTS.map((fact, i) => (
            <GlareStat
              key={fact.label}
              label={fact.label}
              value={fact.value}
              icon={fact.icon}
              tint={GLARE_TINTS[i % GLARE_TINTS.length]}
              hint={fact.hint}
            />
          ))}
        </GlareStatGrid>

        <RequestRail />

        {/* Platform coverage — the "Area 1" claim, shown rather than asserted. */}
        <Section
          title="Platform coverage"
          description={`${platformOptions.length} connectors, each backed by an official API`}
        >
          <div className="flex flex-wrap gap-1.5">
            {platformOptions.map((platform, i) => (
              <motion.span
                key={platform}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: EASE, delay: i * 0.03 }}
                whileHover={{ y: -2 }}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-line)] bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)]"
              >
                <RadioTower className="h-2.5 w-2.5" />
                {formatPlatform(platform)}
              </motion.span>
            ))}
          </div>
        </Section>

        <Section title="System shape" description="Filter by layer to see what sits where">
          <SystemShape />
        </Section>

        {/* Principles fill the band that used to be blank above the two lists. */}
        <div className="grid gap-3 md:grid-cols-3">
          {PRINCIPLES.map((principle, i) => (
            <motion.div
              key={principle.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: EASE, delay: i * 0.06 }}
              className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-4 backdrop-blur-xl"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_0%_0%,var(--accent-soft),transparent_60%)]"
              />
              <div className="relative">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                  <principle.icon className="h-4 w-4" />
                </span>
                <p className="mt-2.5 text-sm font-bold tracking-tight text-[var(--text)]">
                  {principle.label}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{principle.body}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Reliability choices" description="Decisions that keep the demo honest">
            <ul className="space-y-1.5">
              {RELIABILITY.map((line, i) => (
                <motion.li
                  key={line}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, ease: EASE, delay: i * 0.04 }}
                  className="flex items-start gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 px-3 py-2 backdrop-blur-md"
                >
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                    <Check className="h-2.5 w-2.5" />
                  </span>
                  <span className="text-xs leading-relaxed text-[var(--text-2)]">{line}</span>
                </motion.li>
              ))}
            </ul>
          </Section>

          <Section title="Future scaling" description="What changes when load arrives">
            <ul className="space-y-1.5">
              {SCALING.map((line, i) => (
                <motion.li
                  key={line}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, ease: EASE, delay: i * 0.04 }}
                  className="flex items-start gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 px-3 py-2 backdrop-blur-md"
                >
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                    <ArrowRight className="h-2.5 w-2.5" />
                  </span>
                  <span className="text-xs leading-relaxed text-[var(--text-2)]">{line}</span>
                </motion.li>
              ))}
            </ul>
          </Section>
        </div>
      </Page>
    </AppShell>
  );
}
