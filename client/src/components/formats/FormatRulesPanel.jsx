'use client';

/**
 * Format rules, rendered as a panel on the Connections page.
 *
 * These describe what a platform accepts and what the connected account can
 * actually do there — the same subject as a connection, so they were a separate
 * nav entry describing the thing on the page next door.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Platform Rules — GET /api/platform-formats + GET /api/platform-connections/capabilities
 *
 * Two 11-row datasets the server has always exposed and nothing rendered:
 *   · PlatformFormatRule  — caption caps, hashtag limits, media support, tone,
 *                           required elements. The publish validator enforces
 *                           these, so a creator was being judged against rules
 *                           they could not read.
 *   · capabilities        — per-platform publish/schedule/analytics/comments/
 *                           replies/mediaUpload/delete matrix, plus whether the
 *                           platform is actually configured and which env vars
 *                           and OAuth scopes it needs.
 *
 * Merged by platform so one card answers both "what may I post" and "what can
 * this connection actually do". Compare view puts all 11 side by side, which is
 * how you actually choose a target set.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Ruler, Hash, Type, Image as ImageIcon, Link2, Video, FileText,
  Check, X, Search, LayoutGrid, Table2, Send, CalendarClock, BarChart3,
  MessageSquare, CornerDownRight, Upload, Trash2, Plug, ShieldAlert, ArrowUpDown
} from 'lucide-react';

import {
  Page, Section, Surface, Badge, Button, Input,
  EmptyState, Skeleton, GlareStat, GlareStatGrid, GLARE_TINTS, useStagger
} from '../ds';
import { api } from '../../lib/api';
import { useToastState } from '../ui/toast';

const EASE = [0.16, 1, 0.3, 1];

const MARKS = {
  facebook: 'Fb', instagram: 'Ig', tiktok: 'Tt', youtube: 'Yt',
  youtube_shorts: 'Sh', threads: 'Th', linkedin: 'In', x: 'X',
  pinterest: 'Pi', wordpress: 'Wp', shopify: 'Sp'
};

const MEDIA_FLAGS = [
  { key: 'supportsImage',      label: 'Image', icon: ImageIcon },
  { key: 'supportsShortVideo', label: 'Video', icon: Video },
  { key: 'supportsLongText',   label: 'Text',  icon: FileText },
  { key: 'supportsLinks',      label: 'Links', icon: Link2 }
];

const CAPS = [
  { key: 'publish',     label: 'Publish',   icon: Send },
  { key: 'schedule',    label: 'Schedule',  icon: CalendarClock },
  { key: 'analytics',   label: 'Analytics', icon: BarChart3 },
  { key: 'comments',    label: 'Comments',  icon: MessageSquare },
  { key: 'replies',     label: 'Replies',   icon: CornerDownRight },
  { key: 'mediaUpload', label: 'Upload',    icon: Upload },
  { key: 'delete',      label: 'Delete',    icon: Trash2 }
];

const SORTS = [
  { key: 'name',    label: 'A–Z' },
  { key: 'caption', label: 'Caption cap' },
  { key: 'hashtag', label: 'Hashtags' }
];

/* ── Small pieces ─────────────────────────────────────────────────────────── */

