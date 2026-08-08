/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Borrowed media.
 *
 * This workspace deletes its own copy of a file once the post carrying it has
 * shipped — that is the storage model, deliberately. The cost was that every
 * screen afterwards had nothing to show: Post Status, Analytics, Media, Posts
 * and Inbox all fell back to a grey placeholder for content that is sitting
 * perfectly intact on Facebook, YouTube, Instagram and the rest.
 *
 * A published post already records which platform hosts it and under what id.
 * That is enough to ask the platform for the picture back at the moment someone
 * looks at it.
 *
 * Two rules hold this together:
 *
 *   1. Nothing is persisted. Not to disk, not to the database. The URLs belong
 *      to the platform and most of them are signed and expire within hours;
 *      storing them would recreate the storage problem and serve dead links
 *      besides. The cache below is in-process and time-boxed.
 *
 *   2. One post's media is one lookup. A post published to five platforms is
 *      five independent lookups that each may succeed or fail on their own —
 *      a locked-down TikTok account must not stop the Instagram copy rendering.
 *      Failures come back as a reason string, never as a thrown error, so one
 *      dead platform degrades a carousel slide rather than a whole screen.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import PublishedPost from '../models/PublishedPost.js';
import PublishJob from '../models/PublishJob.js';
import MediaAsset from '../models/MediaAsset.js';
import PlatformConnection from '../models/PlatformConnection.js';
import { getConnector } from '../platforms/connectorRegistry.js';

/*
 * Short by design. Long enough that opening a modal, flicking through the
 * carousel and going back does not re-hit five platform APIs; short enough that
 * signed URLs inside it have not expired by the time they are used.
 */
const CACHE_TTL_MS = 8 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;

const cache = new Map();

const cacheGet = key => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  /* Refresh recency so the eviction below drops genuinely cold entries. */
  cache.delete(key);
  cache.set(key, entry);
  return entry.value;
};

const cacheSet = (key, value) => {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  /* Bounded: this map lives for the life of the process, and an unbounded one
     would be a slow leak on a long-running server. */
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
};

export const clearPostMediaCache = () => cache.clear();

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * Fallback: the public post URL.
 *
 * The connector API is always tried first and is always preferred — it is
 * authenticated, it returns the real file for most platforms, and it works for
 * private and unlisted posts. But it can come back empty for reasons that have
 * nothing to do with the post existing: a scope the account was never granted,
 * a token that expired, a connector this app has not implemented (LinkedIn,
 * WordPress, Shopify).
 *
 * When the post is public, the platform will still describe it to anyone who
 * asks by URL. oEmbed is that request: no auth, no app token, and it returns a
 * thumbnail. It is strictly a second attempt — a still, never the file — so it
 * fills the gap rather than replacing the API path.
 *
 * Only endpoints that work without an app token are listed. Facebook and Instagram
 * oEmbed now require one, so they are deliberately absent: a call that always
 * 403s is worse than no call.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const OEMBED_ENDPOINTS = {
  youtube: 'https://www.youtube.com/oembed?format=json&url=',
  youtube_shorts: 'https://www.youtube.com/oembed?format=json&url=',
  tiktok: 'https://www.tiktok.com/oembed?url=',
  pinterest: 'https://www.pinterest.com/oembed.json?url='
};

const OEMBED_TIMEOUT_MS = 6000;

