# CreatorOps OS

**CreatorOps OS** is a real creator workflow operating system for planning campaigns, adapting content for multiple platforms, connecting official social accounts, publishing only through allowed platform APIs, syncing real social data, and managing brand collaboration circulars.

It is built for the UIU Developers Hub Hackathon, but the architecture is intentionally production-shaped: a modular monolith with real backend boundaries, encrypted connection storage, role-based access control, durable workflow records, and honest unavailable states instead of fake social success.

## Tagline

One creator workspace for campaigns, AI content adaptation, real account publishing, analytics, comments, brand circulars, and workflow accountability.

## Short Pitch

Most creator tools stop at one of two points: generating captions or scheduling posts. CreatorOps OS connects the full operation around creator work.

A creator can create a campaign, turn one idea into platform-specific variants, approve or refine the content, connect real accounts, upload media, customize captions with AI, validate platform requirements, publish or schedule through official APIs, sync real metrics and comments, reply from the same publishing account, and track everything through live workflow events.

Brands can publish circulars for creator campaigns, review applications, shortlist creators, and send notifications. The dashboard brings together real creator statistics and operational activity without inventing fake numbers.

## Problem Statement

Creator teams have a workflow problem, not only a content generation problem.

They need to answer questions like:

- Which campaign does this content belong to?
- Has the content been reviewed?
- Which platform version is approved?
- Which real account will publish it?
- Does the selected platform accept this media and caption?
- Did the platform API actually publish it?
- What are the real comments, likes, views, and replies after publishing?
- Which creator applied for a brand circular, and what real stats did they attach?
- Who changed or approved each step?

Without one shared system, teams bounce between AI tools, spreadsheets, social dashboards, chat threads, approval messages, and platform portals. CreatorOps OS turns that scattered workflow into one auditable operating layer.

## Selected Hackathon Core Areas

- **Multi-Platform Content Management**
- **AI-Powered Content Workflow**
- **Creator Team Collaboration Infrastructure**

## What Makes This More Than A Basic Dashboard

CreatorOps OS is not a static admin panel. It includes real backend workflow mechanics:

- JWT authentication and backend-enforced RBAC
- Workspace-scoped queries across protected routes
- Mongoose data models for campaigns, content, variants, versions, approvals, real connections, publish jobs, published posts, metrics, comments, replies, circulars, applications, scripts, notifications, and events
- AI provider abstraction with Gemini, Groq, and a required JavaScript fallback
- Platform connector registry for official API integrations
- Encrypted token and secret storage with AES-256-GCM
- OAuth state validation with safe redirects
- Media upload preservation using local storage
- Publish validation before queueing jobs
- A publishing worker that processes real `PublishJob` records
- Real social sync from official APIs when scopes and permissions allow
- Nested comment and reply UI backed by stored provider and CreatorOps reply records
- Socket.IO events for workflow, publishing, metrics, comments, and replies
- Content version snapshots and workflow audit events
- Honest blocked, missing permission, missing credential, not configured, and unavailable states

The app never claims an external post, metric, comment, reply, or account connection happened unless the official platform API returned real data.

## Current Roles

The current product-facing roles are:

- **Content Creator**
  - Uses campaigns, compose, real account connections, publishing, analytics, approvals, applications, scripts, dashboard statistics, profile, and social replies.
- **Brand Representative**
  - Creates and manages brand circulars, reviews creator applications, shortlists/rejects/accepts applicants, and can use brand-facing publishing surfaces.

Legacy roles from earlier phases are still supported for compatibility:

- `editor` maps to `content_creator`
- `creator_admin` maps to `content_creator`

There is no social-platform password login. Users authenticate to CreatorOps OS, then connect platforms only through official OAuth or API credential flows.

## Demo Accounts

Seeded CreatorOps accounts:

| User | Email | Password | Role |
| --- | --- | --- | --- |
| Demo Content Creator | `editor@creatorops.dev` | `password123` | `content_creator` |
| Demo Server Manager | `admin@creatorops.dev` | `password123` | `content_creator` |
| Demo Brand Rep | `brand@creatorops.dev` | `password123` | `brand_rep` |

The seed script intentionally does **not** create fake platform connections. Real platform accounts must be connected through OAuth or configured official credentials.

## Feature Overview

### 1. Authentication And Workspace Foundation

- Register, login, and authenticated `/me` endpoint
- JWT tokens signed with `JWT_SECRET`
- Password hashing with bcrypt
- Workspace-scoped user data
- Protected frontend shell with persisted local session
- Sidebar user badge, role badge, profile link, logout, notifications, and theme toggle

