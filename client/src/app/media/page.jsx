'use client';

/**
 * Media Library — GET /api/media, PATCH /api/media/:id, DELETE /api/media/:id
 *
 * The server has full media CRUD plus a resumable upload session lifecycle
 * (start/pause/resume/cancel) and a temporary-media cleanup worker. The client
 * only ever drove uploads from inside Compose, so there was no way to see, rename
 * or delete what had already been stored.
 */

import { useEffect, useMemo, useState } from 'react';
import { Images, Trash2, Pencil, HardDrive, Film, Image as ImageIcon, Clock, Search } from 'lucide-react';

import AppShell from '../../components/layout/AppShell';
import {
  Page, PageHeader, Section, Surface, Badge, Button, Input, Field,
  EmptyState, Skeleton, Notice, StatTile, StatGrid, DataList
} from '../../components/ds';
import { api } from '../../lib/api';

const fmtBytes = n => {
  if (!n) return '—';
  const u = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), u.length - 1);
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
};

const fmtDate = d => (d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—');

const STATUS_TONE = { ready: 'success', uploading: 'warning', failed: 'danger', temporary: 'warning' };

export default function MediaPage() {
  const [assets, setAssets] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const load = () =>
    api
      .get('/api/media')
      .then(p => setAssets(p?.data?.mediaAssets || []))
      .catch(e => setError(e.message));

  useEffect(() => { load(); }, []);

  const rename = async id => {
    try {
      await api.patch(`/api/media/${id}`, { originalName: renameValue });
      setNotice('Renamed.');
      setRenaming(null);
      await load();
    } catch (e) { setError(e.message); }
  };

  const remove = async id => {
    try {
      await api.raw(`/api/media/${id}`, undefined, { method: 'DELETE' });
      setNotice('Asset deleted.');
      await load();
    } catch (e) { setError(e.message); }
  };

  const filtered = useMemo(() => {
    if (!assets) return null;
    const q = query.trim().toLowerCase();
    return q ? assets.filter(a => a.originalName?.toLowerCase().includes(q)) : assets;
  }, [assets, query]);

  const stats = useMemo(() => {
    if (!assets) return null;
    return {
      total: assets.length,
      images: assets.filter(a => a.mediaType === 'image').length,
      videos: assets.filter(a => a.mediaType === 'video').length,
      bytes: assets.reduce((s, a) => s + (a.size || 0), 0),
      temporary: assets.filter(a => a.storageIntent === 'temporary' || a.cleanupAt).length
    };
  }, [assets]);

  const columns = [
    {
      key: 'originalName',
      header: 'File',
      render: a =>
        renaming === (a._id || a.id) ? (
          <div className="flex items-center gap-1.5">
            <Input
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              className="py-1 text-xs"
              aria-label="New file name"
            />
            <Button size="sm" variant="primary" onClick={() => rename(a._id || a.id)}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setRenaming(null)}>Cancel</Button>
          </div>
        ) : (
          <span className="flex items-center gap-2">
            {a.mediaType === 'video'
              ? <Film className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
              : <ImageIcon className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />}
            <span className="truncate font-medium text-[var(--text)]">{a.originalName || 'Untitled'}</span>
          </span>
        )
    },
    { key: 'mimeType', header: 'Type', render: a => <span className="font-mono text-[11px]">{a.mimeType || '—'}</span> },
    {
      key: 'dims',
      header: 'Dimensions',
      render: a => (a.width && a.height ? `${a.width}×${a.height}` : a.durationSeconds ? `${Math.round(a.durationSeconds)}s` : '—')
    },
    { key: 'size', header: 'Size', align: 'right', render: a => <span className="tabular-nums">{fmtBytes(a.size)}</span> },
    {
      key: 'status',
      header: 'Status',
      render: a => <Badge tone={STATUS_TONE[a.status] || 'neutral'}>{a.status || 'unknown'}</Badge>
    },
    { key: 'createdAt', header: 'Added', align: 'right', render: a => <span className="tabular-nums">{fmtDate(a.createdAt)}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: a => (
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            aria-label="Rename"
            onClick={() => { setRenaming(a._id || a.id); setRenameValue(a.originalName || ''); }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" aria-label="Delete" onClick={() => remove(a._id || a.id)}>
            <Trash2 className="h-3.5 w-3.5 text-danger" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <AppShell>
      <Page>
        <PageHeader
          eyebrow="Create"
          title="Media Library"
          description="Everything stored against this workspace. Rename or delete assets directly — the server's cleanup worker hard-deletes anything still marked temporary."
        />

        {error ? <Notice tone="danger">{error}</Notice> : null}
        {notice ? <Notice tone="success">{notice}</Notice> : null}

        {stats ? (
          <StatGrid>
            <StatTile label="Assets" value={stats.total} icon={Images} tone="accent" />
            <StatTile label="Images" value={stats.images} icon={ImageIcon} />
            <StatTile label="Videos" value={stats.videos} icon={Film} />
            <StatTile label="Stored" value={fmtBytes(stats.bytes)} icon={HardDrive} />
            <StatTile label="Temporary" value={stats.temporary} icon={Clock} tone="warning" hint="Pending cleanup" />
          </StatGrid>
        ) : null}

        <Section
          title="Assets"
          description={filtered ? `${filtered.length} shown` : undefined}
          actions={
            <Field className="w-44 sm:w-60">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
                <Input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Filter by name…"
                  aria-label="Filter media"
                  className="pl-8"
                />
              </div>
            </Field>
          }
        >
          {!filtered ? (
            <Skeleton className="h-48" />
          ) : (
            <DataList
              columns={columns}
              rows={filtered}
              rowKey={a => a._id || a.id}
              empty={
                <EmptyState
                  icon={Images}
                  title="No media yet"
                  description="Assets appear here once you upload them from Compose. Resumable uploads survive a refresh, so large videos can be paused and resumed."
                />
              }
            />
          )}
        </Section>
      </Page>
    </AppShell>
  );
}
