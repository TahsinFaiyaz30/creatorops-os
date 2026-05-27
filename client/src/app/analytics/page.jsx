'use client';

import { useEffect, useMemo, useState } from 'react';
import { Filter, MessageSquare, RefreshCw } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { getUser } from '../../lib/auth';
import { formatPlatform } from '../../lib/platforms';
import { canEngageWithSocial } from '../../lib/roles';

const metricKeys = ['likes', 'reactions', 'comments', 'shares', 'views', 'saves'];

const emptyMetrics = { likes: 0, reactions: 0, comments: 0, shares: 0, views: 0, saves: 0 };

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

export default function AnalyticsPage() {
  const [user, setUser] = useState(null);
  const [summary, setSummary] = useState(null);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [message, setMessage] = useState('');
  const [syncResults, setSyncResults] = useState([]);
  const [replyText, setReplyText] = useState({});
  const [busy, setBusy] = useState('');

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

  const selectedTotals = useMemo(() => selectedGroup?.totals || emptyMetrics, [selectedGroup]);
  const commentTree = useMemo(() => buildCommentTree(selectedGroup?.comments || []), [selectedGroup]);

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-mint">Unified real social data</p>
          <h1 className="mt-2 text-3xl font-bold text-[var(--text)]">Post Details & Analytics</h1>
          <p className="mt-2 max-w-4xl text-sm text-[var(--muted)]">
            Open one post group to see the same post across connected platforms. Combined totals are shown beside per-platform reactions, comments, shares, views, saves, platform status, comments, and reply controls. No fake metrics are generated.
          </p>
        </header>

        {message && <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--text)]">{message}</div>}

        {syncResults.length > 0 && (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Last Sync Result</h2>
            <div className="mt-3 grid gap-2">
              {syncResults.map(result => (
                <div key={`${result.platform}-${result.postId}`} className={`rounded-xl border p-3 text-sm ${result.ok ? 'border-mint/30 bg-mint/10 text-mint' : 'border-gold/30 bg-gold/10 text-gold'}`}>
                  <div className="font-semibold">{formatPlatform(result.platform)}</div>
                  <div className="mt-1 grid gap-1 text-xs text-[var(--text)]">
                    <span>Metrics: {result.analytics?.ok ? result.analytics.message || 'synced' : result.analytics?.message || result.message || 'not synced'}</span>
                    <span>Comments: {result.comments?.ok ? `${result.comments.data?.length || 0} real comment${(result.comments.data?.length || 0) === 1 ? '' : 's'} returned` : result.comments?.message || result.message || 'not synced'}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {metricKeys.map(metric => (
            <MetricCard key={metric} label={`Workspace ${metric}`} value={summary?.totals?.[metric] || 0} />
          ))}
        </section>

        {summary?.unavailableMessage && (
          <div className="rounded-xl border border-gold/30 bg-gold/10 p-3 text-sm text-gold">{summary.unavailableMessage}</div>
        )}

        <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Published Post Groups</h2>
            {groups.map(group => (
              <button
                key={group.id}
                type="button"
                onClick={() => openGroup(group.id)}
                className={`w-full rounded-2xl border p-4 text-left transition hover:border-mint ${selectedGroup?.id === group.id ? 'border-mint bg-mint/10' : 'border-[var(--border)] bg-[var(--surface)]'}`}
              >
                <div className="text-sm font-semibold text-[var(--text)]">{group.title}</div>
                <p className="mt-2 line-clamp-3 text-xs text-[var(--muted)]">{group.caption || 'No caption stored.'}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {group.platforms.map(platform => (
                    <span key={platform} className="rounded-full bg-[var(--surface2)] px-2 py-1 text-xs text-mint">{formatPlatform(platform)}</span>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-[var(--muted)]">
                  <span>Likes {group.totals.likes}</span>
                  <span>Comments {group.totals.comments}</span>
                  <span>Shares {group.totals.shares}</span>
                </div>
              </button>
            ))}
            {groups.length === 0 && <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">No post groups yet. Publish from Compose first.</p>}
          </div>

          <div className="space-y-4">
            {selectedGroup ? (
              <>
                <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold text-[var(--text)]">{selectedGroup.title}</h2>
                      <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">{selectedGroup.caption}</p>
                    </div>
                    <button type="button" disabled={busy === `sync-${selectedGroup.id}`} onClick={() => syncGroup(selectedGroup)} className="focus-ring inline-flex items-center gap-2 rounded-xl bg-mint px-3 py-2 text-sm font-semibold text-[#05130d] disabled:opacity-50">
                      <RefreshCw size={15} />
                      Sync all platforms
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]"><Filter size={13} /> Filter:</span>
                    <button type="button" onClick={() => openGroup(selectedGroup.id, '')} className={`rounded-full px-3 py-1 text-xs ${!selectedPlatform ? 'bg-mint text-[#05130d]' : 'bg-[var(--surface2)] text-[var(--text)]'}`}>All</button>
                    {selectedGroup.platforms.map(platform => (
                      <button key={platform} type="button" onClick={() => openGroup(selectedGroup.id, platform)} className={`rounded-full px-3 py-1 text-xs ${selectedPlatform === platform ? 'bg-mint text-[#05130d]' : 'bg-[var(--surface2)] text-[var(--text)]'}`}>
                        {formatPlatform(platform)}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                  {metricKeys.map(metric => <MetricCard key={metric} label={`Combined ${metric}`} value={selectedTotals[metric] || 0} />)}
                </section>

                <section className="grid gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Per-Platform Breakdown</h3>
                  {selectedGroup.platformBreakdown.map(item => (
                    <article key={item.platform} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <span className="rounded-full bg-mint/10 px-2 py-1 text-xs font-semibold text-mint">{formatPlatform(item.platform)}</span>
                          <div className="mt-2 text-sm text-[var(--text)]">
                            {item.accountSnapshot?.accountName || 'Unknown account'} {item.accountSnapshot?.accountHandle ? `(${item.accountSnapshot.accountHandle})` : ''}
                          </div>
                        </div>
                        <span className="rounded-full bg-[var(--surface2)] px-2 py-1 text-xs text-[var(--text)]">{item.status}</span>
                      </div>
                      <div className="mt-4 grid gap-2 md:grid-cols-6">
                        {metricKeys.map(metric => (
                          <div key={metric} className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-2">
                            <div className="text-[10px] uppercase text-[var(--muted)]">{metric}</div>
                            <div className="text-base font-bold text-[var(--text)]">{item.metrics?.[metric] || 0}</div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 grid gap-1 text-xs text-[var(--muted)]">
                        {item.providerPostUrl ? <a href={item.providerPostUrl} target="_blank" rel="noreferrer" className="text-mint underline">View on platform</a> : <span>Provider URL: not available</span>}
                        {item.latestSyncedAt ? <span>Last synced: {new Date(item.latestSyncedAt).toLocaleString()}</span> : <span>Last synced: never</span>}
                        <span>Metrics sync: {item.analyticsStatus}{item.lastAnalyticsErrorMessage ? ` - ${item.lastAnalyticsErrorMessage}` : ''}</span>
                        <span>Comments sync: {item.commentsStatus}{item.lastCommentsSyncAt ? ` - ${new Date(item.lastCommentsSyncAt).toLocaleString()}` : ''}</span>
                        <span>Synced comments: {item.commentCount || 0} top-level, {item.replyRecordCount || 0} replies</span>
                        {item.commentsUnavailableMessage && <span className="text-gold">Comments: {item.commentsUnavailableMessage}</span>}
                        {item.unavailableMessage && <span className="text-gold">{item.unavailableMessage}</span>}
                      </div>
                    </article>
                  ))}
                </section>

                <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Comments</h3>
                  <div className="mt-3 space-y-3">
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
                    {commentTree.length === 0 && (
                      <div className="space-y-2">
                        {selectedGroup.platformBreakdown.map(item => (
                          <p key={item.platform} className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-3 text-sm text-[var(--muted)]">
                            <span className="font-semibold text-[var(--text)]">{formatPlatform(item.platform)}:</span>{' '}
                            {item.commentsUnavailableMessage || 'No real comments synced for this platform yet.'}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              </>
            ) : (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-sm text-[var(--muted)]">Select a post group to see combined analytics and per-platform details.</div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-2xl font-bold text-[var(--text)]">{value}</div>
    </div>
  );
}

function CommentThreadNode({ comment, user, busy, replyText, setReplyText, onReply, onReplyToAccountReply, depth = 0 }) {
  const providerReplies = comment.providerReplies || [];
  const accountReplies = comment.accountReplies || [];
  const canReply = canEngageWithSocial(user) && comment.source === 'real' && Boolean(comment.providerCommentId);
  const totalReplies = getReplyCount(comment);
  const commentKey = getId(comment);

  return (
    <div className={`rounded-xl border border-[var(--border)] ${depth === 0 ? 'bg-[var(--surface2)]' : 'bg-[var(--surface)]'} p-3`}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
        <MessageSquare size={13} />
        <span className="rounded-full bg-mint/10 px-2 py-1 text-mint">{formatPlatform(comment.platform)}</span>
        <span className="rounded-full bg-[var(--surface2)] px-2 py-1 text-[var(--text)]">
          {depth === 0 ? 'source comment' : `nested reply L${depth}`}
        </span>
        <span>{comment.authorName || comment.authorHandle || 'Platform user'}</span>
        <span>likes {comment.likeCount || 0}</span>
        <span>replies {comment.replyCount || totalReplies || 0}</span>
        <span>source: {comment.source}</span>
      </div>

      <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text)]">{comment.text}</p>

      {accountReplies.length > 0 && (
        <div className="mt-3 space-y-2 border-l border-mint/30 pl-4">
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
      )}

      {providerReplies.length > 0 && (
        <div className="mt-3 space-y-2 border-l border-[var(--border)] pl-4">
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
      )}

      {canReply && (
        <div className="mt-3 space-y-2">
          {depth > 0 && isYouTubePlatform(comment.platform) && (
            <p className="text-xs text-[var(--muted)]">
              YouTube will publish this under the top-level thread; CreatorOps keeps it nested under the reply you selected.
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={replyText[commentKey] || ''}
              onChange={event => setReplyText({ ...replyText, [commentKey]: event.target.value })}
              placeholder={`${depth === 0 ? 'Reply to this comment' : 'Reply to this nested reply'} on ${formatPlatform(comment.platform)}`}
              className="focus-ring flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
            />
            <button
              type="button"
              disabled={busy === commentKey || !String(replyText[commentKey] || '').trim()}
              onClick={() => onReply(comment)}
              className="focus-ring rounded-xl bg-mint px-3 py-2 text-sm font-semibold text-[#05130d]"
            >
              Reply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AccountReplyCard({ reply, user, busy, replyText, setReplyText, onReply, platform, depth = 1 }) {
  const account = reply.accountSnapshot || {};
  const nestedReplies = reply.accountReplies || [];
  const replyKey = `reply:${getId(reply)}`;
  const canReply = canEngageWithSocial(user) && Boolean(reply.providerReplyId);

  return (
    <div className="rounded-xl border border-mint/20 bg-mint/10 p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
        <span className="rounded-full bg-mint/15 px-2 py-1 text-mint">CreatorOps reply</span>
        <span className="rounded-full bg-[var(--surface2)] px-2 py-1 text-[var(--text)]">nested reply L{depth}</span>
        <span>{account.accountName || account.accountHandle || formatPlatform(platform)}</span>
        {reply.repliedBy?.name && <span>by {reply.repliedBy.name}</span>}
        <span>source: {reply.source}</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text)]">{reply.replyText}</p>

      {nestedReplies.length > 0 && (
        <div className="mt-3 space-y-2 border-l border-mint/30 pl-4">
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
      )}

      {canReply && (
        <div className="mt-3 space-y-2">
          {isYouTubePlatform(platform) && (
            <p className="text-xs text-[var(--muted)]">
              YouTube will publish this under the top-level thread; CreatorOps keeps it nested under this reply.
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={replyText[replyKey] || ''}
              onChange={event => setReplyText({ ...replyText, [replyKey]: event.target.value })}
              placeholder={`Reply to this nested CreatorOps reply on ${formatPlatform(platform)}`}
              className="focus-ring flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
            />
            <button
              type="button"
              disabled={busy === replyKey || !String(replyText[replyKey] || '').trim()}
              onClick={() => onReply(reply)}
              className="focus-ring rounded-xl bg-mint px-3 py-2 text-sm font-semibold text-[#05130d]"
            >
              Reply
            </button>
          </div>
        </div>
      )}

      {!canReply && canEngageWithSocial(user) && (
        <p className="mt-2 text-xs text-[var(--muted)]">Sync comments after publishing the reply before replying deeper.</p>
      )}
    </div>
  );
}