### 2. Dashboard With Real Statistics

The dashboard is the main control center. It shows:

- Campaign count
- Connected account count
- Queued publish jobs
- Published jobs
- Recent workflow event count
- Combined creator statistics from real synced platform data
- Per-platform chart components
- Snapshot creation for creator applications
- Live workflow event feed
- Quick demo path for judges

Statistics are not fabricated. If no platform data has been synced, the dashboard shows an unavailable or empty state.

### 3. Campaign Management

Creators can create and manage campaigns with:

- Name
- Goal
- Target audience
- Selected platforms
- Campaign status
- Related content ideas
- Related platform variants
- Campaign tracking summary

Campaign tracking uses stored database records only:

- Total content items
- Total variants
- Variant status counts
- Publish job status counts
- Published post count
- Platform breakdown
- Connected account breakdown
- Provider post URLs when real platforms returned them
- Synced metrics and comments where available

### 4. Brand Profile

A workspace can maintain a brand profile used by the AI and workflow:

- Brand name
- Tone
- Target audience
- CTA style
- Banned words
- Preferred platforms
- Optional brand/company details

AI scoring and fallback generation use this profile for brand consistency checks.

### 5. Content Ideas And Platform Variants

Creators can add raw content ideas to a campaign and generate platform variants.

Each generated `PlatformVariant` can include:

- Platform
- Caption
- Hook
- CTA
- Hashtags
- Brand score
- Readiness score
- Warnings
- Suggestions
- AI provider used
- Status
- Platform notes
- Visibility recommendations

Supported content platforms:

- Facebook
- Instagram
- TikTok
- YouTube
- YouTube Shorts
- Threads
- LinkedIn
- X
- Pinterest
- WordPress / Blog
- Shopify

### 6. AI Repurposing And Caption Customization

AI features include:

- `POST /api/ai/repurpose`
- `POST /api/ai/optimize`
- `POST /api/ai/customize-captions`
- `POST /api/ai/script`

Provider order:

1. Gemini if configured and selected/available
2. Groq if configured and selected/available
3. JavaScript template fallback

The fallback is mandatory and demo-safe. Missing AI keys do not break the app.

AI output is structured, not just plain text:

- Caption
- Hook
- CTA
- Hashtags
- Platform notes
- Brand score
- Readiness score
- Warnings
- Suggestions
- Provider name

Platform-specific adaptation covers:

- Instagram visual-first captions and hashtag-friendly text
- TikTok fast hook-first captions
- YouTube and YouTube Shorts title/description/script style
- LinkedIn professional insight posts
- X concise short-form posts
- Pinterest search-friendly pin descriptions
- Facebook community engagement
- Threads conversational posts
- WordPress article-style intros and outlines
- Shopify product/content marketing copy

### 7. Platform Format Rules

The backend stores platform format rules for all supported platforms. The UI can show:

- Max caption length
- Current caption length
- Max hashtag count
- Current hashtag count
- Platform style
- Media requirements
- CTA guidance
- Readiness checklist

This makes platform-specific optimization visible and testable.

### 8. Approval Workflow

The app supports structured content approval:

- Request approval for a variant
- View pending approvals
- Approve
- Reject
- Request changes
- Store reviewer comments
- Create version snapshots
- Create workflow events

Approval actions are backend-enforced. Hidden buttons are not the security boundary.

### 9. Draft Versioning

`ContentVersion` snapshots are created for important content and workflow changes:

- Content changes
- Variant text changes
- AI-generated variants
- AI-optimized variants
- Approval requested
- Approved/rejected/changes requested
- Scheduled/published states

Version history shows:

- Version number
- Change note
- Changed by
- Created time
- Snapshot status
- Platform and variant metadata
- Approval or schedule metadata when present

### 10. Real Platform Account Connections

The Accounts page uses `PlatformConnection`, not simulated accounts.

Each connection stores safe metadata:

- Platform
- Connection mode
- Account name
- Handle
- External account ID
- Account type
- Status
- Scopes
- Missing scopes
- Token expiry
- Capabilities
- Last health check
- Safe error code/message

Sensitive fields are encrypted and hidden:

- Access token
- Refresh token
- API secret
- App password

If `ENCRYPTION_KEY` is missing, real credential storage fails safely.

Connection statuses include:

- `not_configured`
- `connecting`
- `connected`
- `expired`
- `missing_permissions`
- `disconnected`
- `blocked`
- `error`

### 11. Official Platform Connector Architecture

Connectors live under `server/src/platforms`.

Implemented connector files:

