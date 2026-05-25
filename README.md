# CreatorOps OS

CreatorOps OS is a production-shaped creator operations workspace for moving content from idea to platform-ready execution with AI adaptation, approval, real account connections, real publish jobs, synced social data, and realtime audit events.

## Pitch

Creator teams do not only need captions. They need an operating system for content: one place to plan campaigns, repurpose ideas, enforce brand rules, approve work, target the right connected account, publish only when official platform APIs allow it, and track what happened.

## Core Problem Areas

- Multi-Platform Content Management
- AI-Powered Content Workflow
- Creator Team Collaboration Infrastructure

## What Makes It More Than A Dashboard

CreatorOps OS has backend-enforced RBAC, version snapshots, workflow events, encrypted platform credentials, OAuth state validation, connector capability checks, media upload preservation, publish job processing, and social sync routes. It does not fake external platform data. If credentials, scopes, app review, or API access are missing, the system blocks the action and explains why.

## Key Features

- Campaigns, brand profiles, content ideas, and platform variants
- AI repurposing for Facebook, Instagram, TikTok, YouTube, YouTube Shorts, Threads, LinkedIn, X, Pinterest, WordPress/Blog, and Shopify
- Template AI fallback when Gemini/Groq keys are unavailable
- Editor and Creator/Admin roles with JWT auth
- Approval queue with approve, reject, and request changes
- Draft/version history for content, variants, approvals, and publishing state
- Real platform connection architecture with encrypted tokens/secrets
- Official OAuth/API connector layer with honest unavailable states
- Media upload with original file preservation and 9:16 preview metadata
- Compose page for account-targeted caption customization and publish scheduling
- Real publish jobs that only succeed after official API responses
- Social metrics/comments/replies synced only from official APIs where supported
- Brand representative circulars and creator applications with notifications
- Creator statistics page built from real synced social metrics only
- Script AI conversation for reels, Shorts, UGC ads, outlines, hooks, voiceover, and scenes
- Video visibility controls with backend connector validation
- Floating calendar drawer for scheduled posts, published posts, circular deadlines, applications, campaigns, and workflow milestones
- Socket.IO updates for workflow, publishing, and social sync events
- Public docs for setup, API, architecture, database, security, OAuth, and demo

## Tech Stack

- Frontend: Next.js App Router, React, Tailwind CSS, lucide-react, socket.io-client
- Backend: Express, MongoDB, Mongoose, JWT, bcrypt, multer, Socket.IO
- AI: Gemini optional, Groq optional, JavaScript template fallback required
- Integrations: official platform connector architecture, OAuth/API credential support, encrypted secrets with AES-256-GCM

## Architecture Overview

CreatorOps OS is a modular monolith. The backend is a single Express app with service boundaries for auth, AI, approval, platform connections, media, publishing, social sync, versioning, workflow events, and format rules. It is not pretending to be microservices; it is structured so connectors/workers can be split later when operational load justifies it.

```text
Next.js UI
  -> Express API
    -> MongoDB/Mongoose
    -> JWT/RBAC middleware
    -> AI service with fallback
    -> Platform connector registry
    -> Media service
    -> Publish worker
    -> Social sync service
    -> Workflow events
    -> Socket.IO realtime events
```

## Database Summary

Core operational models:

- `User`, `Workspace`
- `BrandProfile`, `Campaign`, `ContentItem`, `PlatformVariant`
- `ContentVersion`, `ApprovalRequest`, `WorkflowEvent`
- `PlatformConnection`, `OAuthState`
- `PlatformFormatRule`, `MediaAsset`
- `PublishJob`, `PublishedPost`
- `SocialMetricSnapshot`, `SocialComment`, `SocialReply`
- `BrandCircular`, `CircularApplication`
- `CreatorStatisticSnapshot`, `CreatorNotification`, `ScriptConversation`

## Auth And RBAC

Users authenticate with CreatorOps credentials. Social platforms are never connected with platform passwords. Editors can create content and request approval. Creator/Admin users can approve, connect platform accounts, publish/schedule, sync social data, and reply to comments. Backend middleware enforces these rules even if UI buttons are hidden.

## AI Provider And Fallback

AI generation tries Gemini/Groq when configured. If keys are missing, providers fail, time out, rate limit, or return malformed data, the backend returns a valid structured template result. This fallback is allowed for local caption generation; it is not used to fake external publishing, analytics, comments, replies, or social outcomes.

## Real Platform Integrations

Supported platform surfaces:

- Facebook Page
- Instagram professional account
- TikTok creator account
- YouTube channel
- YouTube Shorts through YouTube channel
- Threads account
- LinkedIn profile/page
- X account
- Pinterest account/board
- WordPress/Blog site
- Shopify content

Connections require official OAuth credentials or server-side API credentials. Tokens and application passwords are encrypted at rest with `ENCRYPTION_KEY`. Secrets are never returned to the frontend.

## Publishing Rules

Publishing uses `/api/publish/*` and `PublishJob` records. A job can be:

