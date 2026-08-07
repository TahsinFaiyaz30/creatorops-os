'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Post Details & Analytics
 *
 * GET  /api/social/analytics/summary
 * GET  /api/social/post-groups            GET /api/social/post-groups/:id
 * POST /api/social/post-groups/:id/sync
 * GET  /api/social/posts/:id/metrics      ← was never called by any client code
 * POST /api/social/comments/:id/reply     POST /api/social/replies/:id/reply
 *
 * Four things the API already returned and this page threw away: the metric
 * snapshot history (a real time series, so an analytics page could finally have
 * a chart), summary.recentComments, the published-post and snapshot counts, and
 * the group's media assets. All four are rendered now. No metric is synthesised
 * anywhere — an empty chart means the platform returned nothing.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  MessageSquare, RefreshCw, TrendingUp, Heart, Eye, Share2, Bookmark,
  ThumbsUp, BarChart3, Rss, Camera, Loader2, ExternalLink, ChevronDown,
  AlertTriangle, CircleCheck, CircleSlash, Send, ImageOff, Layers, Clock3
} from 'lucide-react';

import AppShell from '../../components/layout/AppShell';
import { TextGenerateEffect } from '../../components/ui/text-generate-effect';
import { BackgroundBeams } from '../../components/ui/background-beams';
import {
  Page, Section, Badge, Button, Input, EmptyState, Skeleton,
  Notice, GlareStat, GlareStatGrid, GLARE_TINTS
} from '../../components/ds';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { getUser } from '../../lib/auth';
import { formatPlatform } from '../../lib/platforms';
import { canEngageWithSocial } from '../../lib/roles';
import { useToastState } from '../../components/ui/toast';

const EASE = [0.16, 1, 0.3, 1];

const metricKeys = ['likes', 'reactions', 'comments', 'shares', 'views', 'saves'];

const METRIC_META = {
  likes: { icon: Heart, label: 'Likes' },
  reactions: { icon: ThumbsUp, label: 'Reactions' },
  comments: { icon: MessageSquare, label: 'Comments' },
  shares: { icon: Share2, label: 'Shares' },
  views: { icon: Eye, label: 'Views' },
  saves: { icon: Bookmark, label: 'Saves' }
};

const SYNC_TONE = { synced: 'success', error: 'danger', not_synced: 'warning', unavailable: 'neutral' };
const SYNC_ICON = { synced: CircleCheck, error: AlertTriangle, not_synced: Clock3, unavailable: CircleSlash };

const emptyMetrics = { likes: 0, reactions: 0, comments: 0, shares: 0, views: 0, saves: 0 };

const compact = value => {
  const n = Number(value) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
};

const getCommentDate = comment => new Date(comment.providerCreatedAt || comment.createdAt || 0).getTime();

const sortComments = comments =>
  [...comments].sort((a, b) => getCommentDate(a) - getCommentDate(b));

const getReplyCount = comment =>
  (comment.providerReplies || []).length + (comment.accountReplies || []).length;

const getId = item => String(item?._id || item?.id || '');

const isYouTubePlatform = platform => ['youtube', 'youtube_shorts'].includes(platform);

const collectAccountReplyProviderIds = (replies = [], ids = new Set()) => {
  replies.forEach(reply => {
    if (reply.providerReplyId) ids.add(String(reply.providerReplyId));
    collectAccountReplyProviderIds(reply.accountReplies || [], ids);
  });
  return ids;
};

const buildAccountReplyTree = replies => {
  const nodes = new Map();
  replies.forEach(reply => {
    nodes.set(getId(reply), { ...reply, accountReplies: [] });
  });

  const roots = [];
  nodes.forEach(reply => {
    const parentId = String(reply.parentSocialReplyId || '');
    const parent = parentId ? nodes.get(parentId) : null;
    if (parent) {
      parent.accountReplies.push(reply);
    } else {
      roots.push(reply);
    }
  });

  const sortTree = reply => {
    reply.accountReplies = [...(reply.accountReplies || [])]
      .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
      .map(sortTree);
    return reply;
  };

  return roots
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
    .map(sortTree);
};

