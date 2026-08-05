# CreatorOps OS

CreatorOps OS is a creator operations workspace for campaign planning, AI-assisted content variants, final creator review, real connected-account publishing, analytics, comments, brand circulars, applications, notifications, and workflow visibility.

The app is built as a production-shaped modular monolith: one Next.js client, one Express API, MongoDB/Mongoose persistence, Socket.IO realtime updates, encrypted platform credentials, and official provider connectors. It does not fake connected accounts, platform posts, metrics, comments, or replies.

## What It Does

- Plan creator campaigns and content ideas.
- Generate and refine platform-specific variants with AI or a local template fallback.
- Review variants through the Creator Review workflow before publishing.
- Connect official platform accounts through OAuth/API credential flows.
- Select media locally, then upload only when publishing or scheduling.
- Upload media through resumable cloud-backed sessions with pause, resume, cancel, reload recovery, and SHA-256 verification.
- Create grouped cross-platform dispatches with one `postGroupId` and separate per-platform jobs.
- Publish/schedule through official provider APIs and keep honest failed/blocked/unavailable states.
- Track live cloud upload, provider upload, compression, publishing, retry, expiry, and deletion status.
- Sync real platform analytics/comments where provider APIs and scopes allow.
- Reply to supported social comments from the same connected account.
- Let brands create circulars and review creator applications.
- Let admins manage account roles and server publishing settings.

## Current Role Model

Users have a `roles` array. It can contain any combination of:

- `content_creator`
- `brand_rep`
- `admin`

Examples: creator only, brand only, admin only, creator + admin, brand + admin, creator + brand, or all three.

`role` still exists as a compatibility/display field, but new authorization should use `roles`.

Role behavior:

- Content Creator: campaigns, content ideas, AI variants, Creator Review, compose, accounts, publishing, analytics, replies, applications, notifications, calendar.
- Brand Representative: brand circulars, applications, accounts, compose, publishing, analytics, replies, notifications, calendar.
- Admin: admin panel, account role management, and server settings such as temporary publish-media retention. Admin alone does not imply creator or brand workflow access.

## Demo Accounts

Run the seed script to create these accounts:

| Account | Email | Password | Roles |
| --- | --- | --- | --- |
| Demo Content Creator | `creator@creatorops.dev` | `password123` | `content_creator` |
| Demo Brand Rep | `brand@creatorops.dev` | `password123` | `brand_rep` |
| Demo Admin | `admin@creatorops.dev` | `password123` | `admin` |
| Demo Creator Admin | `creator.admin@creatorops.dev` | `password123` | `content_creator`, `admin` |
| Demo Brand Admin | `brand.admin@creatorops.dev` | `password123` | `brand_rep`, `admin` |

The seed does not create fake platform connections.

## Architecture

```text
Browser
  |
  | Next.js App Router client
  | React, Tailwind CSS, lucide-react, socket.io-client
  |
Express API
  |
  | routes -> controllers -> services -> models
  | JWT auth, role middleware, Socket.IO, publishing worker
  |
MongoDB
  |
  | Mongoose models for users, workflow, publishing, media, social data
  |
Cloud object storage
  |
  | Cloudflare R2 or another S3-compatible bucket
  | multipart resumable uploads, signed URLs, temporary derivatives
  |
Official provider APIs
  |
  | YouTube, Meta, X, Pinterest, WordPress, Shopify, etc.
```

Important source folders:

```text
client/src/app/              Next.js routes and pages
client/src/components/       UI components
client/src/lib/              API, auth, socket, roles, platforms, uploads
server/src/app.js            Express app and route registration
server/src/server.js         HTTP server, DB, Socket.IO, worker startup
server/src/config/           env and database config
server/src/constants/        roles and platform constants
server/src/controllers/      HTTP handlers
server/src/middleware/       auth, roles, errors
server/src/models/           Mongoose schemas
server/src/platforms/        official provider connectors
server/src/routes/           API route modules
server/src/services/         domain logic
server/src/sockets/          Socket.IO setup
server/src/workers/          in-process publishing worker
```

## Media And Publishing Flow

