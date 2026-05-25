# Compose, Publish, Analytics

## Compose

The Compose page supports:

- original media upload
- text-only status/caption
- 9:16 default preview
- 1:1, 4:5, 16:9, and original preview modes
- crop preview metadata
- account selection from real connected accounts
- AI caption customization per selected account
- video visibility selection: public, private, friends only

Original media is not recompressed or reduced in quality.

## Publishing

Publishing uses:

- `POST /api/publish/validate`
- `POST /api/publish/now`
- `POST /api/publish/schedule`
- `GET /api/publish/jobs`

Jobs are processed by the backend worker. They can be queued, publishing, published, failed, blocked, or cancelled.

`published` is only set after an official connector returns success.

Visibility is saved on `PublishJob` and `PublishedPost`. Unsupported visibility values are blocked before publishing. The current YouTube connector maps `public` and `private` to official YouTube privacy status values; unsupported `friends_only` is not pretended.

## Analytics And Comments

Analytics and comments are synced from official APIs only:

- `POST /api/social/posts/:id/sync`
- `GET /api/social/posts/:id/metrics`
- `GET /api/social/posts/:id/comments`

If a connector lacks support, scope, credentials, or app review, the API returns an unavailable/blocked reason.

YouTube comment sync stores both top-level comments and real provider replies. Top-level comments come from `commentThreads.list`; replies under a top-level comment are fetched with `comments.list` using the top-level comment id as `parentId`.

## Replies

Replies use the same `PlatformConnection` that published the post:

- `POST /api/social/comments/:id/reply`

Editors cannot reply; Creator/Admin is required.