- Facebook
- Instagram
- TikTok
- YouTube / YouTube Shorts
- Threads
- LinkedIn
- X
- Pinterest
- WordPress
- Shopify

Each connector exposes a common interface:

- Required environment variables
- Required scopes
- Capabilities
- Configuration status
- Authorization URL
- Token exchange
- Token refresh
- Account profile fetch
- Health check
- Publish payload validation
- Publish
- Analytics fetch
- Comments fetch
- Reply to comment

Connector results are structured:

- `ok`
- `code`
- `message`
- `data`

Common honest failure codes:

- `NOT_CONFIGURED`
- `MISSING_PERMISSIONS`
- `PLATFORM_REVIEW_REQUIRED`
- `CAPABILITY_UNAVAILABLE`
- `NOT_IMPLEMENTED`
- `VALIDATION_FAILED`

### 12. YouTube And YouTube Shorts Connection Behavior

YouTube and YouTube Shorts use the Google OAuth connector.

- `youtube` stores the real YouTube channel connection.
- `youtube_shorts` reuses the YouTube channel connection.
- A second OAuth connection is not required just for Shorts.
- YouTube comments, metrics, uploads, and replies require Google scopes and enabled YouTube Data API access.

### 13. Media Upload And Preview

The media system supports:

- `POST /api/media/upload`
- Images
- Videos
- Local original file preservation
- MIME validation
- Size limits
- Workspace-scoped storage
- Public URL generation using `PUBLIC_BASE_URL`
- Preview crop metadata for images
- No quality reduction of original uploads

Compose defaults media previews to 9:16, with aspect options like:

- 9:16
- 1:1
- 4:5
- 16:9
- Original

Video is not destructively cropped. The preview may fit the frame, but the uploaded original is preserved.

### 14. Compose

The Compose page is the main publishing workspace.

It supports:

- Uploading media
- Text-only posts where platform allows
- Caption input
- Selecting real connected accounts
- Per-account/platform caption customization with AI
- Editing generated captions
- Visibility selection for video posts
- Publish now
- Schedule later
- Platform validation before publishing
- Clear blocked states when account, credentials, scopes, media, caption, or API capabilities are missing

Compose does not show fake accounts or ask for social media passwords.

### 15. Visibility Controls

Video posts can store a visibility value:

- `public`
- `private`
- `friends_only`

Connector validation decides whether a platform supports the selected visibility. Unsupported choices are blocked honestly instead of pretending they worked.

### 16. Real Publishing Jobs

Publishing uses `PublishJob` and `PublishedPost`.

Job statuses:

- `queued`
- `publishing`
- `published`
- `failed`
- `blocked`
- `cancelled`

Published post statuses:

- `queued`
- `publishing`
- `published`
- `failed`
- `blocked`

A job becomes `published` only when a real connector returns a successful official provider response.

The publishing worker:

- Finds due queued jobs
- Locks by status guard
- Calls connector validation
- Calls connector publish
- Saves provider post ID/URL when returned
- Stores provider raw response server-side
- Emits realtime job updates
- Creates workflow events
- Stores error codes/messages for blocked or failed jobs

### 17. Publishing Page

The Publishing page shows real job state grouped by:

- Queued
- Publishing
- Published
- Failed
- Blocked
- Cancelled

Each job card can show:

- Platform
- Connected account
- Caption preview
- Media preview
- Scheduled time
- Status
- Provider post URL when available
- Error reason
- Retry or cancel where allowed

It does not say "posted to platform" unless the official provider returned success.

### 18. Analytics And Unified Post Details

The Analytics page groups the same post across platforms into a unified post detail view.

It shows:

- Combined likes
- Combined reactions
- Combined comments
- Combined shares
- Combined views
- Combined saves
- Per-platform metric breakdown
- Platform account used
- Provider post link when available
- Metrics sync status
- Comments sync status
- Real top-level comments
- Provider replies
- CreatorOps replies
- Nested reply UI
- Reply controls using the same connected platform account

No analytics are fabricated. If a provider does not support a metric, scope is missing, app review is required, or a plan blocks access, the UI shows the real unavailable state.

### 19. Comments And Replies

Social data models include:

- `SocialComment`
- `SocialReply`

The system can:

- Sync comments from supported official APIs
- Store provider comment IDs
- Store provider thread IDs
- Store parent provider IDs
- Store real CreatorOps replies with provider reply IDs
- Render comment/reply trees in Analytics
- Reply from the connected account that published the post
- Emit realtime reply events

The UI de-duplicates CreatorOps-created replies so they do not appear twice when a provider sync returns the same reply as a platform reply record.

### 20. Brand Circulars