const fetchPublicOEmbed = async ({ platform, permalink }) => {
  const endpoint = OEMBED_ENDPOINTS[platform];
  if (!endpoint || !permalink) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OEMBED_TIMEOUT_MS);
  try {
    const response = await fetch(`${endpoint}${encodeURIComponent(permalink)}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) return null;
    const payload = await response.json();
    if (!payload?.thumbnail_url) return null;

    return {
      kind: 'video',
      /* A still only — oEmbed never exposes the file. The permalink is what
         plays it, and the viewer already links there. */
      embed: false,
      url: '',
      thumbnailUrl: payload.thumbnail_url,
      width: payload.thumbnail_width || null,
      height: payload.thumbnail_height || null,
      durationSeconds: null
    };
  } catch (_error) {
    /* Aborted, offline, or the post is not public. Either way there is nothing
       to add, and the API's own reason is the more useful one to show. */
    return null;
  } finally {
    clearTimeout(timer);
  }
};

const idOf = value => String(value?._id || value || '');

/** The shape every screen consumes, whether the lookup worked or not. */
const slide = ({ post, items = [], unavailableReason = '' }) => ({
  postId: idOf(post),
  platform: post.platform,
  accountName: post.accountSnapshot?.accountName || '',
  accountHandle: post.accountSnapshot?.accountHandle || '',
  permalink: post.providerPostUrl || '',
  publishedAt: post.publishedAt || post.createdAt || null,
  caption: post.caption || '',
  items,
  unavailableReason
});

/**
 * Media for a single published post, asked of the platform hosting it.
 *
 * Never throws for a platform-side problem — an account whose token expired,
 * a post since deleted, or a connector with no read scope all come back as a
 * populated `unavailableReason` so the caller can say why the slide is blank.
 */
export const resolvePostMedia = async post => {
  if (!post) return null;

  const postId = idOf(post);
  const cached = cacheGet(postId);
  if (cached) return cached;

  if (post.status !== 'published' || !post.providerPostId) {
    return slide({
      post,
      unavailableReason: 'This post has not shipped yet, so the platform has nothing to show.'
    });
  }

  const connection = await PlatformConnection.findById(post.platformConnectionId).select(
    '+encryptedAccessToken +encryptedRefreshToken +encryptedApiSecret +encryptedAppPassword'
  );

  if (!connection) {
    return slide({ post, unavailableReason: 'The account this went out on is no longer connected.' });
  }

  const connector = getConnector(post.platform);
  if (!connector) {
    return slide({ post, unavailableReason: `No connector is registered for ${post.platform}.` });
  }

  let result;
  try {
    result = await connector.fetchPostMedia(connection, post.providerPostId);
  } catch (error) {
    /* A connector that throws is a bug in the connector, not a reason to fail
       the whole screen — surface it on the slide and carry on. */
    return slide({ post, unavailableReason: error.message || 'The platform lookup failed.' });
  }

  let resolved = result?.ok
    ? slide({ post, items: result.data?.items || [] })
    : slide({ post, unavailableReason: result?.message || 'The platform returned no media for this post.' });

  /*
   * The API is the primary source and has already had its turn. Only if it
   * produced nothing do we ask the public web what this post looks like — and
   * only for a public post, which is the sole case oEmbed answers.
   */
  if (resolved.items.length === 0) {
    const fromLink = await fetchPublicOEmbed({ platform: post.platform, permalink: post.providerPostUrl });
    if (fromLink) {
      resolved = slide({
        post,
        items: [fromLink],
        /* Say where it came from: a still borrowed from the public page is not
           the same promise as the file the API would have returned. */
        unavailableReason: ''
      });
      resolved.source = 'public-link';
    }
  } else {
    resolved.source = 'api';
  }

  /* Only successful lookups are cached. Caching a failure would keep a
     just-reconnected account looking broken for the rest of the TTL. */
  if (resolved.items.length > 0) cacheSet(postId, resolved);
  return resolved;
};

/*
 * Scoped to the active workspace, exactly as every other read in
 * social.service is. `auth.middleware` has already resolved user.workspaceId to
 * whichever team the request is acting in, so this needs no team logic of its
 * own — and picking a different rule here would quietly open a hole the rest of
 * the post surface does not have.
 */
const findPostForUser = async ({ user, postId }) =>
  PublishedPost.findOne({ _id: postId, workspaceId: user.workspaceId });

export const getPostMedia = async ({ user, postId }) => {
  const post = await findPostForUser({ user, postId });
  if (!post) {
    const error = new Error('Published post not found.');
    error.statusCode = 404;
    throw error;
  }
  return resolvePostMedia(post);
};

/**
 * The same media as it appears everywhere it was published.
 *
 * One idea goes out to several platforms as several PublishedPosts sharing a
 * `postGroupId`. That group is what the viewer's carousel steps through, so a
 * dead YouTube slide still leaves the Instagram one to look at.
 */
export const getPostGroupMedia = async ({ user, groupId }) => {
  const conditions = [{ postGroupId: groupId }];
  if (/^[a-f\d]{24}$/i.test(groupId)) {
    conditions.push({ _id: groupId }, { publishJobId: groupId });
  }

  const posts = await PublishedPost.find({
    workspaceId: user.workspaceId,
    $or: conditions
  }).sort({ publishedAt: 1, createdAt: 1 });

  if (posts.length === 0) {
    const error = new Error('No published posts found for this group.');
    error.statusCode = 404;
    throw error;
  }

  /* In parallel: five platforms answering one after another would make opening
     the viewer feel broken. Each settles independently. */
  const slides = await Promise.all(posts.map(post => resolvePostMedia(post)));

  return {
    groupId,
    slides,
    /* So the client can say "nothing could be fetched" once, rather than
       repeating the same failure on every slide. */
    anyAvailable: slides.some(entry => entry.items.length > 0)
  };
};

/**
 * The same file, everywhere it was published.
 *
 * The Media library is a list of assets, not posts — and after publishing, the
 * asset is the one thing still in the database when the file itself is gone.
 * A single asset can appear in several posts across several platforms, which is
 * exactly the carousel the viewer wants, so this walks from the asset to the
 * posts that carried it.
 */
export const getMediaAssetPosts = async ({ user, mediaAssetId }) => {
  const asset = await MediaAsset.findOne({ _id: mediaAssetId, workspaceId: user.workspaceId }).select('+objectKey');
  if (!asset) {
    const error = new Error('Media asset not found.');
    error.statusCode = 404;
    throw error;
  }

  /*
   * Every id this file is known by, not just its own.
   *
   * Publishing uploads a `temporary_publish` copy of the asset rather than
   * sending the library row, so the post records the copy's id and the library
   * id appears nowhere on it. Same bytes, same sha256 — that hash is the only
   * durable link between the two, so siblings sharing it count as this file.
   */
  const siblingIds = asset.sha256
    ? (
        await MediaAsset.find({ workspaceId: user.workspaceId, sha256: asset.sha256 }).select('_id')
      ).map(row => row._id)
    : [];
  const assetIds = [asset._id, ...siblingIds];

  const jobs = await PublishJob.find({
    workspaceId: user.workspaceId,
    mediaAssetIds: { $in: assetIds }
  }).select('_id');

  const posts = await PublishedPost.find({
    workspaceId: user.workspaceId,
    $or: [{ mediaAssetIds: { $in: assetIds } }, { publishJobId: { $in: jobs.map(job => job._id) } }]
  }).sort({ publishedAt: 1, createdAt: 1 });

  /* Platforms only. After publishing there is no copy here to fall back on —
     the database knows where the file went, and that is the whole source. */
  const slides = await Promise.all(posts.map(post => resolvePostMedia(post)));

  if (slides.length === 0) {
    const error = new Error(
      'No published post in this workspace references this file, so there is no platform to fetch it from.'
    );
    error.statusCode = 404;
    throw error;
  }

  return { groupId: '', slides, anyAvailable: slides.some(entry => entry.items.length > 0) };
};

/**
 * Thumbnails for a page of posts, in one call.
 *
 * The list screens need one still each, not a whole carousel. Capped because
 * each miss is a live API round-trip and a long feed would otherwise fan out
 * into dozens of them on first paint.
 */
export const getPostThumbnails = async ({ user, postIds = [] }) => {
  const ids = [...new Set(postIds.map(String).filter(id => /^[a-f\d]{24}$/i.test(id)))].slice(0, 40);
  if (ids.length === 0) return { thumbnails: [] };

  const posts = await PublishedPost.find({
    _id: { $in: ids },
    workspaceId: user.workspaceId
  });

  const slides = await Promise.all(posts.map(post => resolvePostMedia(post)));

  return {
    thumbnails: slides.map(entry => {
      const first = entry.items.find(item => item.thumbnailUrl || item.url) || null;
      return {
        postId: entry.postId,
        platform: entry.platform,
        thumbnailUrl: first?.thumbnailUrl || (first?.kind === 'image' ? first.url : '') || '',
        kind: first?.kind || '',
        unavailableReason: entry.unavailableReason
      };
    })
  };
};
