'use client';

/**
 * Social Inbox — GET /api/social/posts/:id/comments,
 * POST /api/social/comments/:id/reply, POST /api/social/replies/:id/reply
 *
 * The server can pull comments per published post and post threaded replies back
 * to the provider. The client had reply helpers wired into the analytics page but
 * no inbox: there was no way to see incoming comments across posts, or to answer
 * them from one place.
 */

import { useEffect, useMemo, useState } from 'react';
import { MessagesSquare, Send, RefreshCw, CornerDownRight, Inbox as InboxIcon } from 'lucide-react';

import AppShell from '../../components/layout/AppShell';
import {
  Page, PageHeader, Section, Surface, Badge, Button, Textarea, Field,
  EmptyState, Skeleton, Notice, StatTile, StatGrid
} from '../../components/ds';
import { api } from '../../lib/api';

const rel = d => {
  if (!d) return '';
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export default function InboxPage() {
  const [posts, setPosts] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [comments, setComments] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get('/api/social/posts')
      .then(p => {
        const list = p?.data?.posts || [];
        setPosts(list);
        if (list.length) setActiveId(list[0]._id || list[0].id);
      })
      .catch(e => setError(e.message));
  }, []);

  useEffect(() => {
    if (!activeId) return;
    setComments(null);
    api
      .get(`/api/social/posts/${activeId}/comments`)
      .then(p => setComments(p?.data?.comments || []))
      .catch(e => setError(e.message));
  }, [activeId]);

  const syncComments = async () => {
    if (!activeId) return;
    setBusy(true);
    try {
      await api.post(`/api/social/posts/${activeId}/sync`, {});
      const p = await api.get(`/api/social/posts/${activeId}/comments`);
      setComments(p?.data?.comments || []);
      setNotice('Comments re-synced from the provider.');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const sendReply = async () => {
    if (!replyTo || !replyText.trim()) return;
    setBusy(true);
    setError('');
    try {
      const path =
        replyTo.kind === 'reply'
          ? `/api/social/replies/${replyTo.id}/reply`
          : `/api/social/comments/${replyTo.id}/reply`;
      await api.post(path, { message: replyText });
      setNotice('Reply posted to the platform.');
      setReplyText('');
      setReplyTo(null);
      const p = await api.get(`/api/social/posts/${activeId}/comments`);
      setComments(p?.data?.comments || []);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const stats = useMemo(() => {
    if (!posts) return null;
    return {
      posts: posts.length,
      comments: posts.reduce((s, p) => s + (p.lastCommentCount || 0), 0),
      awaiting: comments?.filter(c => !c.replies?.length).length ?? 0
    };
  }, [posts, comments]);

  return (
    <AppShell>
      <Page>
        <PageHeader
          eyebrow="Measure"
          title="Social Inbox"
          description="Comments pulled from your published posts, answerable from here. Replies post straight back to the platform through the connected account."
          actions={
            activeId ? (
              <Button variant="secondary" onClick={syncComments} disabled={busy}>
                <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
                Sync
              </Button>
            ) : null
          }
        />

        {error ? <Notice tone="danger">{error}</Notice> : null}
        {notice ? <Notice tone="success">{notice}</Notice> : null}

        {stats ? (
          <StatGrid className="lg:grid-cols-3 xl:grid-cols-3">
            <StatTile label="Posts" value={stats.posts} icon={MessagesSquare} tone="accent" />
            <StatTile label="Known comments" value={stats.comments} icon={InboxIcon} />
            <StatTile label="Unanswered" value={stats.awaiting} icon={CornerDownRight} tone="warning" />
          </StatGrid>
        ) : null}

        {!posts ? (
          <Skeleton className="h-64" />
        ) : posts.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title="No published posts to listen on"
            description="Once Dispatch publishes something, its comments appear here and you can reply without leaving CreatorOps."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            {/* Post picker */}
            <Section title="Posts">
              <div className="space-y-1.5">
                {posts.map(p => {
                  const id = p._id || p.id;
                  const active = id === activeId;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setActiveId(id)}
                      className={`focus-ring w-full rounded-lg border p-2.5 text-left transition-colors ${
                        active
                          ? 'border-[var(--accent-line)] bg-[var(--accent-soft)]'
                          : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface2)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
                          {p.platform}
                        </span>
                        <Badge tone={p.lastCommentCount ? 'accent' : 'neutral'}>
                          {p.lastCommentCount ?? 0}
                        </Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--text-2)]">
                        {p.caption || 'No caption'}
                      </p>
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* Thread */}
            <Section title="Thread">
              {!comments ? (
                <Skeleton className="h-48" />
              ) : comments.length === 0 ? (
                <EmptyState
                  icon={InboxIcon}
                  title="No comments on this post"
                  description="Hit Sync to pull the latest from the platform."
                />
              ) : (
                <ul className="space-y-2">
                  {comments.map(c => {
                    const cid = c._id || c.id;
                    return (
                      <li key={cid}>
                        <Surface pad="sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-[var(--text)]">
                              {c.authorName || c.author || 'Unknown'}
                            </span>
                            <time className="text-[10px] tabular-nums text-[var(--muted)]">
                              {rel(c.createdAt || c.publishedAt)}
                            </time>
                          </div>
                          <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-2)]">
                            {c.message || c.text}
                          </p>

                          {c.replies?.length ? (
                            <ul className="mt-2 space-y-1.5 border-l border-[var(--border)] pl-3">
                              {c.replies.map(r => (
                                <li key={r._id || r.id} className="text-xs text-[var(--text-2)]">
                                  <span className="font-semibold text-[var(--text)]">
                                    {r.authorName || 'You'}:
                                  </span>{' '}
                                  {r.message || r.text}
                                </li>
                              ))}
                            </ul>
                          ) : null}

                          {replyTo?.id === cid ? (
                            <div className="mt-2 space-y-2">
                              <Field label="Your reply" htmlFor={`reply-${cid}`}>
                                <Textarea
                                  id={`reply-${cid}`}
                                  value={replyText}
                                  onChange={e => setReplyText(e.target.value)}
                                  placeholder="Write a reply…"
                                />
                              </Field>
                              <div className="flex gap-2">
                                <Button variant="primary" size="sm" onClick={sendReply} disabled={busy || !replyText.trim()}>
                                  <Send className="h-3.5 w-3.5" /> Post reply
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => { setReplyTo(null); setReplyText(''); }}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-2"
                              onClick={() => { setReplyTo({ id: cid, kind: 'comment' }); setReplyText(''); }}
                            >
                              <CornerDownRight className="h-3.5 w-3.5" /> Reply
                            </Button>
                          )}
                        </Surface>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>
          </div>
        )}
      </Page>
    </AppShell>
  );
}