Brand representatives can create collaboration circulars.

Circular fields include:

- Title
- Product name
- Product description
- Product category
- Target audience
- Campaign objective
- Platforms needed
- Deliverables
- Content formats
- Deadline
- Budget amount
- Currency
- Eligibility requirements
- Brand demands
- Judging criteria
- Optional media assets
- Status

Circular statuses:

- `draft`
- `published`
- `closed`
- `archived`

Creators can browse published circulars and apply.

### 21. Circular Applications

Creators can apply to brand circulars with:

- Message
- Creator profile summary
- Combined stats snapshot
- Platform stats snapshot
- Selected published posts
- Selected media assets

Application statuses:

- `submitted`
- `viewed`
- `shortlisted`
- `rejected`
- `accepted`
- `withdrawn`

Brand reps can:

- View applications
- View creator profiles
- Shortlist creators
- Reject creators
- Accept creators

Notifications and workflow events are created for major application actions.

### 22. Notifications

Creator notifications support:

- Application viewed
- Creator shortlisted
- Application rejected
- Application accepted
- Calendar reminders

The sidebar includes a notification indicator and read actions.

### 23. Script AI

The Scripting page provides a conversational script agent.

Supported script use cases:

- Reel script
- TikTok script
- YouTube Shorts script
- Long-form YouTube outline
- Product promo script
- UGC ad script
- Hook variations
- Voiceover script
- Scene-by-scene script

Saved script conversations include:

- Messages
- Final script
- Platform
- Script type
- AI provider
- Campaign link when selected

Users can convert a final script into a `ContentItem`.

### 24. Floating Calendar Drawer

Authenticated pages include a right-side floating calendar drawer.

Calendar feed sources:

- Scheduled publish jobs
- Published posts
- Brand circular deadlines
- Application status changes
- Campaign milestones
- Workflow events

The calendar can show:

- Scheduled posts
- Upcoming events
- Recent last posts
- Circular deadlines
- Application deadlines
- Workflow milestones

Filters include platform, campaign, circular, status, event type, and date range where available.

### 25. Profiles And Reviews

Profile routes support:

- Viewing your profile with `/profile/me`
- Viewing creator or brand profiles
- Editing profile basics
- Brand details for brand reps
- Reviews and aggregate rating records

### 26. Theme And UI

Frontend UI includes:

- Dark/light theme toggle
- Persistent theme preference
- Collapsible sidebar
- Mobile bottom navigation
- Responsive app shell
- Role badges
- Platform/status badges
- Clean dark SaaS default
- Custom logo and favicon

## Tech Stack

### Frontend

- Next.js App Router
- Next.js `16.1.7`
- React `19.2.6`
- Tailwind CSS
- lucide-react
- socket.io-client
- react-easy-crop for image preview/crop controls

### Backend

- Node.js
- Express
- MongoDB
- Mongoose
- JWT
- bcryptjs
- multer
- Socket.IO
- Node crypto for AES-256-GCM encryption

### AI

- Gemini optional
- Groq optional
- JavaScript template fallback required

### Integrations

- OAuth/API connector architecture
- Google/YouTube
- Meta/Facebook/Instagram/Threads where credentials and permissions allow
- TikTok where app/product access allows
- LinkedIn where scopes allow
- X where access plan allows
- Pinterest where scopes allow
- WordPress REST API with application password
- Shopify Admin API or OAuth credentials

## Architecture

CreatorOps OS is a modular monolith.

It is not described as microservices because the app is deployed as one Express API and one Next.js frontend. The backend is still divided into service boundaries so pieces can be split later.

```text
Browser
  |
  | Next.js App Router UI
  | - Dashboard
  | - Campaigns
  | - Compose
  | - Accounts
  | - Publishing
  | - Analytics
  | - Approvals
  | - Circulars
  | - Scripting
  |
Express API
  |
  | Middleware
  | - CORS
  | - JWT authentication
  | - RBAC
  | - Error handling
  |
  | Services
  | - Auth
  | - AI
  | - Campaign/content
  | - Versioning
  | - Approval
  | - OAuth state
  | - Platform connections
  | - Platform format rules
  | - Media
  | - Publish jobs
  | - Social sync
  | - Brand circulars
  | - Statistics
  | - Scripts
  | - Notifications
  | - Calendar
  | - Workflow events
  |
MongoDB
  |
  | Mongoose models and indexes
  |
Socket.IO
  |
  | workflow:event
  | publishing:job_updated
  | social:metrics_updated
  | social:comments_synced
  | social:reply_created
```

## Database Models

### Workspace And Users