1. In Compose, selected images/videos are local preview only. Nothing is uploaded when a user merely selects media.
2. On Publish Now or Schedule Later, the browser stores the original file in IndexedDB for recovery and starts `/api/media/resumable/start`.
3. The server creates an object-storage multipart upload and stores session metadata in `MediaUploadSession`.
4. The browser sends chunks with `Content-Range`; the server commits each chunk as a cloud multipart part and persists verified byte offsets.
5. Pause, resume, cancel, refresh, browser close, and server restart recovery use the saved session and local pending-upload record.
6. After all bytes arrive, the server completes the cloud object upload, streams the object back, verifies SHA-256, and creates a `MediaAsset`.
7. If SHA-256 does not match, the server immediately deletes the corrupted cloud object and does not create a `MediaAsset`.
8. Temporary publish media uses `storageIntent: temporary_publish` and `cleanupGroupId: postGroupId`.
9. Compose creates one `postGroupId` for the cross-platform post and creates separate `PublishJob` records for each selected platform/account.
10. Each platform job has its own caption, media processing decision, status, errors, progress, retry/cancel/pause controls, and provider result.
11. The publishing worker locks queued jobs, validates connector capability, prepares media from cloud storage, and calls the official provider API.
12. Successful platform responses create `PublishedPost` records with provider IDs/URLs/raw responses.
13. Dispatch and Analytics group related platform lanes by `postGroupId`.
14. Temporary media is deleted when every lane succeeds or when no retry path remains.
15. Failed or blocked retryable groups keep temporary media until the admin-configured retention expires. Default retention is 7 days.

There is no one-shot `/api/media/upload` route and no normal `/uploads` media directory in the active flow.

## Cloud Storage

Media storage is configured as `MEDIA_STORAGE_PROVIDER=s3` because Cloudflare R2 speaks the S3-compatible API. The app uses the AWS S3 client against the R2 endpoint.

Required server media variables:

```env
MEDIA_STORAGE_PROVIDER=s3
MEDIA_S3_ENDPOINT=https://<cloudflare-account-id>.r2.cloudflarestorage.com
MEDIA_S3_REGION=auto
MEDIA_S3_BUCKET=
MEDIA_S3_ACCESS_KEY_ID=
MEDIA_S3_SECRET_ACCESS_KEY=
MEDIA_S3_PUBLIC_BASE_URL=
MEDIA_S3_KEY_PREFIX=creatorops
MEDIA_S3_FORCE_PATH_STYLE=true
```

`MEDIA_UPLOAD_LIMIT_BYTES` is only a fallback request/chunk cap for CreatorOps upload intake. It is not a platform media limit and must not drive platform compression decisions.

## File Size And Compression Rules

Platform media size handling is provider-driven:

- Compose asks `/api/publish/media-plan` for selected platform/account media policy.
- Connectors use provider API discovery, preflight, or provider responses where available.
- If a provider returns an exact max byte size and selected media exceeds it, the user is prompted for that specific platform/account.
- If accepted, the worker creates a temporary platform-specific compressed derivative under the exact provider max.
- Derivatives are stored in cloud object storage only long enough for that individual provider attempt, then deleted.
- If no exact max is available, CreatorOps does not guess a size.

## Realtime Dispatch

Dispatch is live through authenticated Socket.IO with polling as a safety refresh.

Realtime events include:

- `workflow:event`
- `media:upload_session_updated`
- `publishing:job_updated`
- `social:metrics_updated`
- `social:comments_synced`
- `social:reply_created`
- `social:post_deleted`
- `notification:created`
- `notification:read`

Media upload session events are user-scoped. Publishing and social events are workspace-scoped.

## Platform Connectors

Connectors live in `server/src/platforms`.

| Platform | Publish | Media | Analytics | Comments | Replies | Delete |
| --- | --- | --- | --- | --- | --- | --- |
| Facebook | Yes | Yes | Yes | Yes | Yes | Yes |
| Instagram | Yes | Yes | Yes | Yes | Yes | No |
| TikTok | Yes, subject to platform review | Yes | No | No | No | No |
| YouTube | Yes | Yes | Yes | Yes | Yes | Yes |
| YouTube Shorts | Yes | Yes | Yes | Yes | Yes | Yes |
| Threads | Yes | No | Yes | Yes | Yes | No |
| LinkedIn | Yes | No | No | No | No | No |
| X | Yes | Yes | No | No | Yes | Yes |
| Pinterest | Yes | Yes | Yes | No | No | Yes |
| WordPress / Blog | Yes | No | No | Yes | Yes | Yes |
| Shopify | Yes | No | No | No | No | Yes |

Actual behavior still depends on provider credentials, scopes, app review, product access, account type, and provider API availability.

### YouTube Shorts

