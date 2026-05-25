'use client';

import { useEffect, useMemo, useState } from 'react';
import { Filter, MessageSquare, RefreshCw } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { getUser } from '../../lib/auth';
import { formatPlatform } from '../../lib/platforms';

const metricKeys = ['likes', 'reactions', 'comments', 'shares', 'views', 'saves'];

const emptyMetrics = { likes: 0, reactions: 0, comments: 0, shares: 0, views: 0, saves: 0 };

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
    setBusy(comment._id);
    setMessage('');
    try {
      await api.post(`/api/social/comments/${comment._id}/reply`, { replyText: replyText[comment._id] || '' });
      setMessage(`Reply created through the connected ${formatPlatform(comment.platform)} account.`);
      setReplyText(current => ({ ...current, [comment._id]: '' }));
      if (selectedGroup?.id) await openGroup(selectedGroup.id, selectedPlatform);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
    }
  };

  const selectedTotals = useMemo(() => selectedGroup?.totals || emptyMetrics, [selectedGroup]);
  const visibleComments = useMemo(() => {
    const comments = selectedGroup?.comments || [];
    const repliesByParent = comments.reduce((acc, comment) => {
      if (!comment.isProviderReply || !comment.parentProviderCommentId) return acc;
      acc[comment.parentProviderCommentId] = acc[comment.parentProviderCommentId] || [];
      acc[comment.parentProviderCommentId].push(comment);
      return acc;
    }, {});
    const topLevel = comments
      .filter(comment => !comment.isProviderReply)
      .map(comment => ({
        ...comment,
        providerReplies: repliesByParent[comment.providerCommentId] || []
      }));
    const knownParentIds = new Set(topLevel.map(comment => comment.providerCommentId));
    const orphanReplies = comments
      .filter(comment => comment.isProviderReply && !knownParentIds.has(comment.parentProviderCommentId))
      .map(comment => ({ ...comment, providerReplies: [] }));
    return [...topLevel, ...orphanReplies];
  }, [selectedGroup]);

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="rounded-lg border border-line bg-panel p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-cyan">Unified real social data</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Post Details & Analytics</h1>
          <p className="mt-2 max-w-4xl text-sm text-slate-400">
            Open one post group to see the same post across connected platforms. Combined totals are shown beside per-platform reactions, comments, shares, views, saves, platform status, comments, and reply controls. No fake metrics are generated.
          </p>
        </header>

        {message && <div className="rounded-md border border-line bg-panel p-3 text-sm text-slate-300">{message}</div>}

        {syncResults.length > 0 && (
          <section className="rounded-lg border border-line bg-panel p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Last Sync Result</h2>
            <div className="mt-3 grid gap-2">
              {syncResults.map(result => (
                <div key={`${result.platform}-${result.postId}`} className={`rounded-md border p-3 text-sm ${result.ok ? 'border-mint/30 bg-mint/10 text-mint' : 'border-gold/30 bg-gold/10 text-gold'}`}>
                  <div className="font-semibold">{formatPlatform(result.platform)}</div>
                  <div className="mt-1 grid gap-1 text-xs text-slate-300">
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
          <div className="rounded-md border border-gold/30 bg-gold/10 p-3 text-sm text-gold">{summary.unavailableMessage}</div>
        )}

        <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Published Post Groups</h2>
            {groups.map(group => (
              <button
                key={group.id}
                type="button"
                onClick={() => openGroup(group.id)}
                className={`w-full rounded-lg border p-4 text-left transition hover:border-cyan ${selectedGroup?.id === group.id ? 'border-cyan bg-cyan/10' : 'border-line bg-panel'}`}
              >
                <div className="text-sm font-semibold text-white">{group.title}</div>
                <p className="mt-2 line-clamp-3 text-xs text-slate-400">{group.caption || 'No caption stored.'}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {group.platforms.map(platform => (
                    <span key={platform} className="rounded-full bg-ink px-2 py-1 text-xs text-cyan">{formatPlatform(platform)}</span>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-400">
                  <span>Likes {group.totals.likes}</span>
                  <span>Comments {group.totals.comments}</span>
                  <span>Shares {group.totals.shares}</span>
                </div>
              </button>
            ))}
            {groups.length === 0 && <p className="rounded-lg border border-line bg-panel p-5 text-sm text-slate-400">No post groups yet. Publish from Compose first.</p>}
          </div>

          <div className="space-y-4">
            {selectedGroup ? (
              <>
                <section className="rounded-lg border border-line bg-panel p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold text-white">{selectedGroup.title}</h2>
                      <p className="mt-2 max-w-3xl text-sm text-slate-400">{selectedGroup.caption}</p>
                    </div>
                    <button type="button" disabled={busy === `sync-${selectedGroup.id}` || user?.role !== 'creator_admin'} onClick={() => syncGroup(selectedGroup)} className="focus-ring inline-flex items-center gap-2 rounded-md bg-cyan px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50">
                      <RefreshCw size={15} />
                      Sync all platforms
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Filter size={13} /> Filter:</span>
                    <button type="button" onClick={() => openGroup(selectedGroup.id, '')} className={`rounded-full px-3 py-1 text-xs ${!selectedPlatform ? 'bg-cyan text-ink' : 'bg-ink text-slate-300'}`}>All</button>
                    {selectedGroup.platforms.map(platform => (
                      <button key={platform} type="button" onClick={() => openGroup(selectedGroup.id, platform)} className={`rounded-full px-3 py-1 text-xs ${selectedPlatform === platform ? 'bg-cyan text-ink' : 'bg-ink text-slate-300'}`}>
                        {formatPlatform(platform)}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                  {metricKeys.map(metric => <MetricCard key={metric} label={`Combined ${metric}`} value={selectedTotals[metric] || 0} />)}
                </section>

                <section className="grid gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Per-Platform Breakdown</h3>
                  {selectedGroup.platformBreakdown.map(item => (
                    <article key={item.platform} className="rounded-lg border border-line bg-panel p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <span className="rounded-full bg-cyan/10 px-2 py-1 text-xs font-semibold text-cyan">{formatPlatform(item.platform)}</span>
                          <div className="mt-2 text-sm text-slate-300">
                            {item.accountSnapshot?.accountName || 'Unknown account'} {item.accountSnapshot?.accountHandle ? `(${item.accountSnapshot.accountHandle})` : ''}
                          </div>
                        </div>
                        <span className="rounded-full bg-ink px-2 py-1 text-xs text-slate-300">{item.status}</span>
                      </div>
                      <div className="mt-4 grid gap-2 md:grid-cols-6">
                        {metricKeys.map(metric => (
                          <div key={metric} className="rounded-md border border-line bg-ink p-2">
                            <div className="text-[10px] uppercase text-slate-500">{metric}</div>
                            <div className="text-base font-bold text-white">{item.metrics?.[metric] || 0}</div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 grid gap-1 text-xs text-slate-400">
                        {item.providerPostUrl ? <a href={item.providerPostUrl} target="_blank" rel="noreferrer" className="text-cyan underline">View on platform</a> : <span>Provider URL: not available</span>}
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

                <section className="rounded-lg border border-line bg-panel p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Comments</h3>
                  <div className="mt-3 space-y-3">
                    {visibleComments.map(comment => (
                      <div key={comment._id} className="rounded-md border border-line bg-ink p-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <MessageSquare size={13} />
                          <span className="rounded-full bg-cyan/10 px-2 py-1 text-cyan">{formatPlatform(comment.platform)}</span>
                          <span>{comment.authorName || comment.authorHandle || 'Platform user'}</span>
                          <span>likes {comment.likeCount || 0}</span>
                          <span>replies {comment.replyCount || 0}</span>
                          <span>source: {comment.source}</span>
                          {comment.isProviderReply && <span className="rounded-full bg-mint/10 px-2 py-1 text-mint">reply</span>}
                        </div>
                        <p className="mt-2 text-sm text-slate-300">{comment.text}</p>
                        {(comment.providerReplies || []).length > 0 && (
                          <div className="mt-3 space-y-2 border-l border-line pl-4">
                            {comment.providerReplies.map(reply => (
                              <div key={reply._id} className="rounded-md border border-line bg-panel p-3">
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                  <span className="rounded-full bg-mint/10 px-2 py-1 text-mint">reply</span>
                                  <span>{reply.authorName || reply.authorHandle || 'Platform user'}</span>
                                  <span>likes {reply.likeCount || 0}</span>
                                  <span>source: {reply.source}</span>
                                </div>
                                <p className="mt-2 text-sm text-slate-300">{reply.text}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {user?.role === 'creator_admin' && !comment.isProviderReply && (
                          <div className="mt-3 flex gap-2">
                            <input value={replyText[comment._id] || ''} onChange={event => setReplyText({ ...replyText, [comment._id]: event.target.value })} placeholder={`Reply on ${formatPlatform(comment.platform)} using the publishing account`} className="focus-ring flex-1 rounded-md border border-line bg-panel px-3 py-2 text-sm text-white" />
                            <button type="button" disabled={busy === comment._id} onClick={() => reply(comment)} className="focus-ring rounded-md bg-mint px-3 py-2 text-sm font-semibold text-ink">Reply</button>
                          </div>
                        )}
                      </div>
                    ))}
                    {visibleComments.length === 0 && (
                      <div className="space-y-2">
                        {selectedGroup.platformBreakdown.map(item => (
                          <p key={item.platform} className="rounded-md border border-line bg-ink p-3 text-sm text-slate-400">
                            <span className="font-semibold text-white">{formatPlatform(item.platform)}:</span>{' '}
                            {item.commentsUnavailableMessage || 'No real comments synced for this platform yet.'}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              </>
            ) : (
              <div className="rounded-lg border border-line bg-panel p-8 text-sm text-slate-400">Select a post group to see combined analytics and per-platform details.</div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
    </div>
  );
}
