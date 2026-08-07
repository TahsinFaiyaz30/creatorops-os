'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Media Library — GET /api/media, PATCH /api/media/:id, DELETE /api/media/:id
 *
 * A library is a visual surface, so the default view is a thumbnail grid rather
 * than a table. Hover lifts the card under the pointer and leaves its neighbours
 * alone.
 *
 * The list view is kept behind a toggle: filenames, sizes and statuses are
 * genuinely easier to scan in a table once a workspace has hundreds of assets.
 *
 * Also surfaces the storage-intent lifecycle the server runs — temporary assets
 * carry a cleanup deadline, and nothing in the client showed that before.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Images, Trash2, Pencil, HardDrive, Film, Image as ImageIcon, Clock,
  Search, LayoutGrid, List as ListIcon, ExternalLink, Check, X, Upload, FolderLock
} from 'lucide-react';

import AppShell from '../../components/layout/AppShell';
import ProjectPinControl from '../../components/media/ProjectPinControl';
import { TextGenerateEffect } from '../../components/ui/text-generate-effect';
import { BackgroundBeams } from '../../components/ui/background-beams';
import {
  Page, Section, Surface, Badge, Button, Input, Select,
  EmptyState, Skeleton, DataList,
  GlareStat, GlareStatGrid, GLARE_TINTS
} from '../../components/ds';
import { api } from '../../lib/api';
import { getActiveWorkspaceId } from '../../lib/teams';
import { formatPlatform } from '../../lib/platforms';
import { useToastState } from '../../components/ui/toast';

const EASE = [0.16, 1, 0.3, 1];

const fmtBytes = n => {
  if (!n) return '—';
  const u = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), u.length - 1);
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
};

const fmtDate = d =>
  d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';

const fmtDuration = s => {
  if (!s) return null;
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
};

const STATUS_TONE = { ready: 'success', uploading: 'warning', failed: 'danger', temporary: 'warning' };

const FILTERS = [
  { key: 'all', label: 'All', icon: Images },
  { key: 'image', label: 'Images', icon: ImageIcon },
  { key: 'video', label: 'Videos', icon: Film }
];

/* ── Grid tile ────────────────────────────────────────────────────────────── */

