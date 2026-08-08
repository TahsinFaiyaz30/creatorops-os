'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Thumbnails for a list of published posts.
 *
 * Local media is deleted once a post ships, so every list screen — Post Status,
 * Analytics, Posts, Inbox, Media — was drawing a grey placeholder for content
 * that still exists on the platform that published it. This asks the server for
 * one still per post, in a single request per page rather than one per row.
 *
 * The returned map is keyed by post id and holds only what a tile needs.
 * Nothing is stored: the server borrows these from the platforms behind a short
 * in-process cache, and the URLs expire.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from 'react';

import { api } from './api';

/**
 * @param {string[]} postIds ids of published posts currently on screen
 * @returns {{ thumbnails: Record<string, {thumbnailUrl: string, kind: string, platform: string, unavailableReason: string}>, loading: boolean }}
 */
export function usePostThumbnails(postIds) {
  const [thumbnails, setThumbnails] = useState({});
  const [loading, setLoading] = useState(false);

  /*
   * Keyed on the joined ids rather than the array: a new array identity on every
   * render would refetch forever, and callers build these lists inline.
   */
  const key = (postIds || []).filter(Boolean).map(String).sort().join(',');

  useEffect(() => {
    if (!key) {
      setThumbnails({});
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    api
      .post('/api/social/post-thumbnails', { postIds: key.split(',') })
      .then(payload => {
        if (cancelled) return;
        const next = {};
        for (const entry of payload?.data?.thumbnails || []) {
          next[entry.postId] = entry;
        }
        setThumbnails(next);
      })
      /* A screen that cannot reach the platforms still renders — it just keeps
         the placeholder it had before. */
      .catch(() => {
        if (!cancelled) setThumbnails({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  return { thumbnails, loading };
}