- `Workspace`: workspace boundary for user data
- `User`: email, password hash, role, workspace, profile, ratings

### Content Operations

- `BrandProfile`: tone, audience, CTA style, banned words, preferred platforms
- `Campaign`: campaign planning and platform selection
- `ContentItem`: raw ideas and status
- `PlatformVariant`: platform-specific content variants
- `ContentVersion`: version snapshots
- `ApprovalRequest`: review state for variants
- `WorkflowEvent`: audit log and realtime event source

### Platform And Publishing

- `PlatformConnection`: real encrypted platform connections
- `OAuthState`: secure temporary OAuth state
- `PlatformFormatRule`: platform limits and requirements
- `MediaAsset`: uploaded original media and preview metadata
- `PublishJob`: queued/scheduled/blocked/failed/published job records
- `PublishedPost`: real provider publish result records

### Social Data

- `SocialMetricSnapshot`: real synced metrics
- `SocialComment`: real synced provider comments
- `SocialReply`: real replies created through CreatorOps and provider APIs

### Creator Economy

- `BrandCircular`: brand campaign circulars
- `CircularApplication`: creator applications
- `CreatorStatisticSnapshot`: stats attached to applications
- `CreatorNotification`: application and workflow notifications
- `Review`: profile review/rating data

### AI Scripting

- `ScriptConversation`: saved script chat messages and final structured scripts

## API Route Summary

### Health

- `GET /health`

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### AI

- `POST /api/ai/repurpose`
- `POST /api/ai/optimize`
- `POST /api/ai/customize-captions`
- `POST /api/ai/script`

### Brand Profile

- `GET /api/brand-profile`
- `POST /api/brand-profile`
- `PATCH /api/brand-profile`

### Campaigns

- `POST /api/campaigns`
- `GET /api/campaigns`
- `GET /api/campaigns/:id`
- `GET /api/campaigns/:id/tracking`
- `GET /api/campaigns/:id/publish-summary`

### Content

- `POST /api/content`
- `GET /api/content/campaign/:campaignId`
- `PATCH /api/content/:id`
- `PATCH /api/content/:id/status`
- `GET /api/content/:id/versions`
- `GET /api/content/:id/variants`

### Approvals

- `POST /api/approvals/request`
- `GET /api/approvals/pending`
- `POST /api/approvals/:id/approve`
- `POST /api/approvals/:id/reject`
- `POST /api/approvals/:id/request-changes`

### Platform Connections

- `GET /api/platform-connections`
- `GET /api/platform-connections/:id`
- `GET /api/platform-connections/status`
- `GET /api/platform-connections/capabilities`
- `POST /api/platform-connections/:id/disconnect`
- `POST /api/platform-connections/:id/refresh`
- `POST /api/platform-connections/:id/health-check`
- `DELETE /api/platform-connections/:id`

### OAuth

- `GET /api/oauth/:platform/start`
- `GET /api/oauth/:platform/callback`

### Platform Formats

- `GET /api/platform-formats`
- `GET /api/platform-formats/:platform`

### Media

- `POST /api/media/upload`
- `GET /api/media`
- `GET /api/media/:id`
- `PATCH /api/media/:id`
- `DELETE /api/media/:id`

### Publish

- `POST /api/publish/validate`
- `POST /api/publish/now`
- `POST /api/publish/schedule`
- `GET /api/publish/jobs`
- `GET /api/publish/jobs/:id`
- `POST /api/publish/jobs/:id/cancel`
- `POST /api/publish/jobs/:id/retry`

### Social

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

### Brand Circulars And Applications

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

### Statistics

- `GET /api/statistics/creator`
- `POST /api/statistics/snapshot`

### Scripts

- `GET /api/scripts`
- `GET /api/scripts/:id`
- `POST /api/scripts/:id/convert-to-content`

### Calendar

- `GET /api/calendar/feed`

### Notifications

- `GET /api/notifications`
- `POST /api/notifications/:id/read`

### Events

- `GET /api/events`

### Users And Profiles

- `GET /api/users/profile/:id`
- `PUT /api/users/profile`
- `POST /api/users/:id/reviews`

### Legacy Schedule Routes

The app also keeps earlier schedule routes for compatibility:

- `POST /api/schedule`
- `GET /api/schedule`
- `POST /api/schedule/:id/run-now`

The current real publishing flow uses `/api/publish/*`.

## Environment Variables

### Server

Create `server/.env` from `server/.env.example`.

Minimum local values:

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

Optional OAuth/API credentials:

