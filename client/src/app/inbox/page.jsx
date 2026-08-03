'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Social Inbox — GET /api/social/posts, /posts/:id/comments,
 * POST /posts/:id/sync, POST /api/social/comments/:id/reply
 *
 * Two defects fixed, both of which made this page non-functional:
 *
 *  1. Replies were sent as `{ message }`. The controller reads
 *     `req.body.replyText`, so the service saw undefined and threw
 *     "replyText is required." — every reply from this page 400'd.
 *
 *  2. The thread rendered `comment.replies`, a field that does not exist.
 *     listComments returns a FLAT SocialComment list; nesting lives in
 *     `isProviderReply` + `parentProviderCommentId`. Replies were invisible and
 *     the "unanswered" count was just the comment count. The tree is built here
 *     now, and answered state reads the real `isReplied` flag.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  MessagesSquare, Send, RefreshCw, CornerDownRight, Inbox as InboxIcon,
  Search, Heart, CheckCheck, ImageOff, Loader2, X, AtSign
} from 'lucide-react';

import AppShell from '../../components/layout/AppShell';
import { TextGenerateEffect } from '../../components/ui/text-generate-effect';
import { BackgroundBeams } from '../../components/ui/background-beams';
import {
  Page, Section, Badge, Button, Input, Textarea,
  EmptyState, Skeleton, Notice, GlareStat, GlareStatGrid, GLARE_TINTS
} from '../../components/ds';
import { api } from '../../lib/api';
import { formatPlatform } from '../../lib/platforms';

const EASE = [0.16, 1, 0.3, 1];

const rel = d => {
  if (!d) return '';
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const idOf = item => String(item?._id || item?.id || '');

const commentTime = comment => new Date(comment.providerCreatedAt || comment.createdAt || 0).getTime();

/*
 * listComments returns every node flat, replies included. Rebuild the thread
 * from parentProviderCommentId; anything whose parent is missing from the page
 * is treated as a root so nothing silently disappears.
 */
const buildThreads = comments => {
  const byProviderId = new Map();
  comments.forEach(comment => {
    byProviderId.set(String(comment.providerCommentId), { ...comment, replies: [] });
  });

  const roots = [];
  byProviderId.forEach(comment => {
    const parent = comment.parentProviderCommentId
      ? byProviderId.get(String(comment.parentProviderCommentId))
      : null;
    if (comment.isProviderReply && parent) parent.replies.push(comment);
    else roots.push(comment);
  });

  const sortTree = node => {
    node.replies = node.replies.sort((a, b) => commentTime(a) - commentTime(b)).map(sortTree);
    return node;
  };

  return roots.sort((a, b) => commentTime(b) - commentTime(a)).map(sortTree);
};

const countNodes = nodes =>
  nodes.reduce((total, node) => total + 1 + countNodes(node.replies || []), 0);

/* ── Post picker row ──────────────────────────────────────────────────────── */

function PostRow({ post, active, onSelect }) {
  const media = (post.mediaAssetIds || []).find(asset => asset?.publicUrl) || null;
  const [broken, setBroken] = useState(false);
  const connection = post.platformConnectionId || {};

  useEffect(() => { setBroken(false); }, [media?.publicUrl]);

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileHover={{ x: 2 }}
      aria-pressed={active}
      className={`focus-ring relative flex w-full gap-2.5 overflow-hidden rounded-xl border p-2 text-left transition-colors ${
        active
          ? 'border-[var(--accent-line)] bg-[var(--accent-soft)]'
          : 'border-[var(--border)] bg-[var(--surface)]/70 hover:border-[var(--border-strong)]'
      }`}
    >
      {active ? (
        <motion.span
          layoutId="inbox-active-post"
          className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-[var(--accent)]"
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        />
      ) : null}

      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface2)]">
        {media && !broken ? (
          <img
            src={media.publicUrl}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setBroken(true)}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            <ImageOff className="h-3.5 w-3.5 text-[var(--muted)]" />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--text-2)]">
            {formatPlatform(post.platform)}
          </span>
          <Badge tone={post.lastCommentCount ? 'accent' : 'neutral'}>{post.lastCommentCount ?? 0}</Badge>
        </div>
        {connection.accountHandle ? (
          <p className="flex items-center gap-0.5 truncate text-[9px] text-[var(--muted)]">
            <AtSign className="h-2 w-2" />
            {connection.accountHandle}
          </p>
        ) : null}
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[var(--muted)]">
          {post.caption || 'No caption'}
        </p>
      </div>
    </motion.button>
  );
}

