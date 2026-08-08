'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Post media viewer.
 *
 * The workspace deletes its own copy of a file once the post carrying it has
 * shipped, so there is nothing local left to show. The platforms still have it,
 * and this fetches it back on open — see server/src/services/postMedia.service.js.
 * Nothing is downloaded or cached here beyond the life of the modal.
 *
 * One idea usually goes out to several platforms, so the viewer is a carousel
 * over those platforms: the same post as Instagram has it, as YouTube has it,
 * as Facebook has it. Each slide is fetched independently, so an account with
 * an expired token costs you that one slide and no more.
 *
 * Three ways a slide renders, because the platforms genuinely differ:
 *   · a real file URL          → <img> / <video>, played inline
 *   · an embed-only platform   → <iframe> (YouTube, TikTok never serve the file)
 *   · nothing readable         → the reason, and a link out to the post
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronLeft, ChevronRight, ExternalLink, ImageOff, Loader2, X
} from 'lucide-react';

import { api } from '../../lib/api';
import { formatPlatform } from '../../lib/platforms';

const EASE = [0.16, 1, 0.3, 1];

function SlideBody({ slide }) {
  const item = slide?.items?.[0];

  if (!item) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <ImageOff className="h-8 w-8 text-[var(--muted)]" />
        <p className="text-sm font-semibold text-[var(--text)]">Nothing to show from {formatPlatform(slide.platform)}</p>
        <p className="max-w-md text-xs leading-relaxed text-[var(--muted)]">
          {slide.unavailableReason || 'This platform returned no media for the post.'}
        </p>
        {slide.permalink ? (
          <a
            href={slide.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring mt-1 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-2)] transition-colors hover:border-[var(--accent-line)] hover:text-[var(--accent)]"
          >
            Open on {formatPlatform(slide.platform)}
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>
    );
  }

  /* YouTube and TikTok never hand over the file — only a player. */
  if (item.embed && item.url) {
    return (
      <iframe
        src={item.url}
        title={`${formatPlatform(slide.platform)} post`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="h-full w-full border-0"
      />
    );
  }

  if (item.kind === 'video' && item.url) {
    return (
      <video
        src={item.url}
        poster={item.thumbnailUrl || undefined}
        controls
        playsInline
        className="h-full w-full bg-black object-contain"
      />
    );
  }

  const src = item.url || item.thumbnailUrl;
  return src ? (
    <img src={src} alt={slide.caption || 'Post media'} className="h-full w-full bg-black object-contain" />
  ) : null;
}

export default function PostMediaViewer({
  open,
  onClose,
  groupId = '',
  postId = '',
  /* A library asset: the viewer walks from the file to every post that used it. */
  mediaAssetId = '',
  title = ''
}) {
  const [slides, setSlides] = useState(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    setSlides(null);
    setError('');
    setIndex(0);

    /*
      Three ways in, one slide shape out: a library asset resolves to every post
      that carried it, a group id to every platform one idea went to, and a bare
      post id to just that post.
    */
    const multi = Boolean(mediaAssetId || groupId);
    const request = mediaAssetId
      ? api.get(`/api/social/media-assets/${mediaAssetId}/posts`)
      : groupId
        ? api.get(`/api/social/post-groups/${groupId}/media`)
        : api.get(`/api/social/posts/${postId}/media`);

    request
      .then(payload => {
        if (cancelled) return;
        const media = payload?.data?.media;
        setSlides(multi ? media?.slides || [] : [media].filter(Boolean));
      })
      .catch(err => {
        if (!cancelled) setError(err.message || 'Could not load this post from its platforms.');
      });

    return () => {
      cancelled = true;
    };
  }, [open, groupId, postId, mediaAssetId]);

  const count = slides?.length || 0;
  const step = useCallback(
    delta => setIndex(current => (count ? (current + delta + count) % count : 0)),
    [count]
  );

  useEffect(() => {
    if (!open) return undefined;
    const onKey = event => {
      if (event.key === 'Escape') onClose?.();
      if (event.key === 'ArrowRight') step(1);
      if (event.key === 'ArrowLeft') step(-1);
    };
    document.addEventListener('keydown', onKey);
    /* The page behind must not scroll while a full-screen viewer is open. */
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose, step]);

  if (typeof document === 'undefined') return null;

  const slide = slides?.[index] || null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          role="dialog"
          aria-modal="true"
          aria-label={title || 'Post media'}
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={event => {
            if (event.target === event.currentTarget) onClose?.();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.24, ease: EASE }}
            className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]"
          >
            <header className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold tracking-tight text-[var(--text)]">
                  {slide ? formatPlatform(slide.platform) : title || 'Post media'}
                </p>
                {slide?.accountHandle || slide?.accountName ? (
                  <p className="truncate text-[11px] text-[var(--muted)]">
                    {slide.accountHandle || slide.accountName}
                  </p>
                ) : null}
              </div>

              {count > 1 ? (
                <span className="shrink-0 rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] tabular-nums text-[var(--muted)]">
                  {index + 1} / {count}
                </span>
              ) : null}

              {slide?.permalink ? (
                <a
                  href={slide.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open on ${formatPlatform(slide.platform)}`}
                  className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface2)] hover:text-[var(--text)]"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}

              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface2)] hover:text-[var(--text)]"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
              {!slides && !error ? (
                <div className="flex flex-col items-center gap-2 py-24 text-[var(--muted)]">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <p className="text-xs">Fetching from the platforms…</p>
                </div>
              ) : null}

              {error ? (
                <p className="max-w-md px-8 py-24 text-center text-sm text-[var(--muted)]">{error}</p>
              ) : null}

              {slides && slides.length === 0 && !error ? (
                <p className="max-w-md px-8 py-24 text-center text-sm text-[var(--muted)]">
                  This post has not shipped to any platform yet, so there is nothing to fetch.
                </p>
              ) : null}

              {slide ? (
                <div className="h-[60vh] w-full">
                  <SlideBody slide={slide} />
                </div>
              ) : null}

              {count > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    aria-label="Previous platform"
                    className="focus-ring absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => step(1)}
                    aria-label="Next platform"
                    className="focus-ring absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              ) : null}
            </div>

            {/* Platform strip — which platforms carry this, and which one you are on. */}
            {count > 1 ? (
              <div className="flex shrink-0 gap-1.5 overflow-x-auto border-t border-[var(--border)] px-3 py-2">
                {slides.map((entry, entryIndex) => (
                  <button
                    key={entry.postId}
                    type="button"
                    onClick={() => setIndex(entryIndex)}
                    aria-current={entryIndex === index ? 'true' : undefined}
                    className={`focus-ring shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      entryIndex === index
                        ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]'
                        : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    {formatPlatform(entry.platform)}
                    {entry.items.length === 0 ? <span className="ml-1 opacity-60">·</span> : null}
                  </button>
                ))}
              </div>
            ) : null}

            {slide?.caption ? (
              <p className="max-h-24 shrink-0 overflow-y-auto border-t border-[var(--border)] px-4 py-2.5 text-xs leading-relaxed text-[var(--text-2)]">
                {slide.caption}
              </p>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