```env
META_APP_ID=
META_APP_SECRET=
META_REDIRECT_URI=http://localhost:5000/api/oauth/meta/callback

FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
FACEBOOK_REDIRECT_URI=http://localhost:5000/api/oauth/facebook/callback

INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
INSTAGRAM_REDIRECT_URI=http://localhost:5000/api/oauth/instagram/callback

THREADS_APP_ID=
THREADS_APP_SECRET=
THREADS_REDIRECT_URI=http://localhost:5000/api/oauth/threads/callback

TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_REDIRECT_URI=http://localhost:5000/api/oauth/tiktok/callback

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:5000/api/oauth/google/callback

LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_REDIRECT_URI=http://localhost:5000/api/oauth/linkedin/callback
LINKEDIN_API_VERSION=

X_CLIENT_ID=
X_CLIENT_SECRET=
X_REDIRECT_URI=http://127.0.0.1:5000/api/oauth/x/callback

PINTEREST_CLIENT_ID=
PINTEREST_CLIENT_SECRET=
PINTEREST_REDIRECT_URI=http://localhost:5000/api/oauth/pinterest/callback

WORDPRESS_BASE_URL=
WORDPRESS_USERNAME=
WORDPRESS_APP_PASSWORD=

SHOPIFY_SHOP_DOMAIN=
SHOPIFY_ADMIN_ACCESS_TOKEN=
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
SHOPIFY_REDIRECT_URI=http://localhost:5000/api/oauth/shopify/callback
```

Do not commit `server/.env`.

### Client

Create `client/.env` from `client/.env.example`.

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

For 127.0.0.1-only testing:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:5000
NEXT_PUBLIC_SOCKET_URL=http://127.0.0.1:5000
```

Do not commit `client/.env`.

## Local Setup

### 1. Install Dependencies

```powershell
cd server
npm install

cd ../client
npm install
```

### 2. Configure Environment Files

```powershell
copy server\.env.example server\.env
copy client\.env.example client\.env
```

Then edit the files with local values. Keep secrets private.

### 3. Start MongoDB

Use a local MongoDB instance:

```powershell
mongod
```

Or use MongoDB Atlas by setting `MONGO_URI`.

### 4. Seed Demo Data

```powershell
cd server
npm run seed
```

The seed creates:

- Demo workspace
- Content creator account
- Server manager demo account
- Brand representative account
- Platform format rules

It does not create fake platform connections.

### 5. Start Backend

```powershell
cd server
npm run dev
```

Backend runs on:

```text
http://localhost:5000
```

### 6. Start Frontend

```powershell
cd client
npm run dev
```

Frontend runs on:

```text
http://localhost:3000
```

## Browser Demo Script

### Creator Workflow

1. Login with `editor@creatorops.dev` / `password123`.
2. Open Dashboard and confirm statistics and live event feed load.
3. Open Campaigns.
4. Create a campaign with multiple platforms.
5. Open the campaign detail page.
6. Create or update the brand profile.
7. Add a content idea.
8. Generate platform variants with AI.
9. Review caption, hook, CTA, hashtags, scores, warnings, suggestions, and provider.
10. Submit a variant for approval.
11. Approve or request changes through the approval workflow.
12. Open Accounts and connect real accounts if credentials are configured.
13. Open Compose.
14. Upload media or write text.
15. Select connected accounts.
16. Customize captions with AI.
17. Choose visibility for video where relevant.
18. Validate.
19. Publish now or schedule.
20. Open Publishing to see job status.
21. Open Analytics to sync metrics/comments and reply through the connected account.
22. Open the floating calendar drawer to see scheduled and recent activity.

### Brand Representative Workflow

1. Login with `brand@creatorops.dev` / `password123`.
2. Open Brand Circulars.
3. Create a circular with product, deliverables, platforms, deadline, budget, eligibility, demands, and judging criteria.
4. Publish the circular.
5. Review applications.
6. View creator profile.
7. Shortlist, reject, or accept applicants.
8. Confirm notifications and workflow events are created.

### Script AI Workflow

1. Login as a content creator.
2. Open Script AI.
3. Ask for a reel, TikTok, Shorts, UGC ad, voiceover, or scene-by-scene script.
4. Revise or shorten it in conversation.
5. Save final script.
6. Convert it into campaign content.

## Platform Setup Notes

Real platform functionality depends on official credentials, platform scopes, app review, and account permissions.

### Google / YouTube

Required for YouTube and YouTube Shorts:

- Google OAuth client
- YouTube Data API v3 enabled
- Redirect URI exactly matching `GOOGLE_REDIRECT_URI`
- Test user added if app is in testing mode

Useful scopes:

- `https://www.googleapis.com/auth/youtube.upload`
- `https://www.googleapis.com/auth/youtube.readonly`
- `https://www.googleapis.com/auth/youtube.force-ssl`