YouTube Shorts is a separate CreatorOps target, but the public YouTube Data API uses the same `videos.insert` upload path as normal YouTube videos. CreatorOps validates Shorts eligibility by media shape and duration before upload. YouTube Studio may show Shorts in a separate tab, but there is not a separate public Shorts upload endpoint.

## Main Product Areas

### Campaigns And AI

- Campaign creation and tracking.
- Content ideas attached to campaigns.
- Platform variants with captions, hooks, CTAs, hashtags, scores, warnings, suggestions, and provider metadata.
- Gemini/Groq optional AI providers with a JavaScript template fallback.
- Version snapshots for content and review changes.

### Creator Review

The UI should present this as Creator Review or Review Queue. The stable backend route remains `/api/approvals`.

Flow:

```text
Campaign -> content idea -> AI variants -> submit for review -> creator approves/rejects/requests changes -> publish or schedule
```

### Accounts

- Uses `PlatformConnection`.
- Stores delegated credentials server-side only.
- Encrypts tokens/secrets/app passwords/API secrets with AES-256-GCM.
- Returns only safe metadata to the browser.
- Health checks call real provider APIs.
- Disconnect/reconnect/delete states are represented honestly.

The app never asks for social media passwords.

### Compose

- Local media preview before upload.
- Per-platform/account caption customization.
- AI caption customization.
- Visibility selection where relevant.
- Publish now or schedule later.
- Platform media plan prompts before creating jobs.
- Cross-platform publish jobs grouped by `postGroupId`.

### Post Dispatch

- Shows cloud upload intake and provider dispatch lanes.
- Supports live status, progress, byte counts, throughput, pause, resume, cancel, retry, delete, and expiry state.
- Groups lanes by post while preserving per-platform captions, media processing, status, and errors.
- Delete can remove local CreatorOps records only or call provider delete APIs where supported.

### Analytics And Social

- Groups published platform posts by `postGroupId`.
- Syncs metrics/comments from provider APIs when supported.
- Stores `SocialMetricSnapshot`, `SocialComment`, and `SocialReply`.
- Replies use the same connected account that owns the published post.
- Does not fabricate missing metrics.

### Brand Circulars

- Brand reps create and publish circulars.
- Creators apply with profile/stat snapshots.
- Brand reps view applications, profiles, shortlist, reject, or accept.
- Notifications and workflow events are created for major actions.

### Admin Panel

- Admins can list users.
- Admins can assign any combination of `content_creator`, `brand_rep`, and `admin`.
- Admins can update server settings, including temporary publish-media retention seconds.

## API Summary

Health:

- `GET /` redirects to `CLIENT_URL`
- `GET /health`

Auth:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

Admin:

- `GET /api/admin/users`
- `PATCH /api/admin/users/:id/roles`
- `GET /api/admin/settings`
- `PATCH /api/admin/settings`

AI:

- `POST /api/ai/repurpose`
- `POST /api/ai/optimize`
- `POST /api/ai/customize-captions`
- `POST /api/ai/script`

Campaign/content/review:

- `POST /api/campaigns`
- `GET /api/campaigns`
- `GET /api/campaigns/:id`
- `GET /api/campaigns/:id/tracking`
- `GET /api/campaigns/:id/publish-summary`
- `POST /api/content`
- `GET /api/content/campaign/:campaignId`
- `PATCH /api/content/:id`
- `PATCH /api/content/:id/status`
- `GET /api/content/:id/versions`
- `GET /api/content/:id/variants`
- `POST /api/approvals/request`
- `GET /api/approvals/pending`
- `POST /api/approvals/:id/approve`
- `POST /api/approvals/:id/reject`
- `POST /api/approvals/:id/request-changes`

Connections and OAuth:

- `GET /api/platform-connections`
- `GET /api/platform-connections/status`
- `GET /api/platform-connections/capabilities`
- `GET /api/platform-connections/:id`
- `POST /api/platform-connections/:id/disconnect`
- `POST /api/platform-connections/:id/refresh`
- `POST /api/platform-connections/:id/health-check`
- `DELETE /api/platform-connections/:id`
- `GET /api/oauth/:platform/start`
- `GET /api/oauth/:platform/callback`

Media:

- `POST /api/media/resumable/start`
- `GET /api/media/resumable/:sessionId`
- `POST /api/media/resumable/:sessionId/chunk`
- `POST /api/media/resumable/:sessionId/pause`
- `POST /api/media/resumable/:sessionId/resume`
- `DELETE /api/media/resumable/:sessionId`
- `GET /api/media`
- `GET /api/media/:id`
- `PATCH /api/media/:id`
- `DELETE /api/media/:id`