const buildCommentTree = comments => {
  const creatorOpsProviderReplyIds = comments.reduce(
    (ids, comment) => collectAccountReplyProviderIds(comment.accountReplies || [], ids),
    new Set()
  );
  const nodesByProviderId = new Map();

  comments.forEach(comment => {
    if (comment.isProviderReply && creatorOpsProviderReplyIds.has(String(comment.providerCommentId))) {
      return;
    }

    nodesByProviderId.set(comment.providerCommentId, {
      ...comment,
      providerReplies: [],
      accountReplies: buildAccountReplyTree(comment.accountReplies || [])
    });
  });

  const roots = [];

  nodesByProviderId.forEach(comment => {
    const parent = comment.parentProviderCommentId
      ? nodesByProviderId.get(comment.parentProviderCommentId)
      : null;

    if (comment.isProviderReply && parent) {
      parent.providerReplies.push(comment);
    } else {
      roots.push(comment);
    }
  });

  const sortTree = node => {
    node.providerReplies = sortComments(node.providerReplies).map(sortTree);
    node.accountReplies = [...(node.accountReplies || [])].sort(
      (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
    );
    return node;
  };

  return sortComments(roots).map(sortTree);
};

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function AnalyticsPage() {
  const [user, setUser] = useState(null);
  const [summary, setSummary] = useState(null);
  const [groups, setGroups] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [message, setMessage] = useToastState('info');
  const [syncResults, setSyncResults] = useState([]);
  const [replyText, setReplyText] = useState({});
  const [busy, setBusy] = useState('');
  const [trend, setTrend] = useState({});
  const [openTrend, setOpenTrend] = useState({});
  const [trendMetric, setTrendMetric] = useState('views');

  const load = async () => {
    const [summaryPayload, groupsPayload] = await Promise.all([
      api.get('/api/social/analytics/summary'),
      api.get('/api/social/post-groups')
    ]);
    setSummary(summaryPayload.data.summary);
    setGroups(groupsPayload.data.groups || []);
  };

  useEffect(() => {
    setUser(getUser());
    load().catch(err => setMessage(err.message));
    const socket = getSocket();
    const handler = () => {
      load().catch(() => {});
      if (selectedGroup?.id) {
        openGroup(selectedGroup.id, selectedPlatform).catch(() => {});
      }
    };
    socket.on('social:metrics_updated', handler);
    socket.on('social:comments_synced', handler);
    socket.on('social:reply_created', handler);
    socket.on('publishing:job_updated', handler);
    return () => {
      socket.off('social:metrics_updated', handler);
      socket.off('social:comments_synced', handler);
      socket.off('social:reply_created', handler);
      socket.off('publishing:job_updated', handler);
    };
  }, [selectedGroup?.id, selectedPlatform]);

  const openGroup = async (groupId, platform = '') => {
    setBusy(groupId);
    setMessage('');
    try {
      const suffix = platform ? `?platform=${encodeURIComponent(platform)}` : '';
      const payload = await api.get(`/api/social/post-groups/${groupId}${suffix}`);
      setSelectedGroup(payload.data.group);
      setSelectedPlatform(platform);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
    }
  };

  const syncGroup = async group => {
    setBusy(`sync-${group.id}`);
    setMessage('');
    setSyncResults([]);
    try {
      const payload = await api.post(`/api/social/post-groups/${group.id}/sync`, {});
      const results = payload.data.results || [];
      const okCount = results.filter(result => result.ok).length;
      setSyncResults(results);
      setMessage(payload.data.message || `Sync attempted for ${results.length} platform post${results.length === 1 ? '' : 's'}; ${okCount} returned real data.`);
      setTrend({});
      await load();
      await openGroup(group.id, selectedPlatform);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
    }
  };

  const reply = async comment => {
    const key = getId(comment);
    setBusy(key);
    setMessage('');
    const text = String(replyText[key] || '').trim();
    if (!text) {
      setMessage('Write a reply first.');
      setBusy('');
      return;
    }
    try {
      await api.post(`/api/social/comments/${key}/reply`, { replyText: text });
      setMessage(`Reply created through the connected ${formatPlatform(comment.platform)} account.`);
      setReplyText(current => ({ ...current, [key]: '' }));
      if (selectedGroup?.id) await openGroup(selectedGroup.id, selectedPlatform);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
    }
  };

  const replyToAccountReply = async accountReply => {
    const key = `reply:${getId(accountReply)}`;
    setBusy(key);
    setMessage('');
    const text = String(replyText[key] || '').trim();
    if (!text) {
      setMessage('Write a reply first.');
      setBusy('');
      return;
    }
    try {
      await api.post(`/api/social/replies/${getId(accountReply)}/reply`, { replyText: text });
      setMessage(`Nested reply created through the connected ${formatPlatform(accountReply.platform)} account.`);
      setReplyText(current => ({ ...current, [key]: '' }));
      if (selectedGroup?.id) await openGroup(selectedGroup.id, selectedPlatform);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
    }
  };

  /* GET /api/social/posts/:id/metrics — the snapshot history, previously unwired. */
  const toggleTrend = async postId => {
    if (!postId) return;
    const id = String(postId);
    const nextOpen = !openTrend[id];
    setOpenTrend(current => ({ ...current, [id]: nextOpen }));
    if (!nextOpen || trend[id]?.snapshots) return;

    setTrend(current => ({ ...current, [id]: { loading: true } }));
    try {
      const payload = await api.get(`/api/social/posts/${id}/metrics`);
      /* Server sorts collectedAt desc; a chart reads left-to-right in time. */
      const snapshots = [...(payload.data.metrics || [])].reverse();
      setTrend(current => ({ ...current, [id]: { snapshots } }));
    } catch (err) {
      setTrend(current => ({ ...current, [id]: { error: err.message } }));
    }
  };

  const selectedTotals = useMemo(() => selectedGroup?.totals || emptyMetrics, [selectedGroup]);
  const commentTree = useMemo(() => buildCommentTree(selectedGroup?.comments || []), [selectedGroup]);

  const engagement = useMemo(() => {
    const t = summary?.totals || emptyMetrics;
    return (t.likes || 0) + (t.reactions || 0) + (t.comments || 0) + (t.shares || 0) + (t.saves || 0);
  }, [summary]);

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
            Post Details &amp; Analytics
          </h1>
          <div className="max-w-3xl">
            <TextGenerateEffect
              words="One post, every platform it landed on, side by side. Numbers come from official platform APIs on sync — nothing here is estimated, modelled or filled in."
              className="font-normal"
              duration={0.5}
            />
          </div>
        </div>

        {summary?.unavailableMessage ? <Notice tone="warning">{summary.unavailableMessage}</Notice> : null}

        {/* Workspace roll-up — totalPublishedPosts / totalMetricSnapshots were unused */}
        <GlareStatGrid>
          <GlareStat label="Published posts"  value={summary?.totalPublishedPosts ?? 0}  icon={Rss}        tint={GLARE_TINTS[0]} />
          <GlareStat label="Total views"      value={compact(summary?.totals?.views)}    icon={Eye}        tint={GLARE_TINTS[1]} />
          <GlareStat label="Engagements"      value={compact(engagement)}                icon={TrendingUp} tint={GLARE_TINTS[2]} hint="Likes, reactions, comments, shares, saves" />
          <GlareStat label="Metric snapshots" value={summary?.totalMetricSnapshots ?? 0} icon={BarChart3}  tint={GLARE_TINTS[3]} hint="Real API reads" />
          <GlareStat label="Post groups"      value={groups?.length ?? 0}                icon={Layers}     tint={GLARE_TINTS[4]} />
        </GlareStatGrid>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {metricKeys.map((metric, index) => (
            <MetricTile
              key={metric}
              metric={metric}
              value={summary?.totals?.[metric] || 0}
              index={index}
            />
          ))}
        </div>

        {syncResults.length > 0 ? (
          <Section title="Last sync result" description="Exactly what each platform API returned.">
            <div className="grid gap-2 md:grid-cols-2">
              {syncResults.map(result => (
                <motion.div
                  key={`${result.platform}-${result.postId}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  className={`rounded-xl border p-3 ${
                    result.ok ? 'border-success/30 bg-success/10' : 'border-warning/30 bg-warning/10'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {result.ok ? (
                      <CircleCheck className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                    )}
                    <span className="text-xs font-bold text-[var(--text)]">{formatPlatform(result.platform)}</span>
                  </div>
                  <div className="mt-1.5 grid gap-0.5 text-[11px] leading-relaxed text-[var(--text-2)]">
                    <span>
                      <span className="text-[var(--muted)]">Metrics:</span>{' '}
                      {result.analytics?.ok ? result.analytics.message || 'synced' : result.analytics?.message || result.message || 'not synced'}
                    </span>
                    <span>
                      <span className="text-[var(--muted)]">Comments:</span>{' '}
                      {result.comments?.ok
                        ? `${result.comments.data?.length || 0} real comment${(result.comments.data?.length || 0) === 1 ? '' : 's'} returned`
                        : result.comments?.message || result.message || 'not synced'}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </Section>
        ) : null}

        <div className="grid items-start gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
          {/* Post group rail */}
          <div className="space-y-3 xl:sticky xl:top-20">
            <h2 className="text-base font-semibold tracking-tight text-[var(--text)]">Published posts</h2>
            {!groups ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
              </div>
            ) : groups.length === 0 ? (
              <EmptyState
                icon={Rss}
                title="Nothing published yet"
                description="Post groups appear here once a dispatch reaches a platform and returns a post id."
                action={
                  <Button as="a" href="/publishing" variant="secondary" size="sm">
                    <Send className="h-3.5 w-3.5" />
                    Open Dispatch
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3 xl:max-h-[70vh] xl:overflow-y-auto xl:pr-1">
                {groups.map((group, index) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    index={index}
                    active={selectedGroup?.id === group.id}
                    busy={busy === group.id}
                    onOpen={() => openGroup(group.id)}
                  />
                ))}
              </div>
            )}

            {/* summary.recentComments was returned by the API and never rendered */}
            {summary?.recentComments?.length ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-3 backdrop-blur-xl">
                <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                  <MessageSquare className="h-3 w-3" />
                  Latest across workspace
                </h3>
                <div className="mt-2 space-y-1.5">
                  {summary.recentComments.slice(0, 6).map(comment => (
                    <div
                      key={getId(comment)}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-2.5 py-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[10px] font-semibold text-[var(--accent)]">
                          {formatPlatform(comment.platform)}
                        </span>
                        <span className="shrink-0 text-[9px] text-[var(--muted)]">
                          {comment.authorName || comment.authorHandle || 'Platform user'}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-[var(--text-2)]">
                        {comment.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Detail */}
          <div className="space-y-4">
            {!selectedGroup ? (
              <EmptyState
                icon={BarChart3}
                title="Pick a post"
                description="Select a post group to compare it across every platform it shipped to — combined totals, per-platform numbers, the synced metric history, and the real comment thread."
              />
            ) : (
              <>
                <GroupHero
                  group={selectedGroup}
                  selectedPlatform={selectedPlatform}
                  busy={busy === `sync-${selectedGroup.id}`}
                  onSync={() => syncGroup(selectedGroup)}
                  onFilter={platform => openGroup(selectedGroup.id, platform)}
                />

                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {metricKeys.map((metric, index) => (
                    <MetricTile key={metric} metric={metric} value={selectedTotals[metric] || 0} index={index} accent />
                  ))}
                </div>

                <PlatformCompare
                  breakdown={selectedGroup.platformBreakdown}
                  metric={trendMetric}
                  onMetric={setTrendMetric}
                />

                <Section title="Per-platform detail" description={`${selectedGroup.platformBreakdown.length} platform ${selectedGroup.platformBreakdown.length === 1 ? 'target' : 'targets'}`}>
                  <div className="space-y-3">
                    {selectedGroup.platformBreakdown.map(item => (
                      <PlatformDetailCard
                        key={item.platform}
                        item={item}
                        metric={trendMetric}
                        trend={trend[String(item.postId || '')]}
                        open={Boolean(openTrend[String(item.postId || '')])}
                        onToggleTrend={() => toggleTrend(item.postId)}
                      />
                    ))}
                  </div>
                </Section>

                <Section
                  title="Comments"
                  description={commentTree.length ? `${commentTree.length} real ${commentTree.length === 1 ? 'thread' : 'threads'} synced` : undefined}
                >
                  <div className="space-y-3">
                    {commentTree.map(comment => (
                      <CommentThreadNode
                        key={comment._id}
                        comment={comment}
                        user={user}
                        busy={busy}
                        replyText={replyText}
                        setReplyText={setReplyText}
                        onReply={reply}
                        onReplyToAccountReply={replyToAccountReply}
                      />
                    ))}
                    {commentTree.length === 0 ? (
                      <div className="space-y-2">
                        {selectedGroup.platformBreakdown.map(item => (
                          <div
                            key={item.platform}
                            className="flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface2)]/60 px-3 py-2"
                          >
                            <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                            <p className="text-[11px] leading-relaxed text-[var(--muted)]">
                              <span className="font-semibold text-[var(--text)]">{formatPlatform(item.platform)}:</span>{' '}
                              {item.commentsUnavailableMessage || 'No real comments synced for this platform yet.'}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </Section>
              </>
            )}
          </div>
        </div>
      </Page>
    </AppShell>
  );
}

/* ── Metric tile ──────────────────────────────────────────────────────────── */

function MetricTile({ metric, value, index, accent = false }) {
  const meta = METRIC_META[metric];
  const Icon = meta.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE, delay: index * 0.04 }}
      className={`rounded-xl border px-3 py-2.5 backdrop-blur-xl ${
        accent
          ? 'border-[var(--accent-line)] bg-[var(--accent-soft)]'
          : 'border-[var(--border)] bg-[var(--surface)]/70'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3 w-3 ${accent ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`} />
        <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--muted)]">{meta.label}</span>
      </div>
      <p className="mt-1 text-xl font-bold tabular-nums tracking-tight text-[var(--text)]">{compact(value)}</p>
    </motion.div>
  );
}

/* ── Post group card ──────────────────────────────────────────────────────── */

function GroupCard({ group, index, active, busy, onOpen }) {
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE, delay: Math.min(index, 6) * 0.04 }}
      whileHover={{ y: -2 }}
      aria-pressed={active}
      className={`focus-ring relative w-full overflow-hidden rounded-2xl border p-3 text-left backdrop-blur-xl transition-colors ${
        active
          ? 'border-[var(--accent-line)] bg-[var(--accent-soft)]'
          : 'border-[var(--border)] bg-[var(--surface)]/70 hover:border-[var(--border-strong)]'
      }`}
    >
      {active ? (
        <motion.span
          layoutId="analytics-active-group"
          className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-[var(--accent)]"
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        />
      ) : null}

      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 truncate text-xs font-bold tracking-tight text-[var(--text)]">
          {group.title}
        </h3>
        {busy ? <Loader2 className="h-3 w-3 shrink-0 animate-spin text-[var(--accent)]" /> : null}
      </div>

      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[var(--muted)]">
        {group.caption || 'No caption stored.'}
      </p>

      <div className="mt-2 flex flex-wrap gap-1">
        {group.platforms.map(platform => (
          <span
            key={platform}
            className="rounded-full border border-[var(--border)] bg-[var(--surface2)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--text-2)]"
          >
            {formatPlatform(platform)}
          </span>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {['likes', 'comments', 'shares'].map(key => {
          const Icon = METRIC_META[key].icon;
          return (
            <span
              key={key}
              className="flex items-center gap-1 rounded-lg bg-[var(--surface2)] px-1.5 py-1 text-[10px] text-[var(--text-2)]"
            >
              <Icon className="h-2.5 w-2.5 text-[var(--muted)]" />
              <span className="tabular-nums font-semibold">{compact(group.totals[key])}</span>
            </span>
          );
        })}
      </div>
    </motion.button>
  );
}

/* ── Group hero ───────────────────────────────────────────────────────────── */

function GroupHero({ group, selectedPlatform, busy, onSync, onFilter }) {
  const media = (group.mediaAssets || []).find(asset => asset?.publicUrl) || null;
  const [broken, setBroken] = useState(false);

  useEffect(() => { setBroken(false); }, [media?.publicUrl]);

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
      className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/75 shadow-[var(--shadow)] backdrop-blur-xl"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_100%_at_0%_0%,var(--accent-soft),transparent_58%)]"
      />

      <div className="relative flex flex-col gap-4 p-4 sm:flex-row">
        {/* group.mediaAssets was returned and never rendered */}
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface2)] sm:h-28 sm:w-28">
          {media && !broken ? (
            media.mediaType === 'video' ? (
              <video src={media.publicUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" onError={() => setBroken(true)} />
            ) : (
              <img src={media.publicUrl} alt={media.originalName || 'Post media'} className="h-full w-full object-cover" onError={() => setBroken(true)} />
            )
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1">
              {broken ? <ImageOff className="h-4 w-4 text-[var(--muted)]" /> : <Camera className="h-4 w-4 text-[var(--muted)]" />}
              <span className="px-1 text-center text-[9px] leading-tight text-[var(--muted)]">
                {broken ? 'Media unavailable' : 'No media'}
              </span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-base font-bold leading-snug tracking-tight text-[var(--text)]">{group.title}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[var(--muted)]">
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-2.5 w-2.5" />
                  {group.publishedAt ? new Date(group.publishedAt).toLocaleString() : 'Not published'}
                </span>
                <span className="font-mono">{group.id}</span>
              </div>
            </div>
            <Button variant="primary" size="sm" onClick={onSync} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Sync all platforms
            </Button>
          </div>

          {group.caption ? (
            <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[var(--text-2)]">{group.caption}</p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-1">
            <FilterPill active={!selectedPlatform} onClick={() => onFilter('')}>All platforms</FilterPill>
            {group.platforms.map(platform => (
              <FilterPill
                key={platform}
                active={selectedPlatform === platform}
                onClick={() => onFilter(platform)}
              >
                {formatPlatform(platform)}
              </FilterPill>
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function FilterPill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`focus-ring relative rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${
        active ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
      }`}
    >
      {active ? (
        <motion.span
          layoutId="analytics-platform-pill"
          className="absolute inset-0 rounded-full bg-[var(--accent-soft)] ring-1 ring-inset ring-[var(--accent-line)]"
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        />
      ) : null}
      <span className="relative">{children}</span>
    </button>
  );
}

/* ── Platform comparison bars ─────────────────────────────────────────────── */

function PlatformCompare({ breakdown, metric, onMetric }) {
  const rows = breakdown.map(item => ({
    platform: item.platform,
    value: item.metrics?.[metric] || 0,
    status: item.analyticsStatus
  }));
  const max = Math.max(...rows.map(row => row.value), 1);
  const anyData = rows.some(row => row.value > 0);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-4 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-[var(--text)]">Platform comparison</h3>
          <p className="mt-0.5 text-[10px] text-[var(--muted)]">Latest synced snapshot per platform</p>
        </div>
        <div className="flex flex-wrap gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface2)] p-0.5">
          {metricKeys.map(key => (
            <button
              key={key}
              type="button"
              onClick={() => onMetric(key)}
              aria-pressed={metric === key}
              className={`focus-ring relative rounded-md px-2 py-1 text-[10px] font-semibold capitalize transition-colors ${
                metric === key ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              {metric === key ? (
                <motion.span
                  layoutId="analytics-compare-metric"
                  className="absolute inset-0 rounded-md bg-[var(--accent-soft)]"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              ) : null}
              <span className="relative">{key}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {rows.map((row, index) => (
          <div key={row.platform} className="flex items-center gap-2">
            <span className="w-24 shrink-0 truncate text-[10px] font-semibold text-[var(--text-2)]">
              {formatPlatform(row.platform)}
            </span>
            <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--surface3)]">
              <motion.div
                className="h-full rounded-full bg-[var(--accent)]"
                initial={{ width: 0 }}
                animate={{ width: `${(row.value / max) * 100}%` }}
                transition={{ duration: 0.6, ease: EASE, delay: index * 0.05 }}
              />
            </div>
            <span className="w-12 shrink-0 text-right text-[10px] font-bold tabular-nums text-[var(--text)]">
              {compact(row.value)}
            </span>
          </div>
        ))}
      </div>

      {!anyData ? (
        <p className="mt-3 text-[10px] leading-relaxed text-[var(--muted)]">
          No {metric} returned by any platform yet. Run a sync — bars only ever reflect what the API actually sent back.
        </p>
      ) : null}
    </div>
  );
}

/* ── Metric history chart ─────────────────────────────────────────────────── */

function TrendChart({ snapshots, metric }) {
  const points = (snapshots || []).map(snapshot => ({
    t: new Date(snapshot.collectedAt || snapshot.createdAt || 0).getTime(),
    v: Number(snapshot[metric]) || 0
  }));

  if (points.length < 2) {
    return (
      <p className="rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-2.5 py-2 text-[10px] leading-relaxed text-[var(--muted)]">
        {points.length === 0
          ? 'No metric snapshots stored for this post yet.'
          : 'Only one snapshot so far — a trend needs at least two syncs.'}
      </p>
    );
  }

  const width = 560;
  const height = 120;
  const padX = 6;
  const padY = 10;
  const maxV = Math.max(...points.map(p => p.v));
  const minV = Math.min(...points.map(p => p.v));
  const span = maxV - minV || 1;

  const x = index => padX + (index / (points.length - 1)) * (width - padX * 2);
  const y = value => height - padY - ((value - minV) / span) * (height - padY * 2);

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${height} L${x(0).toFixed(1)},${height} Z`;
  const last = points[points.length - 1];
  const first = points[0];
  const delta = last.v - first.v;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface2)]/60 p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          {METRIC_META[metric].label} · {points.length} snapshots
        </span>
        <span
          className={`text-[10px] font-bold tabular-nums ${
            delta > 0 ? 'text-success' : delta < 0 ? 'text-danger' : 'text-[var(--muted)]'
          }`}
        >
          {delta > 0 ? '+' : ''}{compact(delta)} since first sync
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-24 w-full" preserveAspectRatio="none" role="img" aria-label={`${METRIC_META[metric].label} over ${points.length} snapshots`}>
        <defs>
          <linearGradient id={`trend-${metric}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path
          d={area}
          fill={`url(#trend-${metric})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: EASE }}
        />
        <motion.path
          d={line}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, ease: EASE }}
        />
        <circle cx={x(points.length - 1)} cy={y(last.v)} r="3.5" fill="var(--accent)" />
      </svg>

      <div className="flex items-center justify-between text-[9px] tabular-nums text-[var(--muted)]">
        <span>{new Date(first.t).toLocaleDateString()} · {compact(first.v)}</span>
        <span>{new Date(last.t).toLocaleDateString()} · {compact(last.v)}</span>
      </div>
    </div>
  );
}

/* ── Per-platform detail ──────────────────────────────────────────────────── */

function PlatformDetailCard({ item, metric, trend, open, onToggleTrend }) {
  const StatusIcon = SYNC_ICON[item.analyticsStatus] || CircleSlash;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
      className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 backdrop-blur-xl"
    >
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">{formatPlatform(item.platform)}</Badge>
              <Badge tone={SYNC_TONE[item.analyticsStatus] || 'neutral'}>
                <StatusIcon className="h-2.5 w-2.5" />
                {(item.analyticsStatus || 'unknown').replace(/_/g, ' ')}
              </Badge>
              <Badge tone="neutral">{item.status}</Badge>
            </div>
            <p className="mt-1 truncate text-[11px] text-[var(--muted)]">
              {item.accountSnapshot?.accountName || 'Unknown account'}
              {item.accountSnapshot?.accountHandle ? ` · @${item.accountSnapshot.accountHandle}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            {item.providerPostUrl ? (
              <Button as="a" size="sm" variant="secondary" href={item.providerPostUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                View
              </Button>
            ) : null}
            {item.postId ? (
              <Button size="sm" variant="ghost" onClick={onToggleTrend} aria-expanded={open}>
                <TrendingUp className="h-3.5 w-3.5" />
                Trend
                <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
          {metricKeys.map(key => {
            const Icon = METRIC_META[key].icon;
            const isActive = key === metric;
            return (
              <div
                key={key}
                className={`rounded-lg border px-2 py-1.5 ${
                  isActive ? 'border-[var(--accent-line)] bg-[var(--accent-soft)]' : 'border-[var(--border)] bg-[var(--surface2)]'
                }`}
              >
                <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-[var(--muted)]">
                  <Icon className="h-2.5 w-2.5" />
                  {key}
                </span>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-[var(--text)]">
                  {compact(item.metrics?.[key] || 0)}
                </p>
              </div>
            );
          })}
        </div>

        {/* GET /api/social/posts/:id/metrics */}
        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="overflow-hidden"
            >
              {trend?.loading ? (
                <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-2.5 py-2 text-[10px] text-[var(--muted)]">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Reading metric history…
                </div>
              ) : trend?.error ? (
                <p className="rounded-lg border border-danger/30 bg-danger/10 px-2.5 py-2 text-[10px] text-danger">
                  {trend.error}
                </p>
              ) : (
                <TrendChart snapshots={trend?.snapshots} metric={metric} />
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="grid gap-1 border-t border-[var(--border)] pt-2.5 text-[10px] leading-relaxed text-[var(--muted)]">
          <span>Last synced: {item.latestSyncedAt ? new Date(item.latestSyncedAt).toLocaleString() : 'never'}</span>
          <span>
            Metrics sync: {item.analyticsStatus}
            {item.lastAnalyticsErrorMessage ? ` — ${item.lastAnalyticsErrorMessage}` : ''}
          </span>
          <span>
            Comments sync: {item.commentsStatus}
            {item.lastCommentsSyncAt ? ` — ${new Date(item.lastCommentsSyncAt).toLocaleString()}` : ''}
          </span>
          <span>Synced comments: {item.commentCount || 0} top-level, {item.replyRecordCount || 0} replies</span>
          {item.commentsUnavailableMessage ? (
            <span className="text-warning">Comments: {item.commentsUnavailableMessage}</span>
          ) : null}
          {item.unavailableMessage ? <span className="text-warning">{item.unavailableMessage}</span> : null}
        </div>
      </div>
    </motion.article>
  );
}

/* ── Comment thread ───────────────────────────────────────────────────────── */

function CommentThreadNode({ comment, user, busy, replyText, setReplyText, onReply, onReplyToAccountReply, depth = 0 }) {
  const providerReplies = comment.providerReplies || [];
  const accountReplies = comment.accountReplies || [];
  const canReply = canEngageWithSocial(user) && comment.source === 'real' && Boolean(comment.providerCommentId);
  const totalReplies = getReplyCount(comment);
  const commentKey = getId(comment);
  const initial = (comment.authorName || comment.authorHandle || '?').trim().charAt(0).toUpperCase();

  return (
    <div
      className={`rounded-xl border border-[var(--border)] p-3 ${
        depth === 0 ? 'bg-[var(--surface)]/70 backdrop-blur-xl' : 'bg-[var(--surface2)]/60'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface2)] text-[10px] font-bold text-[var(--text-2)]">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-xs font-bold text-[var(--text)]">
              {comment.authorName || comment.authorHandle || 'Platform user'}
            </span>
            <Badge tone="accent">{formatPlatform(comment.platform)}</Badge>
            {depth > 0 ? <Badge tone="neutral">reply L{depth}</Badge> : null}
          </div>

          <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-2)]">{comment.text}</p>

          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-[var(--muted)]">
            <span className="inline-flex items-center gap-1">
              <Heart className="h-2.5 w-2.5" />
              {comment.likeCount || 0}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-2.5 w-2.5" />
              {comment.replyCount || totalReplies || 0}
            </span>
            <span>source: {comment.source}</span>
          </div>
        </div>
      </div>

      {accountReplies.length > 0 ? (
        <div className="mt-2.5 space-y-2 border-l-2 border-[var(--accent-line)] pl-3">
          {accountReplies.map(reply => (
            <AccountReplyCard
              key={reply._id}
              reply={reply}
              user={user}
              busy={busy}
              replyText={replyText}
              setReplyText={setReplyText}
              onReply={onReplyToAccountReply}
              platform={comment.platform}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}

      {providerReplies.length > 0 ? (
        <div className="mt-2.5 space-y-2 border-l-2 border-[var(--border)] pl-3">
          {providerReplies.map(reply => (
            <CommentThreadNode
              key={reply._id}
              comment={reply}
              user={user}
              busy={busy}
              replyText={replyText}
              setReplyText={setReplyText}
              onReply={onReply}
              onReplyToAccountReply={onReplyToAccountReply}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}

      {canReply ? (
        <div className="mt-2.5 space-y-1.5">
          {depth > 0 && isYouTubePlatform(comment.platform) ? (
            <p className="text-[10px] leading-relaxed text-[var(--muted)]">
              YouTube publishes this under the top-level thread; CreatorOps keeps it nested under the reply you selected.
            </p>
          ) : null}
          <div className="flex flex-col gap-1.5 sm:flex-row">
            <Input
              value={replyText[commentKey] || ''}
              onChange={event => setReplyText({ ...replyText, [commentKey]: event.target.value })}
              placeholder={`${depth === 0 ? 'Reply' : 'Reply to this nested reply'} on ${formatPlatform(comment.platform)}`}
              aria-label="Reply text"
              className="text-xs"
            />
            <Button
              size="sm"
              variant="primary"
              disabled={busy === commentKey || !String(replyText[commentKey] || '').trim()}
              onClick={() => onReply(comment)}
              className="shrink-0"
            >
              {busy === commentKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Reply
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AccountReplyCard({ reply, user, busy, replyText, setReplyText, onReply, platform, depth = 1 }) {
  const account = reply.accountSnapshot || {};
  const nestedReplies = reply.accountReplies || [];
  const replyKey = `reply:${getId(reply)}`;
  const canReply = canEngageWithSocial(user) && Boolean(reply.providerReplyId);

  return (
    <div className="rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)] p-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge tone="accent">CreatorOps reply</Badge>
        <Badge tone="neutral">L{depth}</Badge>
        <span className="text-[10px] font-semibold text-[var(--text)]">
          {account.accountName || account.accountHandle || formatPlatform(platform)}
        </span>
        {reply.repliedBy?.name ? (
          <span className="text-[10px] text-[var(--muted)]">by {reply.repliedBy.name}</span>
        ) : null}
      </div>

      <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-2)]">{reply.replyText}</p>

      {nestedReplies.length > 0 ? (
        <div className="mt-2 space-y-2 border-l-2 border-[var(--accent-line)] pl-3">
          {nestedReplies.map(nestedReply => (
            <AccountReplyCard
              key={nestedReply._id}
              reply={nestedReply}
              user={user}
              busy={busy}
              replyText={replyText}
              setReplyText={setReplyText}
              onReply={onReply}
              platform={platform}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}

      {canReply ? (
        <div className="mt-2 space-y-1.5">
          {isYouTubePlatform(platform) ? (
            <p className="text-[10px] leading-relaxed text-[var(--muted)]">
              YouTube publishes this under the top-level thread; CreatorOps keeps it nested under this reply.
            </p>
          ) : null}
          <div className="flex flex-col gap-1.5 sm:flex-row">
            <Input
              value={replyText[replyKey] || ''}
              onChange={event => setReplyText({ ...replyText, [replyKey]: event.target.value })}
              placeholder={`Reply to this nested reply on ${formatPlatform(platform)}`}
              aria-label="Nested reply text"
              className="text-xs"
            />
            <Button
              size="sm"
              variant="primary"
              disabled={busy === replyKey || !String(replyText[replyKey] || '').trim()}
              onClick={() => onReply(reply)}
              className="shrink-0"
            >
              {busy === replyKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Reply
            </Button>
          </div>
        </div>
      ) : null}

      {!canReply && canEngageWithSocial(user) ? (
        <p className="mt-1.5 text-[10px] text-[var(--muted)]">
          Sync comments after publishing the reply before replying deeper.
        </p>
      ) : null}
    </div>
  );
}
