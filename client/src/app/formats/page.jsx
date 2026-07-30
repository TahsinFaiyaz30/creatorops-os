'use client';

/**
 * Platform Format Rules — GET /api/platform-formats
 *
 * The server seeds 11 PlatformFormatRule documents (caption limits, hashtag
 * caps, media support flags, required elements, tone guidance) and the publish
 * validator enforces them. Nothing in the client ever rendered them, so creators
 * had no way to see the constraints their content is judged against.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Ruler, Hash, Type, Image as ImageIcon, Link2, Video, FileText,
  Check, X, Search
} from 'lucide-react';

import AppShell from '../../components/layout/AppShell';
import {
  Page, PageHeader, Section, Surface, Badge, Input, Field,
  EmptyState, Skeleton, Notice, StatTile, StatGrid, useStagger
} from '../../components/ds';
import { api } from '../../lib/api';

const SUPPORT_FLAGS = [
  { key: 'supportsImage',      label: 'Image',       icon: ImageIcon },
  { key: 'supportsShortVideo', label: 'Short video', icon: Video },
  { key: 'supportsLongText',   label: 'Long text',   icon: FileText },
  { key: 'supportsLinks',      label: 'Links',       icon: Link2 }
];

function SupportPill({ ok, label, icon: Icon }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium ${
        ok
          ? 'border-success/30 bg-success/10 text-success'
          : 'border-[var(--border)] bg-[var(--surface2)] text-[var(--muted)]'
      }`}
    >
      <Icon className="h-3 w-3" />
      {label}
      {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 opacity-60" />}
    </span>
  );
}

function RuleCard({ rule }) {
  const { item } = useStagger();
  return (
    <Surface as="article" interactive pad="md" className="flex flex-col gap-3">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-[var(--text)]">
            {rule.displayName || rule.platform}
          </h3>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
            {rule.platform}
          </p>
        </div>
        <Badge tone="accent">
          <Type className="h-3 w-3" />
          {rule.maxCaptionLength ?? '—'}
        </Badge>
      </header>

      <dl className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-2.5 py-2">
          <dt className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Caption max</dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--text)]">
            {rule.maxCaptionLength?.toLocaleString() ?? '—'}
          </dd>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-2.5 py-2">
          <dt className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Hashtag cap</dt>
          <dd className="mt-0.5 flex items-center gap-1 text-sm font-semibold tabular-nums text-[var(--text)]">
            <Hash className="h-3 w-3 text-[var(--muted)]" />
            {rule.maxHashtags ?? '—'}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-1.5">
        {SUPPORT_FLAGS.map(f => (
          <SupportPill key={f.key} ok={Boolean(rule[f.key])} label={f.label} icon={f.icon} />
        ))}
      </div>

      {rule.contentStyle ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Tone</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-2)]">{rule.contentStyle}</p>
        </div>
      ) : null}

      {rule.ctaStyle ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">CTA</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-2)]">{rule.ctaStyle}</p>
        </div>
      ) : null}

      {rule.requirements?.length ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Required elements
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {rule.requirements.map(r => (
              <li key={r}>
                <Badge>{r}</Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {rule.recommendedHashtags?.length ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Suggested hashtags
          </p>
          <p className="mt-1 font-mono text-[11px] text-[var(--accent)]">
            {rule.recommendedHashtags.join('  ')}
          </p>
        </div>
      ) : null}
    </Surface>
  );
}

export default function FormatsPage() {
  const [rules, setRules] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    api
      .get('/api/platform-formats')
      .then(payload => setRules(payload?.data?.rules || []))
      .catch(err => setError(err.message));
  }, []);

  const filtered = useMemo(() => {
    if (!rules) return null;
    const q = query.trim().toLowerCase();
    if (!q) return rules;
    return rules.filter(
      r =>
        r.platform?.toLowerCase().includes(q) ||
        r.displayName?.toLowerCase().includes(q) ||
        r.contentStyle?.toLowerCase().includes(q)
    );
  }, [rules, query]);

  const stats = useMemo(() => {
    if (!rules?.length) return null;
    const caps = rules.map(r => r.maxCaptionLength).filter(Boolean);
    return {
      platforms: rules.length,
      video: rules.filter(r => r.supportsShortVideo).length,
      longText: rules.filter(r => r.supportsLongText).length,
      tightest: caps.length ? Math.min(...caps) : '—',
      widest: caps.length ? Math.max(...caps) : '—'
    };
  }, [rules]);

  return (
    <AppShell>
      <Page>
        <PageHeader
          eyebrow="Distribute"
          title="Platform Format Rules"
          description="The constraints the publish validator enforces before anything ships. Sourced live from the server's seeded format rules — one per supported platform."
        />

        {error ? <Notice tone="danger">{error}</Notice> : null}

        {stats ? (
          <StatGrid>
            <StatTile label="Platforms" value={stats.platforms} icon={Ruler} tone="accent" />
            <StatTile label="Short video" value={stats.video} icon={Video} tone="success" />
            <StatTile label="Long text" value={stats.longText} icon={FileText} />
            <StatTile
              label="Tightest caption"
              value={typeof stats.tightest === 'number' ? stats.tightest.toLocaleString() : stats.tightest}
              icon={Type}
              tone="warning"
              hint="Lowest cap across platforms"
            />
            <StatTile
              label="Widest caption"
              value={typeof stats.widest === 'number' ? stats.widest.toLocaleString() : stats.widest}
              icon={Type}
            />
          </StatGrid>
        ) : null}

        <Section
          title="Per-platform rules"
          description={filtered ? `${filtered.length} shown` : undefined}
          actions={
            <Field className="w-48 sm:w-64">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
                <Input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Filter platforms…"
                  aria-label="Filter platforms"
                  className="pl-8"
                />
              </div>
            </Field>
          }
        >
          {!rules ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-64" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No platforms match that filter"
              description="Try a platform name like “instagram”, or clear the filter."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map(rule => (
                <RuleCard key={rule._id || rule.platform} rule={rule} />
              ))}
            </div>
          )}
        </Section>
      </Page>
    </AppShell>
  );
}