- `queued`
- `publishing`
- `published`
- `failed`
- `blocked`
- `cancelled`

`published` means an official connector returned a real provider response. If a connector is not configured, lacks permission, requires platform review, or does not support a feature, the job is blocked or failed with a readable reason.

## Realtime Events

Persisted workflow events are emitted as `workflow:event`. Publishing and social sync also emit:

- `publishing:job_updated`
- `social:metrics_updated`
- `social:comments_synced`
- `social:reply_created`

The UI still works through API fetches if Socket.IO is disconnected.

## Setup

Install dependencies:

```powershell
cd server
npm install
cd ../client
npm install
```

Create `server/.env` from `server/.env.example` and set at minimum:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/creatorops_os
JWT_SECRET=replace_with_long_random_secret
CLIENT_URL=http://localhost:3000
PUBLIC_BASE_URL=http://localhost:5000
ENCRYPTION_KEY=replace_with_long_random_secret_or_64_hex_chars
```

Create `client/.env` from `client/.env.example`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

Seed demo CreatorOps users:

```powershell
cd server
npm run seed
```

Run backend:

```powershell
cd server
npm run dev
```

Run frontend:

```powershell
cd client
npm run dev
```

Open `http://localhost:3000`.

## Demo Credentials

Editor:

- `editor@creatorops.dev`
- `password123`

Creator/Admin:

- `admin@creatorops.dev`
- `password123`

Brand Representative:

- `brand@creatorops.dev`
- `password123`

## API Summary

- Auth: `/api/auth/*`
- Brand Profile: `/api/brand-profile`
- Campaigns: `/api/campaigns`
- Content: `/api/content`
- AI: `/api/ai/*`
- Approvals: `/api/approvals/*`
- Platform connections: `/api/platform-connections/*`
- OAuth: `/api/oauth/:platform/start`, `/api/oauth/:platform/callback`
- Media: `/api/media/*`
- Publish: `/api/publish/*`
- Social: `/api/social/*`
- Brand Circulars: `/api/brand-circulars`, `/api/applications`
- Statistics: `/api/statistics/*`
- Scripts: `/api/scripts`, `/api/ai/script`
- Calendar: `/api/calendar/feed`
- Notifications: `/api/notifications`
- Events: `/api/events`
- Platform formats: `/api/platform-formats`

## Demo Workflow

1. Login as Editor.
2. Create a campaign.
3. Create or update a brand profile.
4. Create a content idea.
5. Generate platform variants with AI.
6. Submit a variant for review.
7. Show editor approval attempt blocked with backend `403`.
8. Login as Creator/Admin.
9. Approve a variant.
10. Open Accounts and connect a real platform if credentials are configured.
11. Open Compose or the approved campaign variant.
12. Upload media or write a text caption.
13. Customize captions with AI per connected account.
14. Validate, publish now, or schedule.
15. Show blocked state when credentials/scopes/app review are missing.
16. If a real connector succeeds, sync analytics/comments and reply through the same account.
17. Show live events and version history.
18. Login as Brand Rep, create/publish a brand circular, and shortlist a creator application.
19. Open Statistics to show real synced cross-platform stats or honest unavailable states.
20. Open Script AI and create a structured platform script.
21. Open the floating calendar drawer from the right-side button.
22. Open Architecture for judge explanation.

## Testing Checklist

- Backend syntax check passes with `node --check`
- `npm run seed` passes
- Server starts with empty platform credentials
- OAuth start for missing credentials returns not configured
- Tokens/secrets are never returned in connection responses
- Media upload stores original file and returns public URL
- AI repurpose and caption customization work without AI keys
- Publish validation blocks unconnected or unsupported platforms
- Existing login/campaign/AI/approval/versioning flow still works
- Frontend build passes
- Accounts page has no password field and no simulated add-account form
- Compose page previews media at 9:16 by default
- Publishing page shows real job states only
- Analytics page shows real synced data or honest unavailable states

## Known Limitations

- Real publishing requires developer credentials, scopes, and sometimes platform app review.
- Local uploads must be reachable through `PUBLIC_BASE_URL` for APIs that require public media URLs.
- Some connectors are partial because platform APIs restrict publishing, metrics, comments, or replies by product access.
- The worker is in-process for the hackathon MVP; production should use a durable queue.
- The app is not deployed by default.

## Roadmap

- Redis/BullMQ publishing and sync queues
- Object storage/CDN for media
- Workspace socket rooms
- Per-platform account selection during OAuth callback
- Advanced analytics pipeline
- CI/CD, monitoring, and deployment hardening

## Why Choose This Project?

CreatorOps OS is not just another content dashboard. It solves the real operational problem behind creator teams: moving content from idea to platform-ready execution with approval, brand consistency, scheduling, and accountability. Most tools focus on either AI generation or publishing. This system connects the whole workflow while refusing to fake external outcomes. It demonstrates backend depth through authentication, RBAC, encrypted platform connections, OAuth state handling, modular connector services, media upload, versioning, workflow events, Socket.IO realtime updates, and a real publish job worker.
