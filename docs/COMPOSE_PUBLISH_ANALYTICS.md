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
When media is uploaded to CreatorOps, it uses the generic resumable media API rather than a one-shot multipart upload. Each image/video has its own upload session, pause/resume/cancel controls, browser-local recovery state, and server-side SHA-256 verification before a `MediaAsset` is created. In Cloudflare R2/S3 mode, every resumable chunk is stored as an object-storage multipart part and the session keeps the upload id, part ETags, and byte ranges so reloads and server restarts resume from the last accepted byte. Provider uploads, metadata reads, and per-platform compression read from cloud object streams or signed object URLs; compressed derivatives are written back to cloud and deleted after that platform attempt. User-paused uploads stay paused across refresh/login until Resume is clicked; accidental browser, network, or temporary server interruptions auto-resume from the last verified byte when the client/server are available. If final SHA-256 does not match the original file, the server deletes the corrupted object immediately and the client asks whether to retry from the beginning.

## Publishing

Publishing uses:

- `POST /api/publish/validate`
- `POST /api/publish/now`
- `POST /api/publish/schedule`
- `GET /api/publish/jobs`
- `POST /api/publish/jobs/:id/pause`
- `POST /api/publish/jobs/:id/resume`
- `POST /api/publish/jobs/:id/cancel`

Cross-platform posts are linked by `postGroupId`. Compose creates one group id when the user clicks publish or schedule, uploads temporary media with that cleanup group id, then creates one `PublishJob` per selected platform using the same `postGroupId` and `groupTargetCount`. Successful `PublishedPost` records copy the same id, so Dispatch, Analytics, Social, Calendar, and cleanup can all identify which platform records belong to the same original post.

`postGroupId` is only the grouping key. Dispatch summaries should not present one caption or media preview as shared content for the whole group; captions, media references, processing decisions, live status, errors, and actions are per `PublishJob` so platform-specific optimizations remain visible.

Jobs are processed by the backend worker. They can be queued, publishing, paused, published, failed, blocked, or cancelled.

`published` is only set after an official connector returns success.

Pause and cancel controls are per publish job. Queued jobs change immediately. Publishing jobs receive a control request and stop at the next safe checkpoint; resumable YouTube uploads check between chunks. Provider requests already accepted by an external API cannot be undone, so cancelled in-flight jobs should be checked on the platform before creating a replacement post.

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

Content Creator and Brand Representative users can reply through connected accounts they manage in the workspace.