/* ── Comment node ─────────────────────────────────────────────────────────── */

function CommentNode({ comment, depth, replyTo, replyText, busy, onStartReply, onCancelReply, onChangeReply, onSend }) {
  const cid = idOf(comment);
  const open = replyTo === cid;
  const initial = (comment.authorName || comment.authorHandle || '?').trim().charAt(0).toUpperCase();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
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
            {depth > 0 ? <Badge tone="neutral">reply</Badge> : null}
            {comment.isReplied ? (
              <Badge tone="success">
                <CheckCheck className="h-2.5 w-2.5" />
                answered
              </Badge>
            ) : null}
            <time className="ml-auto text-[10px] tabular-nums text-[var(--muted)]">
              {rel(comment.providerCreatedAt || comment.createdAt)}
            </time>
          </div>

          <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-2)]">
            {comment.text || comment.message}
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-[var(--muted)]">
            <span className="inline-flex items-center gap-1">
              <Heart className="h-2.5 w-2.5" />
              {comment.likeCount || 0}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessagesSquare className="h-2.5 w-2.5" />
              {comment.replyCount || comment.replies?.length || 0}
            </span>
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="mt-2.5 space-y-2 rounded-lg border border-[var(--accent-line)] bg-[var(--accent-soft)] p-2.5">
              <Textarea
                value={replyText}
                onChange={e => onChangeReply(e.target.value)}
                placeholder={`Reply as your connected ${formatPlatform(comment.platform)} account…`}
                aria-label="Reply text"
                className="min-h-[56px] text-xs"
              />
              <div className="flex gap-1.5">
                <Button size="sm" variant="primary" onClick={onSend} disabled={busy || !replyText.trim()}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Post reply
                </Button>
                <Button size="sm" variant="ghost" onClick={onCancelReply}>
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => onStartReply(cid)}>
            <CornerDownRight className="h-3.5 w-3.5" />
            Reply
          </Button>
        )}
      </AnimatePresence>

      {comment.replies?.length ? (
        <div className="mt-2.5 space-y-2 border-l-2 border-[var(--border)] pl-3">
          {comment.replies.map(child => (
            <CommentNode
              key={idOf(child)}
              comment={child}
              depth={depth + 1}
              replyTo={replyTo}
              replyText={replyText}
              busy={busy}
              onStartReply={onStartReply}
              onCancelReply={onCancelReply}
              onChangeReply={onChangeReply}
              onSend={onSend}
            />
          ))}
        </div>
      ) : null}
    </motion.div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function InboxPage() {
  const [posts, setPosts] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [comments, setComments] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api
      .get('/api/social/posts')
      .then(p => {
        const list = p?.data?.posts || [];
        setPosts(list);
        if (list.length) setActiveId(idOf(list[0]));
      })
      .catch(e => setError(e.message));
  }, []);

  useEffect(() => {
    if (!activeId) return;
    setComments(null);
    setReplyTo(null);
    api
      .get(`/api/social/posts/${activeId}/comments`)
      .then(p => setComments(p?.data?.comments || []))
      .catch(e => setError(e.message));
  }, [activeId]);

  const syncComments = async () => {
    if (!activeId) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.post(`/api/social/posts/${activeId}/sync`, {});
      const p = await api.get(`/api/social/posts/${activeId}/comments`);
      setComments(p?.data?.comments || []);
      setNotice('Comments re-synced from the provider.');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  /*
   * Every node here is a SocialComment, so the reply always targets
   * /comments/:id/reply. The /replies/:id/reply route answers a SocialReply,
   * which this payload never contains — the analytics page owns that path.
   */
  const sendReply = async () => {
    if (!replyTo || !replyText.trim()) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.post(`/api/social/comments/${replyTo}/reply`, { replyText: replyText.trim() });
      setNotice('Reply posted to the platform through the connected account.');
      setReplyText('');
      setReplyTo(null);
      const p = await api.get(`/api/social/posts/${activeId}/comments`);
      setComments(p?.data?.comments || []);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const threads = useMemo(() => (comments ? buildThreads(comments) : null), [comments]);

  const stats = useMemo(() => {
    if (!posts) return null;
    return {
      posts: posts.length,
      known: posts.reduce((s, p) => s + (p.lastCommentCount || 0), 0),
      threads: threads?.length ?? 0,
      awaiting: (comments || []).filter(c => !c.isReplied).length,
      answered: (comments || []).filter(c => c.isReplied).length
    };
  }, [posts, comments, threads]);

  const visiblePosts = useMemo(() => {
    if (!posts) return null;
    const q = query.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter(post =>
      [post.platform, post.caption, post.platformConnectionId?.accountHandle]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(q))
    );
  }, [posts, query]);

  const activePost = posts?.find(p => idOf(p) === activeId) || null;

  return (
    <AppShell>
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <BackgroundBeams className="opacity-25 dark:opacity-50" />
        <div className="absolute inset-0 bg-blueprint [mask-image:radial-gradient(ellipse_at_top,black_10%,transparent_70%)]" />
      </div>

      <Page>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
              Measure
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
              Social Inbox
            </h1>
            <div className="max-w-3xl">
              <TextGenerateEffect
                words="Comments pulled from your published posts, answerable without leaving CreatorOps. Replies go out through the connected account and come back into the thread on the next sync."
                className="font-normal"
                duration={0.5}
              />
            </div>
          </div>
          {activeId ? (
            <Button variant="secondary" onClick={syncComments} disabled={busy} className="shrink-0">
              <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
              Sync comments
            </Button>
          ) : null}
        </div>

        {error ? <Notice tone="danger">{error}</Notice> : null}
        {notice ? <Notice tone="success">{notice}</Notice> : null}

        {stats ? (
          <GlareStatGrid>
            <GlareStat label="Posts listening" value={stats.posts}    icon={MessagesSquare}  tint={GLARE_TINTS[0]} />
            <GlareStat label="Known comments"  value={stats.known}    icon={InboxIcon}       tint={GLARE_TINTS[1]} hint="Across all posts" />
            <GlareStat label="Threads here"    value={stats.threads}  icon={CornerDownRight} tint={GLARE_TINTS[2]} hint="On the open post" />
            <GlareStat label="Awaiting reply"  value={stats.awaiting} icon={Send}            tint={GLARE_TINTS[3]} />
            <GlareStat label="Answered"        value={stats.answered} icon={CheckCheck}      tint={GLARE_TINTS[4]} />
          </GlareStatGrid>
        ) : null}

        {!posts ? (
          <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        ) : posts.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title="No published posts to listen on"
            description="Once Dispatch publishes something, its comments appear here and you can reply from one place."
            action={
              <Button as="a" href="/publishing" variant="primary" size="sm">
                <Send className="h-3.5 w-3.5" />
                Open Dispatch
              </Button>
            }
          />
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
            <div className="space-y-2 lg:sticky lg:top-20">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
                <Input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Find a post…"
                  aria-label="Filter posts"
                  className="pl-8"
                />
              </div>
              <div className="space-y-1.5 lg:max-h-[68vh] lg:overflow-y-auto lg:pr-1">
                {visiblePosts.length === 0 ? (
                  <p className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-[11px] text-[var(--muted)]">
                    No post matches “{query}”.
                  </p>
                ) : (
                  visiblePosts.map(post => (
                    <PostRow
                      key={idOf(post)}
                      post={post}
                      active={idOf(post) === activeId}
                      onSelect={() => setActiveId(idOf(post))}
                    />
                  ))
                )}
              </div>
            </div>

            <Section
              title={activePost ? `${formatPlatform(activePost.platform)} thread` : 'Thread'}
              description={threads?.length ? `${threads.length} top-level · ${countNodes(threads)} total` : undefined}
            >
              {!threads ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
                </div>
              ) : threads.length === 0 ? (
                <EmptyState
                  icon={InboxIcon}
                  title="No comments on this post"
                  description="Sync pulls the latest from the platform. An empty thread after a sync means the API returned nothing."
                  action={
                    <Button variant="secondary" size="sm" onClick={syncComments} disabled={busy}>
                      <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
                      Sync comments
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {threads.map(comment => (
                      <CommentNode
                        key={idOf(comment)}
                        comment={comment}
                        depth={0}
                        replyTo={replyTo}
                        replyText={replyText}
                        busy={busy}
                        onStartReply={id => { setReplyTo(id); setReplyText(''); }}
                        onCancelReply={() => { setReplyTo(null); setReplyText(''); }}
                        onChangeReply={setReplyText}
                        onSend={sendReply}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </Section>
          </div>
        )}
      </Page>
    </AppShell>
  );
}
