'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Published Posts — GET /api/social/posts, /post-groups, POST /posts/:id/sync
 *
 * listPublishedPosts already populates platformConnectionId, mediaAssetIds (with
 * hydrated public URLs), variantId and contentItemId. The old table rendered a
 * platform string, a caption and a sync timestamp and dropped all four, so a
 * published post had no thumbnail, no account, and no link back to the idea it
 * came from. All of it is on the card now.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Rss, RefreshCw, ExternalLink, Layers, TriangleAlert, Activity,
  Search, MessageSquare, Clock3, ImageOff, Play, Send, AtSign, Lightbulb
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

const STATUS_TONE = {
  published: 'success', live: 'success', failed: 'danger',
  pending: 'warning', queued: 'warning', deleted: 'neutral'
};

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'live', label: 'Live' },
  { id: 'failed', label: 'Failed' },
  { id: 'stale', label: 'Never synced' }
];

const rel = d => {
  if (!d) return 'never';
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const idOf = post => String(post._id || post.id || '');

const isLive = post => ['published', 'live'].includes(post.status);

/* ── Media thumb ──────────────────────────────────────────────────────────── */

function PostMedia({ assets }) {
  const media = (assets || []).find(asset => asset?.publicUrl) || null;
  const [broken, setBroken] = useState(false);

  useEffect(() => { setBroken(false); }, [media?.publicUrl]);

  if (!media || broken) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-[var(--surface2)]">
        <ImageOff className="h-4 w-4 text-[var(--muted)]" />
        <span className="text-[9px] text-[var(--muted)]">{broken ? 'Unavailable' : 'No media'}</span>
      </div>
    );
  }

  return (
    <>
      {media.mediaType === 'video' ? (
        <>
          <video
            src={media.publicUrl}
            className="h-full w-full object-cover"
            muted
            playsInline
            preload="metadata"
            onError={() => setBroken(true)}
          />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
              <Play className="h-3 w-3 fill-white text-white" />
            </span>
          </span>
        </>
      ) : (
        <img
          src={media.publicUrl}
          alt={media.originalName || 'Post media'}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={() => setBroken(true)}
        />
      )}
    </>
  );
}

/* ── Post card ────────────────────────────────────────────────────────────── */