If scopes are added after a user connected, reconnect the account so the token receives the new scopes.

### X

X publishing can require paid or approved API access. If the API returns plan or payment restrictions, CreatorOps shows the real blocked/error message.

### Meta Platforms

Facebook, Instagram, and Threads require Meta app credentials and the correct product permissions. Some publish/comment/insight capabilities require app review.

### TikTok

TikTok Content Posting API access may require product approval. Without it, the connector returns `PLATFORM_REVIEW_REQUIRED` or `MISSING_PERMISSIONS`.

### LinkedIn

LinkedIn profile/page posting depends on granted scopes and whether the account has access to the organization/member APIs.

### Pinterest

Pinterest pin creation and analytics require OAuth access and board/account permissions.

### WordPress

WordPress uses REST API access and application passwords or supported auth. The app never asks for a social password in the frontend.

### Shopify

Shopify content publishing requires shop domain and Admin API token or OAuth app credentials with the correct scopes.

## Real Data Policy

CreatorOps OS intentionally avoids fake external outcomes.

The app does not fake:

- Connected accounts
- OAuth success
- Published posts
- Likes
- Reactions
- Comments
- Shares
- Views
- Saves
- Replies
- Provider post URLs
- Analytics summaries

When something cannot be completed, the UI/API should say:

- Not configured
- Missing credentials
- Missing permissions
- Requires platform review
- Capability unavailable
- Blocked
- Failed with provider error

AI fallback is only used for local text generation. It is not used to fake platform data.

## Security Decisions

- Social platform passwords are never collected.
- OAuth and API secrets are server-side only.
- Tokens/secrets are encrypted at rest.
- Encrypted fields are excluded from normal query results and JSON responses.
- OAuth state is random, expiry-bound, and tied to user/workspace/platform.
- OAuth callback redirects are restricted to configured client URLs.
- Browser API calls use JWT auth.
- Workspace scoping is enforced in backend services.
- Platform connection responses are sanitized.
- Uploads are stored outside Git tracking.
- `.env`, `node_modules`, `.next`, uploads, and private `agent-context` are not public submission material.

## Realtime Events

Persisted workflow events use:

- `workflow:event`

Publishing events use:

- `publishing:job_updated`

Social sync events use:

- `social:metrics_updated`
- `social:comments_synced`
- `social:reply_created`

The frontend still works through API fetches if Socket.IO is unavailable.

## Verification Commands

### Backend Syntax Checks

```powershell
cd server
node --check src/server.js
node --check src/services/social.service.js
```

### Seed

```powershell
cd server
npm run seed
```

### Frontend Build

```powershell
cd client
npm run build
```

### Fresh Client Install And Build

```powershell
cd client
npm ci
npm run build
```

## Deployment Notes

### Frontend On Vercel

The frontend is in `client/`.

Suggested Vercel settings:

- Root Directory: `client`
- Framework Preset: Next.js
- Build Command: `npm run build`
- Output Directory: leave empty/default
- Install Command: `npm install` or default

The project currently pins:

```json
"next": "16.1.7",
"react": "19.2.6",
"react-dom": "19.2.6"
```

This pin avoids a recent observed Vercel deployment finalization issue with Next `16.2.x` looking for `routes-manifest-deterministic.json` after a successful build.

### Backend Deployment

The backend is a separate Express API and is not automatically deployed by Vercel frontend hosting.

Deploy it to a Node-capable host with:

- MongoDB connection
- Persistent uploads or object storage
- Environment variables
- WebSocket support for Socket.IO
- A stable public `PUBLIC_BASE_URL`

For production media, replace local upload storage with object storage such as S3, Cloudflare R2, or Vercel Blob.

## Testing Checklist

### Core App

- Login works.
- `/api/auth/me` returns the current user.
- Dashboard loads.
- Theme toggle switches dark/light.
- Sidebar role links match current user role.
- Workflow event feed loads persisted events.

### Campaign And AI

- Campaign creation works.
- Brand profile create/update works.
- Content idea creation works.
- AI repurpose creates platform variants.
- AI customize captions works with no AI keys through fallback.
- Gemini/Groq work when keys are configured.
- Provider failures return template fallback, not a broken demo.

### Approval And Versioning

- Variant approval request works.
- Approval actions update status.
- Version history shows snapshots.
- Workflow events are created.

### Accounts