Publish:

- `GET /api/publish/settings`
- `POST /api/publish/media-plan`
- `POST /api/publish/validate`
- `POST /api/publish/now`
- `POST /api/publish/schedule`
- `GET /api/publish/jobs`
- `GET /api/publish/jobs/:id`
- `POST /api/publish/groups/:id/delete`
- `POST /api/publish/jobs/:id/pause`
- `POST /api/publish/jobs/:id/resume`
- `POST /api/publish/jobs/:id/cancel`
- `POST /api/publish/jobs/:id/retry`
- `POST /api/publish/jobs/:id/delete`

Social and analytics:

- `GET /api/social/post-groups`
- `GET /api/social/post-groups/:id`
- `POST /api/social/post-groups/:id/sync`
- `GET /api/social/posts`
- `GET /api/social/posts/:id`
- `POST /api/social/posts/:id/sync`
- `GET /api/social/posts/:id/metrics`
- `GET /api/social/posts/:id/comments`
- `POST /api/social/comments/:id/reply`
- `POST /api/social/replies/:id/reply`
- `GET /api/social/analytics/summary`
- `GET /api/statistics/creator`
- `POST /api/statistics/snapshot`

Brand circulars:

- `POST /api/brand-circulars`
- `GET /api/brand-circulars`
- `GET /api/brand-circulars/:id`
- `PATCH /api/brand-circulars/:id`
- `POST /api/brand-circulars/:id/publish`
- `POST /api/brand-circulars/:id/close`
- `POST /api/brand-circulars/:id/archive`
- `POST /api/brand-circulars/:id/apply`
- `GET /api/brand-circulars/:id/applications`
- `GET /api/applications`
- `POST /api/applications/:id/view-profile`
- `POST /api/applications/:id/shortlist`
- `POST /api/applications/:id/reject`
- `POST /api/applications/:id/accept`

Other:

- `GET /api/brand-profile`
- `POST /api/brand-profile`
- `PATCH /api/brand-profile`
- `GET /api/platform-formats`
- `GET /api/platform-formats/:platform`
- `GET /api/calendar/feed`
- `GET /api/notifications`
- `POST /api/notifications/:id/read`
- `GET /api/events`
- `GET /api/scripts`
- `GET /api/scripts/:id`
- `POST /api/scripts/:id/convert-to-content`
- `GET /api/users/profile/:id`
- `PUT /api/users/profile`
- `POST /api/users/:id/reviews`

## Environment

Create `server/.env` from `server/.env.example`.

Minimum practical server values:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/creatorops_os
JWT_SECRET=replace_with_long_random_secret
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
CLIENT_URLS=http://localhost:3000,http://127.0.0.1:3000
PUBLIC_BASE_URL=http://localhost:5000
NODE_ENV=development
ENCRYPTION_KEY=replace_with_64_hex_or_long_secret

MEDIA_STORAGE_PROVIDER=s3
MEDIA_S3_ENDPOINT=https://<cloudflare-account-id>.r2.cloudflarestorage.com
MEDIA_S3_REGION=auto
MEDIA_S3_BUCKET=
MEDIA_S3_ACCESS_KEY_ID=
MEDIA_S3_SECRET_ACCESS_KEY=
MEDIA_S3_PUBLIC_BASE_URL=
MEDIA_S3_KEY_PREFIX=creatorops
MEDIA_S3_FORCE_PATH_STYLE=true
```

Optional AI:

```env
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash
GROQ_API_KEY=
AI_PROVIDER=auto
AI_FALLBACK=template
AI_TIMEOUT_MS=8000
```

Optional provider credentials are listed in `server/.env.example`.

Create `client/.env` from `client/.env.example`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

Do not commit `.env` files.

## Local Setup

Install dependencies:

```powershell
cd server
npm install

cd ../client
npm install
```

Create env files:

```powershell
copy server\.env.example server\.env
copy client\.env.example client\.env
```

Start MongoDB locally or use Atlas through `MONGO_URI`.

Seed demo data:

```powershell
cd server
npm run seed
```

Start the API:

```powershell
cd server
npm run dev
```

Start the client:

```powershell
cd client
npm run dev
```

Default URLs:

- Client: `http://localhost:3000`
- API: `http://localhost:5000`
- Health check: `http://localhost:5000/health`

## Deploying