function Flag({ ok, label, icon: Icon }) {
  return (
    <span
      title={`${label}: ${ok ? 'supported' : 'not supported'}`}
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
        ok
          ? 'border-success/30 bg-success/10 text-success'
          : 'border-[var(--border)] bg-[var(--surface2)] text-[var(--muted)] opacity-60'
      }`}
    >
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

function CapDot({ ok, label, icon: Icon }) {
  return (
    <span
      title={`${label}: ${ok ? 'available' : 'unavailable'}`}
      className={`flex h-6 w-6 items-center justify-center rounded-md border ${
        ok
          ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]'
          : 'border-[var(--border)] bg-[var(--surface2)] text-[var(--muted)] opacity-40'
      }`}
    >
      <Icon className="h-3 w-3" />
    </span>
  );
}

/* Caption cap drawn relative to the widest platform, so the spread is visible. */
function CaptionGauge({ value, max }) {
  const pct = max ? Math.max(3, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          <Type className="h-2.5 w-2.5" />
          Caption cap
        </span>
        <span className="text-[11px] font-bold tabular-nums text-[var(--text)]">
          {value?.toLocaleString() ?? '—'}
        </span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--surface3)]">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[#6344F5] to-[#AE48FF]"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: EASE }}
        />
      </div>
    </div>
  );
}

/* ── Rule card ────────────────────────────────────────────────────────────── */

function RuleCard({ rule, maxCaption, hovered, setHovered, index }) {
  const caps = rule.capabilities || {};
  const capCount = CAPS.filter(c => caps[c.key]).length;

  /*
   * The hovered card lifts; its siblings are left alone.
   *
   * This grid used to blur and shrink every other card whenever the pointer
   * touched one, so scrolling past dragged a wave of defocus across the page and
   * anything you were reading nearby went soft. Hover should answer "this one",
   * not repaint the rest of the screen.
   */
  return (
    <motion.article
      layout
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/75 shadow-[var(--shadow)] backdrop-blur-xl transition-[border-color,box-shadow] duration-200 hover:border-[var(--accent-line)] hover:shadow-[0_16px_48px_-20px_var(--glow)]"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_70%_at_0%_0%,var(--accent-soft),transparent_55%)]"
      />

      <div className="relative space-y-3 p-4">
        {/* Head */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--accent-line)] bg-[var(--accent-soft)] text-[11px] font-bold text-[var(--accent)]">
              {MARKS[rule.platform] || rule.platform.slice(0, 2)}
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold tracking-tight text-[var(--text)]">
                {rule.displayName || rule.platform}
              </h3>
              <p className="truncate font-mono text-[9px] uppercase tracking-wider text-[var(--muted)]">
                {rule.platform}
              </p>
            </div>
          </div>
          <Badge tone={rule.configured ? 'success' : 'neutral'}>
            <Plug className="h-2.5 w-2.5" />
            {rule.configured ? 'configured' : 'not set up'}
          </Badge>
        </div>

        <CaptionGauge value={rule.maxCaptionLength} max={maxCaption} />

        {/* Numbers */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-2.5 py-1.5">
            <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-[var(--muted)]">
              <Hash className="h-2.5 w-2.5" /> Hashtags
            </p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-[var(--text)]">
              {rule.maxHashtags ?? '—'}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-2.5 py-1.5">
            <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-[var(--muted)]">
              <Plug className="h-2.5 w-2.5" /> Capabilities
            </p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-[var(--text)]">
              {capCount}<span className="text-[10px] font-normal text-[var(--muted)]">/{CAPS.length}</span>
            </p>
          </div>
        </div>

        {/* Media support */}
        <div className="flex flex-wrap gap-1">
          {MEDIA_FLAGS.map(f => (
            <Flag key={f.key} ok={Boolean(rule[f.key])} label={f.label} icon={f.icon} />
          ))}
        </div>

        {/* Capability matrix */}
        {rule.capabilities ? (
          <div>
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Connection can
            </p>
            <div className="flex flex-wrap gap-1">
              {CAPS.map(c => (
                <CapDot key={c.key} ok={Boolean(caps[c.key])} label={c.label} icon={c.icon} />
              ))}
            </div>
          </div>
        ) : null}

        {/* Tone / CTA */}
        {rule.contentStyle ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-2.5 py-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--accent)]">Tone</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-2)]">{rule.contentStyle}</p>
          </div>
        ) : null}
        {rule.ctaStyle ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-2.5 py-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--accent)]">CTA</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-2)]">{rule.ctaStyle}</p>
          </div>
        ) : null}

        {rule.requirements?.length ? (
          <div className="flex flex-wrap gap-1">
            {rule.requirements.map(r => <Badge key={r}>{r}</Badge>)}
          </div>
        ) : null}

        {rule.recommendedHashtags?.length ? (
          <p className="font-mono text-[10px] text-[var(--accent)]">
            {rule.recommendedHashtags.join('  ')}
          </p>
        ) : null}

        {/* What it needs to work — only when unconfigured */}
        {!rule.configured && rule.requiredEnv?.length ? (
          <div className="rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-1.5">
            <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-warning">
              <ShieldAlert className="h-2.5 w-2.5" /> Needs
            </p>
            <p className="mt-0.5 font-mono text-[10px] leading-relaxed text-warning/90">
              {rule.requiredEnv.join(', ')}
            </p>
          </div>
        ) : null}
      </div>
    </motion.article>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function FormatRulesPanel() {
  const [rules, setRules] = useState(null);
  const [error, setError] = useToastState('danger');
  const [query, setQuery] = useState('');
  const [view, setView] = useState('cards');
  const [sort, setSort] = useState('name');
  const [hovered, setHovered] = useState(null);
  const { item } = useStagger(0.04);

  useEffect(() => {
    Promise.allSettled([
      api.get('/api/platform-formats'),
      api.get('/api/platform-connections/capabilities')
    ]).then(([f, c]) => {
      if (f.status !== 'fulfilled') {
        setError(f.reason?.message || 'Could not load format rules.');
        setRules([]);
        return;
      }
      const formats = f.value?.data?.rules || [];
      const capsList = c.status === 'fulfilled' ? c.value?.data?.platforms || [] : [];
      const capsBy = Object.fromEntries(capsList.map(p => [p.platform, p]));
      setRules(formats.map(r => ({ ...r, ...(capsBy[r.platform] || {}) })));
    });
  }, []);

  const maxCaption = useMemo(
    () => (rules?.length ? Math.max(...rules.map(r => r.maxCaptionLength || 0)) : 0),
    [rules]
  );

  const filtered = useMemo(() => {
    if (!rules) return null;
    const q = query.trim().toLowerCase();
    const list = q
      ? rules.filter(
          r =>
            r.platform?.toLowerCase().includes(q) ||
            r.displayName?.toLowerCase().includes(q) ||
            r.contentStyle?.toLowerCase().includes(q)
        )
      : [...rules];

    return list.sort((a, b) => {
      if (sort === 'caption') return (b.maxCaptionLength || 0) - (a.maxCaptionLength || 0);
      if (sort === 'hashtag') return (b.maxHashtags || 0) - (a.maxHashtags || 0);
      return (a.displayName || a.platform).localeCompare(b.displayName || b.platform);
    });
  }, [rules, query, sort]);

  const stats = useMemo(() => {
    if (!rules?.length) return null;
    const caps = rules.map(r => r.maxCaptionLength).filter(Boolean);
    return {
      platforms: rules.length,
      configured: rules.filter(r => r.configured).length,
      video: rules.filter(r => r.supportsShortVideo).length,
      tightest: caps.length ? Math.min(...caps) : '—',
      widest: caps.length ? Math.max(...caps) : '—'
    };
  }, [rules]);

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
        What each platform will accept, and what your connection can actually do there. The publish validator enforces
        these limits before anything ships.
      </p>


        {stats ? (
          <GlareStatGrid>
            <GlareStat label="Platforms"  value={stats.platforms}  icon={Ruler} tint={GLARE_TINTS[0]} />
            <GlareStat label="Configured" value={`${stats.configured}/${stats.platforms}`} icon={Plug} tint={GLARE_TINTS[1]} hint="OAuth credentials set" />
            <GlareStat label="Short video" value={stats.video}     icon={Video} tint={GLARE_TINTS[2]} />
            <GlareStat
              label="Tightest caption"
              value={typeof stats.tightest === 'number' ? stats.tightest.toLocaleString() : stats.tightest}
              icon={Type}
              tint={GLARE_TINTS[3]}
              hint="Governs cross-posts"
            />
            <GlareStat
              label="Widest caption"
              value={typeof stats.widest === 'number' ? stats.widest.toLocaleString() : stats.widest}
              icon={FileText}
              tint={GLARE_TINTS[4]}
            />
          </GlareStatGrid>
        ) : null}

        <Section
          title="Per platform"
          description={filtered ? `${filtered.length} shown` : undefined}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {/* Sort */}
              <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface2)] p-0.5">
                {SORTS.map(s => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSort(s.key)}
                    aria-pressed={sort === s.key}
                    className={`focus-ring relative rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                      sort === s.key ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    {sort === s.key && (
                      <motion.span
                        layoutId="fmt-sort-pill"
                        className="absolute inset-0 rounded-md bg-[var(--accent-soft)]"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                    <span className="relative flex items-center gap-1">
                      {s.key !== 'name' ? <ArrowUpDown className="h-2.5 w-2.5" /> : null}
                      {s.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* View */}
              <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface2)] p-0.5">
                {[
                  { key: 'cards', icon: LayoutGrid, label: 'Card view' },
                  { key: 'table', icon: Table2, label: 'Compare view' }
                ].map(v => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => setView(v.key)}
                    aria-label={v.label}
                    aria-pressed={view === v.key}
                    className={`focus-ring rounded-md p-1.5 transition-colors ${
                      view === v.key
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                        : 'text-[var(--muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    <v.icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>

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
            </div>
          }
        >
          {!filtered ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-80" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No platforms match that filter"
              description="Try a platform name like “instagram”, or clear the filter."
              action={
                <Button variant="secondary" size="sm" onClick={() => setQuery('')}>
                  Clear filter
                </Button>
              }
            />
          ) : view === 'cards' ? (
            <motion.div
              layout
              onMouseLeave={() => setHovered(null)}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
            >
              <AnimatePresence mode="popLayout">
                {filtered.map((rule, i) => (
                  <RuleCard
                    key={rule._id || rule.platform}
                    rule={rule}
                    index={i}
                    hovered={hovered}
                    setHovered={setHovered}
                    maxCaption={maxCaption}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            /* Compare — how you actually pick a target set */
            <Surface pad="none" className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--surface2)]">
                      {['Platform', 'Caption', 'Hashtags', 'Media', 'Capabilities', 'Setup'].map(h => (
                        <th
                          key={h}
                          className="whitespace-nowrap px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r => (
                      <tr
                        key={r._id || r.platform}
                        className="border-b border-[var(--border)] transition-colors last:border-0 hover:bg-[var(--surface2)]"
                      >
                        <td className="px-3 py-2.5">
                          <span className="flex items-center gap-2">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[var(--accent-line)] bg-[var(--accent-soft)] text-[9px] font-bold text-[var(--accent)]">
                              {MARKS[r.platform] || r.platform.slice(0, 2)}
                            </span>
                            <span className="text-xs font-medium text-[var(--text)]">
                              {r.displayName || r.platform}
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-xs font-semibold tabular-nums text-[var(--text)]">
                            {r.maxCaptionLength?.toLocaleString() ?? '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs tabular-nums text-[var(--text-2)]">
                          {r.maxHashtags ?? '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="flex gap-1">
                            {MEDIA_FLAGS.map(f => (
                              <span
                                key={f.key}
                                title={f.label}
                                className={r[f.key] ? 'text-success' : 'text-[var(--muted)] opacity-35'}
                              >
                                <f.icon className="h-3 w-3" />
                              </span>
                            ))}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="flex gap-0.5">
                            {CAPS.map(c => (
                              <span
                                key={c.key}
                                title={c.label}
                                className={
                                  r.capabilities?.[c.key]
                                    ? 'text-[var(--accent)]'
                                    : 'text-[var(--muted)] opacity-30'
                                }
                              >
                                <c.icon className="h-3 w-3" />
                              </span>
                            ))}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          {r.configured ? (
                            <Check className="h-3.5 w-3.5 text-success" />
                          ) : (
                            <X className="h-3.5 w-3.5 text-[var(--muted)] opacity-50" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Surface>
          )}
        </Section>
    </div>
  );
}