function MediaTile({ asset, index, hovered, setHovered, onRename, onDelete, renaming, renameValue, setRenameValue, commitRename, cancelRename, projects, inTeam, onPinned, onPinError }) {
  const id = asset._id || asset.id;
  const isVideo = asset.mediaType === 'video';
  const dims = asset.width && asset.height ? `${asset.width}×${asset.height}` : null;
  const dur = fmtDuration(asset.durationSeconds);
  const isTemp = asset.storageIntent === 'temporary_publish' || asset.cleanupAt;

  /*
   * The hovered card lifts; its siblings are left alone.
   *
   * This grid used to blur and shrink every other card whenever the pointer
   * touched one, so scrolling past dragged a wave of defocus across the page and
   * anything you were reading nearby went soft. Hover should answer "this one",
   * not repaint the rest of the screen.
   */
  return (
    <motion.div
      layout
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] transition-[border-color,box-shadow] duration-200 hover:border-[var(--accent-line)] hover:shadow-[0_12px_40px_-16px_var(--glow)]"
    >
      {/* Preview */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--surface2)]">
        {asset.publicUrl && !isVideo ? (
          <img
            src={asset.publicUrl}
            alt={asset.originalName || 'media'}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_50%_40%,var(--accent-soft),transparent_70%)]">
            {isVideo ? (
              <Film className="h-7 w-7 text-[var(--muted)]" />
            ) : (
              <ImageIcon className="h-7 w-7 text-[var(--muted)]" />
            )}
          </div>
        )}

        {/* Corner meta */}
        <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap gap-1">
          <Badge tone={STATUS_TONE[asset.status] || 'neutral'}>{asset.status || 'unknown'}</Badge>
          {isTemp ? <Badge tone="warning"><Clock className="h-2.5 w-2.5" />temp</Badge> : null}
        </div>

        {/*
         * Who can see this file. Always visible rather than hover-only: a pinned
         * asset is hidden from most of the team, and that is not something to
         * discover by accident.
         */}
        {inTeam ? (
          <div className="absolute right-2 top-2 z-10">
            <ProjectPinControl
              asset={asset}
              projects={projects}
              onChanged={onPinned}
              onError={onPinError}
            />
          </div>
        ) : null}
        {dur ? (
          <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">
            {dur}
          </span>
        ) : null}

        {/* Hover actions */}
        <div className="absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-end gap-1 bg-gradient-to-t from-black/80 to-transparent p-2 transition-transform duration-300 group-hover:translate-y-0">
          {asset.publicUrl ? (
            <Button
              as="a"
              href={asset.publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              size="sm"
              variant="secondary"
              aria-label="Open original"
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          ) : null}
          <Button size="sm" variant="secondary" aria-label="Rename" onClick={() => onRename(asset)}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="danger" aria-label="Delete" onClick={() => onDelete(id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className="p-2.5">
        {renaming === id ? (
          <div className="flex items-center gap-1">
            <Input
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename(id);
                if (e.key === 'Escape') cancelRename();
              }}
              autoFocus
              aria-label="New file name"
              className="py-1 text-[11px]"
            />
            <Button size="sm" variant="primary" onClick={() => commitRename(id)} aria-label="Save">
              <Check className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelRename} aria-label="Cancel">
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <>
            <p className="truncate text-[11px] font-semibold text-[var(--text)]">
              {asset.originalName || 'Untitled'}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[10px] tabular-nums text-[var(--muted)]">
              <span>{fmtBytes(asset.size)}</span>
              {dims ? <><span className="opacity-40">·</span><span>{dims}</span></> : null}
              <span className="opacity-40">·</span>
              <span>{fmtDate(asset.createdAt)}</span>
            </p>
          </>
        )}
      </div>
    </motion.div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function MediaPage() {
  const [assets, setAssets] = useState(null);
  const [error, setError] = useToastState('danger');
  const [notice, setNotice] = useToastState('success');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('grid');
  const [hovered, setHovered] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [projects, setProjects] = useState([]);
  const [scope, setScope] = useState('all');
  const [inTeam, setInTeam] = useState(false);
  /* Platforms this creator has actually published to, ever. */
  const [platforms, setPlatforms] = useState([]);
  const [platform, setPlatform] = useState('all');

  const load = () =>
    api
      .get('/api/media')
      .then(p => setAssets(p?.data?.mediaAssets || []))
      .catch(e => setError(e.message));

  useEffect(() => {
    /*
     * The platform list is derived from real published posts rather than from
     * the eleven platforms the app supports: filtering by a network you have
     * never posted to is a control that can only ever return nothing.
     */
    api
      .get('/api/social/posts')
      .then(p => {
        const posts = p?.data?.posts || [];
        const used = new Map();
        posts.forEach(post => {
          if (post.status !== 'published' || !post.platform) return;
          const assetIds = (post.mediaAssetIds || []).map(a => String(a?._id || a));
          const entry = used.get(post.platform) || new Set();
          assetIds.forEach(id => entry.add(id));
          used.set(post.platform, entry);
        });
        setPlatforms([...used.entries()].map(([key, ids]) => ({ key, assetIds: ids })));
      })
      .catch(() => setPlatforms([]));
  }, []);

  useEffect(() => {
    load();
    /*
     * Projects only mean something in a team — a solo creator sees everything
     * they own regardless, so pinning would be a choice with no consequence.
     */
    if (!getActiveWorkspaceId()) return;
    setInTeam(true);
    api
      .get('/api/campaigns')
      .then(p => setProjects(p?.data?.campaigns || []))
      .catch(() => setProjects([]));
  }, []);

  const onPinned = async message => {
    setError('');
    setNotice(message);
    await load();
  };

  const startRename = asset => {
    setRenaming(asset._id || asset.id);
    setRenameValue(asset.originalName || '');
  };
  const cancelRename = () => setRenaming(null);

  const commitRename = async id => {
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
    return assets.filter(a => {
      const matchesType = filter === 'all' || a.mediaType === filter;
      const matchesQuery = !q || a.originalName?.toLowerCase().includes(q);
      const assetProjectId = String(a.projectId?._id || a.projectId || '');
      const matchesScope =
        scope === 'all' || (scope === 'shared' ? !assetProjectId : assetProjectId === scope);
      const matchesPlatform =
        platform === 'all' ||
        (platforms.find(p => p.key === platform)?.assetIds?.has(String(a._id || a.id)) ?? false);
      return matchesType && matchesQuery && matchesScope && matchesPlatform;
    });
  }, [assets, query, filter, scope, platform, platforms]);

  const stats = useMemo(() => {
    if (!assets) return null;
    return {
      total: assets.length,
      images: assets.filter(a => a.mediaType === 'image').length,
      videos: assets.filter(a => a.mediaType === 'video').length,
      bytes: assets.reduce((s, a) => s + (a.size || 0), 0),
      temporary: assets.filter(a => a.storageIntent === 'temporary_publish' || a.cleanupAt).length,
      pinned: assets.filter(a => a.projectId).length
    };
  }, [assets]);

  const columns = [
    {
      key: 'originalName',
      header: 'File',
      render: a => (
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
      render: a => (a.width && a.height ? `${a.width}×${a.height}` : fmtDuration(a.durationSeconds) || '—')
    },
    { key: 'size', header: 'Size', align: 'right', render: a => <span className="tabular-nums">{fmtBytes(a.size)}</span> },
    { key: 'status', header: 'Status', render: a => <Badge tone={STATUS_TONE[a.status] || 'neutral'}>{a.status || 'unknown'}</Badge> },
    ...(inTeam
      ? [
          {
            key: 'visibility',
            header: 'Visible to',
            render: a => (
              <ProjectPinControl
                asset={a}
                projects={projects}
                onChanged={onPinned}
                onError={setError}
                compact
              />
            )
          }
        ]
      : []),
    { key: 'createdAt', header: 'Added', align: 'right', render: a => <span className="tabular-nums">{fmtDate(a.createdAt)}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: a => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" aria-label="Rename" onClick={() => startRename(a)}>
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
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <BackgroundBeams className="opacity-25 dark:opacity-50" />
        <div className="absolute inset-0 bg-blueprint [mask-image:radial-gradient(ellipse_at_top,black_10%,transparent_70%)]" />
      </div>

      <Page>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Create</p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
            Media Library
          </h1>
          <div className="max-w-3xl">
            <TextGenerateEffect
              words="Every asset stored against this workspace. Rename, open or delete — and watch what the cleanup worker is about to reclaim."
              className="font-normal"
              duration={0.5}
            />
          </div>
        </div>


        {stats ? (
          <GlareStatGrid>
            <GlareStat label="Assets"    value={stats.total}          icon={Images}     tint={GLARE_TINTS[0]} />
            <GlareStat label="Images"    value={stats.images}         icon={ImageIcon}  tint={GLARE_TINTS[1]} />
            <GlareStat label="Videos"    value={stats.videos}         icon={Film}       tint={GLARE_TINTS[2]} />
            <GlareStat label="Stored"    value={fmtBytes(stats.bytes)} icon={HardDrive} tint={GLARE_TINTS[3]} />
            {inTeam ? (
              <GlareStat label="Pinned" value={stats.pinned} icon={FolderLock} tint={GLARE_TINTS[4]} hint="Limited to one project's crew" />
            ) : (
              <GlareStat label="Temporary" value={stats.temporary} icon={Clock} tint={GLARE_TINTS[4]} hint="Pending cleanup" />
            )}
          </GlareStatGrid>
        ) : null}

        <Section
          title="Assets"
          description={filtered ? `${filtered.length} shown` : undefined}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {/* Who a file is visible to — only meaningful inside a team. */}
              {inTeam ? (
                <Select
                  value={scope}
                  onChange={e => setScope(e.target.value)}
                  aria-label="Filter by who can see the file"
                  className="h-8 w-auto py-1 text-[11px]"
                >
                  <option value="all">All files</option>
                  <option value="shared">Shared with the team</option>
                  {projects.map(project => (
                    <option key={project._id} value={String(project._id)}>
                      Pinned to {project.name}
                    </option>
                  ))}
                </Select>
              ) : null}

              {/* Published-to filter — only the networks this creator has used. */}
              {platforms.length > 0 ? (
                <Select
                  value={platform}
                  onChange={e => setPlatform(e.target.value)}
                  aria-label="Filter by the platform the media was published to"
                  className="h-8 w-auto py-1 text-[11px]"
                >
                  <option value="all">Any platform</option>
                  {platforms.map(p => (
                    <option key={p.key} value={p.key}>
                      Published to {formatPlatform(p.key)}
                    </option>
                  ))}
                </Select>
              ) : null}

              {/* Type filter */}
              <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface2)] p-0.5">
                {FILTERS.map(f => {
                  const on = filter === f.key;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setFilter(f.key)}
                      aria-pressed={on}
                      className={`focus-ring relative flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                        on ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
                      }`}
                    >
                      {on && (
                        <motion.span
                          layoutId="media-filter-pill"
                          className="absolute inset-0 rounded-md bg-[var(--accent-soft)]"
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                      )}
                      <f.icon className="relative h-3 w-3" />
                      <span className="relative">{f.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* View toggle */}
              <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface2)] p-0.5">
                {[
                  { key: 'grid', icon: LayoutGrid, label: 'Grid view' },
                  { key: 'list', icon: ListIcon, label: 'List view' }
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
                  placeholder="Filter by name…"
                  aria-label="Filter media"
                  className="pl-8"
                />
              </div>
            </div>
          }
        >
          {!filtered ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={assets?.length ? Search : Images}
              title={assets?.length ? 'Nothing matches those filters' : 'No media yet'}
              description={
                assets?.length
                  ? 'Try a different name, or switch the type filter back to All.'
                  : 'Assets appear here once you upload them from Compose. Resumable uploads survive a refresh, so large videos can be paused and resumed mid-flight.'
              }
              action={
                !assets?.length ? (
                  <Button as="a" href="/compose" variant="primary" size="sm">
                    <Upload className="h-3.5 w-3.5" /> Go to Compose
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => { setQuery(''); setFilter('all'); }}>
                    Clear filters
                  </Button>
                )
              }
            />
          ) : view === 'grid' ? (
            <motion.div
              layout
              onMouseLeave={() => setHovered(null)}
              className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"
            >
              <AnimatePresence mode="popLayout">
                {filtered.map((asset, i) => (
                  <MediaTile
                    key={asset._id || asset.id}
                    asset={asset}
                    index={i}
                    hovered={hovered}
                    setHovered={setHovered}
                    onRename={startRename}
                    onDelete={remove}
                    renaming={renaming}
                    renameValue={renameValue}
                    setRenameValue={setRenameValue}
                    commitRename={commitRename}
                    cancelRename={cancelRename}
                    projects={projects}
                    inTeam={inTeam}
                    onPinned={onPinned}
                    onPinError={setError}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            <DataList columns={columns} rows={filtered} rowKey={a => a._id || a.id} />
          )}
        </Section>
      </Page>
    </AppShell>
  );
}
