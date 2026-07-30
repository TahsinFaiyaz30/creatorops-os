'use client';

/**
 * Published Posts — GET /api/social/posts, /post-groups, POST /posts/:id/sync,
 * GET /posts/:id/metrics
 *
 * The server tracks every PublishedPost with provider URLs, analytics sync
 * timestamps, per-post error codes and a metrics snapshot history. The client
 * only surfaced post-groups inside the analytics page, so individual post state
 * and the per-post sync action were unreachable.
 */

import { useEffect, useMemo, useState } from 'react';
import { Rss, RefreshCw, ExternalLink, Layers, TriangleAlert, Activity } from 'lucide-react';

import AppShell from '../../components/layout/AppShell';
import {
  Page, PageHeader, Section, Surface, Badge, Button,
  EmptyState, Skeleton, Notice, StatTile, StatGrid, DataList
} from '../../components/ds';
import { api } from '../../lib/api';

const STATUS_TONE = {
  published: 'success', live: 'success', failed: 'danger',
  pending: 'warning', queued: 'warning', deleted: 'neutral'
};

const rel = d => {
  if (!d) return 'never';
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export default function PostsPage() {
  const [posts, setPosts] = useState(null);
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [syncing, setSyncing] = useState(null);

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
      live: posts.filter(p => ['published', 'live'].includes(p.status)).length,
      failed: posts.filter(p => p.status === 'failed' || p.errorCode).length,
      stale: posts.filter(p => !p.lastAnalyticsSyncAt).length
    };
  }, [posts, groups]);

  const columns = [
    {
      key: 'platform',
      header: 'Platform',
      render: p => (
        <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--text)]">
          {p.platform || '—'}
        </span>
      )
    },
    {
      key: 'caption',
      header: 'Caption',
      render: p => (
        <span className="line-clamp-2 max-w-md text-xs text-[var(--text-2)]">
          {p.caption || <span className="text-[var(--muted)]">No caption</span>}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: p => (
        <div className="flex flex-col items-start gap-1">
          <Badge tone={STATUS_TONE[p.status] || 'neutral'}>{p.status || 'unknown'}</Badge>
          {p.errorCode ? (
            <span className="font-mono text-[10px] text-danger">{p.errorCode}</span>
          ) : null}
        </div>
      )
    },
    {
      key: 'lastAnalyticsSyncAt',
      header: 'Analytics synced',
      render: p => (
        <span className={p.lastAnalyticsSyncAt ? 'tabular-nums text-xs' : 'text-xs text-[var(--muted)]'}>
          {rel(p.lastAnalyticsSyncAt)}
          {p.lastAnalyticsErrorCode ? (
            <span className="ml-1.5 font-mono text-[10px] text-warning">{p.lastAnalyticsErrorCode}</span>
          ) : null}
        </span>
      )
    },
    {
      key: 'lastCommentCount',
      header: 'Comments',
      align: 'right',
      render: p => <span className="tabular-nums">{p.lastCommentCount ?? 0}</span>
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: p => {
        const id = p._id || p.id;
        return (
          <div className="flex justify-end gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => sync(id)}
              disabled={syncing === id}
              aria-label="Re-sync analytics"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing === id ? 'animate-spin' : ''}`} />
            </Button>
            {p.providerPostUrl ? (
              <Button
                as="a"
                size="sm"
                variant="ghost"
                href={p.providerPostUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open on platform"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        );
      }
    }
  ];

  return (
    <AppShell>
      <Page>
        <PageHeader
          eyebrow="Measure"
          title="Published Posts"
          description="Every post the dispatch pipeline shipped, with its provider URL, analytics sync state and error codes. Re-sync pulls fresh metrics straight from the platform."
        />

        {error ? <Notice tone="danger">{error}</Notice> : null}
        {notice ? <Notice tone="success">{notice}</Notice> : null}

        {stats ? (
          <StatGrid>
            <StatTile label="Posts" value={stats.total} icon={Rss} tone="accent" />
            <StatTile label="Post groups" value={stats.groups} icon={Layers} />
            <StatTile label="Live" value={stats.live} icon={Activity} tone="success" />
            <StatTile label="Failed" value={stats.failed} icon={TriangleAlert} tone="danger" />
            <StatTile label="Never synced" value={stats.stale} icon={RefreshCw} tone="warning" />
          </StatGrid>
        ) : null}

        <Section title="All posts" description={posts ? `${posts.length} total` : undefined}>
          {!posts ? (
            <Skeleton className="h-48" />
          ) : (
            <DataList
              columns={columns}
              rows={posts}
              rowKey={p => p._id || p.id}
              empty={
                <EmptyState
                  icon={Rss}
                  title="Nothing published yet"
                  description="Publish from Dispatch and each post lands here with its live provider link, analytics sync state and comment count."
                />
              }
            />
          )}
        </Section>
      </Page>
    </AppShell>
  );
}