function PostCard({ post, index, syncing, onSync }) {
  const id = idOf(post);
  const connection = post.platformConnectionId || {};
  const idea = post.contentItemId || {};
  const handle = connection.accountHandle || connection.accountName || '';

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.4, ease: EASE, delay: Math.min(index, 8) * 0.03 }}
      className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/75 shadow-[var(--shadow)] backdrop-blur-xl"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_70%_at_0%_0%,var(--accent-soft),transparent_55%)]"
      />

      <div className="relative flex gap-3 p-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-[var(--border)]">
          <PostMedia assets={post.mediaAssetIds} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-1.5">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <Badge tone="accent">{formatPlatform(post.platform)}</Badge>
              <Badge tone={STATUS_TONE[post.status] || 'neutral'}>{post.status || 'unknown'}</Badge>
            </div>
            {post.errorCode ? (
              <span className="font-mono text-[9px] text-danger">{post.errorCode}</span>
            ) : null}
          </div>

          {handle ? (
            <p className="mt-1 flex items-center gap-1 truncate text-[10px] text-[var(--muted)]">
              <AtSign className="h-2.5 w-2.5" />
              {handle}
            </p>
          ) : null}

          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--text-2)]">
            {post.caption || <span className="text-[var(--muted)]">No caption stored.</span>}
          </p>

          {idea.title ? (
            <p className="mt-1 flex items-center gap-1 truncate text-[10px] text-[var(--muted)]">
              <Lightbulb className="h-2.5 w-2.5 text-[var(--accent)]" />
              from “{idea.title}”
            </p>
          ) : null}
        </div>
      </div>

      <div className="relative flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--surface2)]/40 px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[var(--muted)]">
          <span className="inline-flex items-center gap-1">
            <RefreshCw className="h-2.5 w-2.5" />
            {rel(post.lastAnalyticsSyncAt)}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="h-2.5 w-2.5" />
            {post.lastCommentCount ?? 0}
          </span>
          {post.publishedAt ? (
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-2.5 w-2.5" />
              {new Date(post.publishedAt).toLocaleDateString()}
            </span>
          ) : null}
          {post.lastAnalyticsErrorCode ? (
            <span className="font-mono text-warning">{post.lastAnalyticsErrorCode}</span>
          ) : null}
        </div>

        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => onSync(id)} disabled={syncing} aria-label="Re-sync analytics">
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
          </Button>
          {post.providerPostUrl ? (
            <Button
              as="a"
              size="sm"
              variant="secondary"
              href={post.providerPostUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open
            </Button>
          ) : null}
        </div>
      </div>
    </motion.article>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function PostsPage() {
  const [posts, setPosts] = useState(null);
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [syncing, setSyncing] = useState(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const load = async () => {
    const [p, g] = await Promise.allSettled([
      api.get('/api/social/posts'),
      api.get('/api/social/post-groups')
    ]);
    setPosts(p.value?.data?.posts || []);
    setGroups(g.value?.data?.groups || []);
  };

  useEffect(() => { load().catch(e => setError(e.message)); }, []);

  const sync = async id => {
    setSyncing(id);
    setError('');
    setNotice('');
    try {
      await api.post(`/api/social/posts/${id}/sync`, {});
      setNotice('Analytics re-synced from the provider.');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSyncing(null);
    }
  };

  const stats = useMemo(() => {
    if (!posts) return null;
    return {
      total: posts.length,
      groups: groups?.length || 0,
      live: posts.filter(isLive).length,
      failed: posts.filter(p => p.status === 'failed' || p.errorCode).length,
      stale: posts.filter(p => !p.lastAnalyticsSyncAt).length
    };
  }, [posts, groups]);

  const counts = useMemo(() => ({
    all: posts?.length || 0,
    live: stats?.live || 0,
    failed: stats?.failed || 0,
    stale: stats?.stale || 0
  }), [posts, stats]);

  const visible = useMemo(() => {
    if (!posts) return null;
    const q = query.trim().toLowerCase();
    return posts.filter(post => {
      if (filter === 'live' && !isLive(post)) return false;
      if (filter === 'failed' && !(post.status === 'failed' || post.errorCode)) return false;
      if (filter === 'stale' && post.lastAnalyticsSyncAt) return false;
      if (!q) return true;
      const connection = post.platformConnectionId || {};
      return [
        post.platform, post.caption, post.status,
        connection.accountHandle, connection.accountName,
        post.contentItemId?.title
      ]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(q));
    });
  }, [posts, filter, query]);

  return (
    <AppShell>
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <BackgroundBeams className="opacity-25 dark:opacity-50" />
        <div className="absolute inset-0 bg-blueprint [mask-image:radial-gradient(ellipse_at_top,black_10%,transparent_70%)]" />
      </div>

      <Page>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
            Measure
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
            Published Posts
          </h1>
          <div className="max-w-3xl">
            <TextGenerateEffect
              words="Every post the pipeline shipped, with the live provider link, the account it went out from, and the idea it started as. Re-sync pulls fresh metrics straight from the platform."
              className="font-normal"
              duration={0.5}
            />
          </div>
        </div>

        {error ? <Notice tone="danger">{error}</Notice> : null}
        {notice ? <Notice tone="success">{notice}</Notice> : null}

        {stats ? (
          <GlareStatGrid>
            <GlareStat label="Posts"        value={stats.total}  icon={Rss}           tint={GLARE_TINTS[0]} />
            <GlareStat label="Post groups"  value={stats.groups} icon={Layers}        tint={GLARE_TINTS[1]} hint="One idea, many platforms" />
            <GlareStat label="Live"         value={stats.live}   icon={Activity}      tint={GLARE_TINTS[2]} />
            <GlareStat label="Failed"       value={stats.failed} icon={TriangleAlert} tint={GLARE_TINTS[3]} />
            <GlareStat label="Never synced" value={stats.stale}  icon={RefreshCw}     tint={GLARE_TINTS[4]} />
          </GlareStatGrid>
        ) : null}

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-center">
          <div className="flex gap-1 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-1 backdrop-blur-xl">
            {FILTERS.map(f => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  aria-pressed={active}
                  className={`focus-ring relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors ${
                    active ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {active ? (
                    <motion.span
                      layoutId="posts-filter-pill"
                      className="absolute inset-0 rounded-lg bg-[var(--accent-soft)] ring-1 ring-inset ring-[var(--accent-line)]"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  ) : null}
                  <span className="relative">{f.label}</span>
                  <span
                    className={`relative rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                      active ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'bg-[var(--surface2)] text-[var(--muted)]'
                    }`}
                  >
                    {counts[f.id]}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Platform, account, caption, idea…"
              aria-label="Search posts"
              className="pl-8"
            />
          </div>
        </div>

        <Section
          title="All posts"
          description={visible ? `${visible.length} shown${posts && visible.length !== posts.length ? ` of ${posts.length}` : ''}` : undefined}
        >
          {!visible ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={Rss}
              title={posts?.length ? 'Nothing matches' : 'Nothing published yet'}
              description={
                posts?.length
                  ? 'Try another filter or clear the search.'
                  : 'Publish from Dispatch and each post lands here with its live provider link, analytics sync state and comment count.'
              }
              action={
                posts?.length ? (
                  <Button variant="secondary" size="sm" onClick={() => { setFilter('all'); setQuery(''); }}>
                    Clear filters
                  </Button>
                ) : (
                  <Button as="a" href="/publishing" variant="primary" size="sm">
                    <Send className="h-3.5 w-3.5" />
                    Open Dispatch
                  </Button>
                )
              }
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              <AnimatePresence mode="popLayout">
                {visible.map((post, index) => (
                  <PostCard
                    key={idOf(post)}
                    post={post}
                    index={index}
                    syncing={syncing === idOf(post)}
                    onSync={sync}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </Section>
      </Page>
    </AppShell>
  );
}