- Accounts page shows platform configuration state.
- Missing env credentials show not configured.
- OAuth start redirects only when platform is configured.
- Callback saves sanitized PlatformConnection.
- YouTube Shorts reuses YouTube channel connection.
- No encrypted token fields appear in API responses.

### Compose And Publishing

- Media upload works.
- Image preview supports aspect options.
- Video upload is not destructively cropped.
- Connected accounts can be selected.
- Caption customization generates per-platform results.
- Publish validation blocks missing account/media/scope/API capability.
- Publish job stores blocked/failed reason when provider denies action.
- Publishing page shows queued/published/failed/blocked/cancelled states.

### Analytics And Replies

- Sync all platforms calls real provider APIs.
- No fake metrics appear.
- Per-platform metric breakdown is clear.
- Comments sync shows real comments or honest unavailable state.
- Comment tree renders provider comments and CreatorOps replies.
- Reply uses the same connected account.
- Duplicate provider rows for CreatorOps-created replies are hidden in the UI.

### Brand Circulars

- Brand rep can create and publish circular.
- Content creator can browse published circulars.
- Content creator can apply.
- Brand rep can view applications.
- Shortlist/reject/accept updates application status.
- Notifications are created.

### Security

- `.env` files are not committed.
- `agent-context/` remains private/ignored.
- No platform secrets are printed in logs or responses.
- Missing credentials do not crash the app.

## Known Limitations

- Real platform publishing depends on official developer access, scopes, review status, and account permissions.
- Some platform APIs restrict metrics, comments, replies, or publishing behind app review or paid access.
- Local uploads are only suitable for development. Many APIs need a public media URL.
- The publish worker runs in-process for MVP simplicity.
- Socket.IO is not yet separated by workspace rooms.
- Analytics are snapshots, not a full data warehouse.
- There is no production object storage integration yet.
- There is no CI/CD pipeline in this repository yet.
- The backend must be deployed separately from the Next.js frontend.

## Future Roadmap

- Durable queue with Redis/BullMQ
- Object storage for media assets
- Workspace-specific Socket.IO rooms
- More granular role and permission model
- Multi-workspace organization switching
- Full OAuth account selection for pages/organizations/boards
- Rich calendar editing and reminders
- Advanced analytics pipeline
- Comment moderation queue
- Campaign ROI reporting
- CI/CD and automated tests
- Production deployment templates
- Real collaboration notifications through email or push

## Repository Structure

```text
creatorops-os/
  client/
    src/app/                 Next.js pages
    src/components/          UI components
    src/lib/                 API, auth, socket, platform, role, theme helpers
    public/                  Public assets
  server/
    src/app.js               Express app and route registration
    src/server.js            HTTP server, DB connection, Socket.IO, worker
    src/config/              Env and database config
    src/constants/           Roles and platform constants
    src/controllers/         Request handlers
    src/middleware/          Auth, role, error middleware
    src/models/              Mongoose schemas
    src/platforms/           Official platform connectors
    src/routes/              API route modules
    src/services/            Business logic
    src/sockets/             Socket.IO setup
    src/workers/             Publishing worker
  docs/                      Public documentation
```

## Public Documentation

Additional docs:

- `docs/API.md`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE.md`
- `docs/DEMO_SCRIPT.md`
- `docs/SUBMISSION_NOTES.md`
- `docs/AREA1_COMPLETION.md`
- `docs/REAL_PLATFORM_INTEGRATIONS.md`
- `docs/OAUTH_SETUP.md`
- `docs/SECURITY.md`
- `docs/COMPOSE_PUBLISH_ANALYTICS.md`

Private agent context is intentionally ignored and is not required for judges.

## Why Should We Choose This Project?

CreatorOps OS is not just another content dashboard. It solves the real operational problem behind creator teams: moving content from idea to platform-ready execution with approval, brand consistency, account targeting, publishing validation, analytics, comments, applications, and accountability.

Most tools focus on either AI generation or publishing. CreatorOps OS connects the entire workflow:

- One raw idea becomes platform-specific variants.
- AI checks brand fit and readiness.
- The approval/versioning system keeps decisions auditable.
- Real platform connections are encrypted and scoped.
- Publishing only succeeds when official APIs succeed.
- Metrics/comments/replies are synced from real provider data.
- Brand circulars connect creators and brands.
- Statistics and application snapshots help creators prove their value.
- Socket.IO keeps workflow state live.

The project demonstrates full-stack depth across authentication, RBAC, Mongoose modeling, service architecture, OAuth, encryption, media upload, platform connectors, AI fallback, workflow events, real publishing jobs, social sync, nested replies, creator applications, and judge-friendly documentation.