The client and the API deploy to different places. Vercel can host the Next.js
client; it cannot host the API, which is a long-lived Express process with a
Socket.IO server, a `setInterval` publishing worker and a MongoDB connection.
Put the API on a host that runs a persistent Node process (Render, Railway, Fly,
a VM) with a MongoDB Atlas URI, then point the client at it.

### Client (Vercel)

Set **Root Directory** to `client` in the project settings, then add environment
variables. `client/.env` is gitignored and never reaches the host, so a build
made without these has no API to talk to.

Pick one wiring option:

| | Variable | Notes |
|---|---|---|
| **A — proxy (recommended)** | `API_ORIGIN=https://your-api-host` | Browser calls the site's own origin; `next.config.mjs` forwards `/api/*`. No CORS setup, no mixed content, read at runtime. |
| **B — direct** | `NEXT_PUBLIC_API_URL=https://your-api-host` | Browser calls the API host directly. Must be HTTPS, and the API's `CLIENT_URL` / `CLIENT_URLS` must list the site's origin. |

`NEXT_PUBLIC_*` values are inlined at **build** time — changing one in the
dashboard does nothing until you redeploy.

Realtime is optional. Socket.IO needs a direct long-lived connection, so it
cannot use the proxy and will not work against a serverless host. Leave
`NEXT_PUBLIC_SOCKET_URL` unset unless the API supports WebSockets; every live
view falls back to polling on its own.

### API

Set at minimum `MONGO_URI`, `JWT_SECRET`, `ENCRYPTION_KEY`, and `CLIENT_URL` /
`CLIENT_URLS` (the deployed client origin — needed for CORS under option B and
for the OAuth callback redirect either way). See `server/.env.example`.

## Verification

Useful checks:

```powershell
cd client
npm run build
```

```powershell
cd ..
$files = Get-ChildItem -Path server/src -Recurse -Filter *.js | Select-Object -ExpandProperty FullName
foreach ($file in $files) { node --check $file; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
```

```powershell
node -e "import('./server/src/app.js').then(()=>console.log('server import ok'))"
git diff --check
```

## Demo Walkthrough

Creator:

1. Login as `creator@creatorops.dev`.
2. Create a campaign.
3. Add a content idea.
4. Generate platform variants.
5. Submit one for Creator Review.
6. Approve or request changes.
7. Connect real platform accounts if credentials are configured.
8. Open Compose, select media, customize captions, choose platforms, and publish or schedule.
9. Watch Post Dispatch for cloud upload, provider upload, processing, errors, retry, delete, or publish state.
10. Open Analytics to sync metrics/comments and reply where supported.

Brand:

1. Login as `brand@creatorops.dev`.
2. Create and publish a brand circular.
3. Review creator applications.
4. View creator profiles and accept, reject, or shortlist.

Admin:

1. Login as `admin@creatorops.dev`.
2. Open Admin.
3. Manage account role combinations.
4. Adjust temporary publish-media retention seconds.

## Security And Data Rules

- Social passwords are never collected.
- Provider tokens/secrets are encrypted at rest and hidden from API responses.
- OAuth state is random, short-lived, user-bound, workspace-bound, and platform-bound.
- Backend services enforce workspace scoping.
- Frontend role visibility is not the security boundary.
- Official provider success is required before a job becomes published.
- Provider POST failures are not automatically replayed because replaying can duplicate posts.
- Large temporary media is deleted from cloud storage after success or when retry is no longer possible.
- Browser IndexedDB stores the user's original file only for resumable recovery, and it is cleared after completion or cancel.

## Known Limits

- Provider features depend on official credentials, scopes, app review, API access, and account permissions.
- The publishing worker is currently in-process. A production scale-out path would move it to a durable queue such as BullMQ/Redis.
- Some providers do not support delete, analytics, comments, replies, or media upload through the current connector.
- TikTok publishing can require Content Posting API approval.
- YouTube Shorts classification is controlled by YouTube based on uploaded video eligibility.
- Analytics are stored as snapshots, not a full warehouse.

## Project Principles

- Read code before changing behavior.
- Keep active publishing on `PlatformConnection`, `MediaUploadSession`, `MediaAsset`, `PublishJob`, and `PublishedPost`.
- Keep `postGroupId` as the cross-platform identity.
- Keep per-platform captions/status/media processing separate inside each job lane.
- Keep platform outcomes honest.
- Do not reintroduce `/api/media/upload`, normal `/uploads`, fake social data, or hardcoded platform media-size constants.
