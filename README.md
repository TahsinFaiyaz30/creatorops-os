# CreatorOps OS

Content workflow infrastructure for creator teams.

CreatorOps OS turns one raw content idea into platform-specific variants, checks brand fit, routes work through approval, schedules approved content to simulated platform accounts, runs a publishing simulator, and records the whole workflow as realtime events.

## Short Pitch

Creator teams do not only need more content. They need an operating system for moving content from idea to execution without losing brand consistency, accountability, or review control. CreatorOps OS is a local-first MVP that demonstrates that workflow end to end.

## Problem Statement

Creators and small content teams often manage ideas, AI drafts, reviews, platform-specific copy, scheduling, and status tracking across disconnected tools. This creates repeated work, unclear ownership, weak brand consistency, and approval mistakes.

## Solution Overview

CreatorOps OS provides a single workflow:

1. An editor creates a campaign and content idea.
2. AI repurposes the idea into selected platform variants across the supported Area 1 platforms.
3. Each variant receives a brand score, readiness score, warnings, suggestions, and provider label.
4. The editor submits a variant for review.
5. The backend blocks editors from approving content.
6. A creator/admin approves, rejects, or requests changes.
7. Approved content can be scheduled.
8. A publishing simulator marks scheduled jobs as published.
9. Version history and realtime events preserve accountability.

## Hackathon Core Areas

- Multi-Platform Content Management
- AI-Powered Content Workflow
- Creator Team Collaboration Infrastructure

## Why This Is Not Just A Basic Dashboard

This project is not a static CRUD dashboard. The backend enforces real workflow rules with JWT authentication, role-based access control, workspace scoping, approval state transitions, version snapshots, event persistence, Socket.IO broadcasts, and an in-process publishing worker. The frontend is a demo console for that infrastructure.

## Key Features

- JWT authentication with seeded demo users
- Editor and creator/admin roles
- Workspace-scoped data access
- Brand profile rules for tone, audience, banned words, CTA style, and preferred platforms
- Campaign and content idea management
- AI repurposing into selected platform variants
- Support for Facebook, Instagram, TikTok, YouTube, YouTube Shorts, Threads, LinkedIn, X, Pinterest, Blog, and Shopify
- Simulated multi-account management
- Platform format rules and readiness checklist
- Optional Gemini and Groq providers
- Guaranteed JavaScript template fallback when AI keys are missing or providers fail
- Brand and readiness scoring
- Warnings and suggestions for generated content
- Backend-enforced approval workflow
- Version history for content and variant changes
- Account-targeted scheduling API for approved variants
- Unified Publishing page grouped by queued, processing, published, and failed jobs
- Publishing simulator with platform adapter names and account handles
- Socket.IO realtime workflow event feed
- Judge-friendly architecture page in the frontend

## Full Demo Workflow

1. Start MongoDB locally.
2. Seed demo users.
3. Start the backend and frontend.
4. Open `http://localhost:3000`.
5. Login as Editor.
6. Create a campaign with selected platforms.
7. Create or update the brand profile.
8. Create a raw content idea.
9. Click AI Repurpose.
10. Confirm platform variants appear for the selected platforms.
11. Submit one variant for review.
12. Try approval as Editor and confirm the backend returns 403.
13. Logout.
14. Login as Creator/Admin.
15. Open Approvals.
16. Approve one variant.
17. Reject or request changes on other variants.
18. Schedule the approved variant.
19. Run the publishing simulator.
20. Confirm workflow events and version history.
21. Open Publishing to see queued/published simulator jobs.
22. Open Accounts to see simulated connected accounts.
23. Open Architecture for the judge explanation.

## Tech Stack

Frontend:

- Next.js App Router
- React
- Tailwind CSS
- lucide-react
- socket.io-client

Backend:

- Node.js
- Express
- MongoDB
- Mongoose
- JWT
- bcryptjs
- Socket.IO
- Optional Gemini and Groq HTTP adapters

## Architecture Overview

CreatorOps OS is a modular monolith. The backend is one Express application with clear service boundaries:

- Auth service
- Brand profile service
- Campaign service
- Content service
- AI service
- Approval service
- Schedule service
- Versioning service
- Event service
- Publishing worker
- Socket.IO broadcaster
- Platform account management
- Platform format rules
- Campaign tracking summaries

This keeps the MVP simple enough to run locally while still showing production-shaped boundaries that could later move into queues, workers, or separate services.

## Database Design Summary

MongoDB stores:

- `User`: demo users, role, workspace membership
- `Workspace`: tenant boundary for all workflow records
- `BrandProfile`: brand voice and platform rules
- `Campaign`: campaign goal, audience, platforms
- `ContentItem`: raw ideas and workflow status
- `PlatformVariant`: platform-specific captions, hooks, CTAs, scores, status
- `ContentVersion`: immutable snapshots for audit/history
- `ApprovalRequest`: pending and completed review decisions
- `ScheduleJob`: queued, processing, published, or failed publishing simulations
- `WorkflowEvent`: persisted event stream for dashboard and realtime UI
- `PlatformAccount`: simulated connected platform account profiles
- `PlatformFormatRule`: platform-specific formatting limits and style rules

## Authentication And RBAC

Passwords are hashed with bcrypt before saving. Login returns a JWT signed with `JWT_SECRET`. Protected routes require `Authorization: Bearer <token>`.

Roles:

- `editor`: creates campaigns/content, runs AI repurpose, submits draft variants for review
- `creator_admin`: reviews approvals, schedules approved content, runs publishing simulator

Important backend rules:

- Editors cannot approve, reject, request changes as reviewer, schedule, or publish.
- Frontend buttons may hide actions, but backend middleware and services still enforce the rules.
- All workflow queries are scoped to `req.user.workspaceId`.

## AI Provider And Fallback

The AI service tries providers according to environment configuration:

- `AI_PROVIDER=auto`: Gemini, then Groq, then template fallback
- `AI_PROVIDER=gemini`: Gemini, then template fallback
- `AI_PROVIDER=groq`: Groq, then template fallback

The demo does not require paid APIs, credit cards, local LLMs, Ollama, or GPU setup. If keys are missing, a provider times out, returns invalid data, rate limits, or fails, the backend returns a valid structured template fallback response.

Each generated variant includes:

- platform
- caption
- hook
- CTA
- hashtags
- brandScore
- readinessScore
- warnings
- suggestions
- aiProvider
- status

## Approval Workflow

Editors submit draft platform variants for review. Creator/admin users can:

- approve
- reject
- request changes

Duplicate pending approval requests are blocked. Every approval action creates a workflow event and a version snapshot.

## Scheduling And Publishing Simulator

Only creator/admin users can schedule approved variants. Scheduling targets a matching simulated platform account, creates a `ScheduleJob`, sets content/variant status to `scheduled`, and records a version snapshot.

The publishing worker checks queued jobs and simulates platform publishing. The demo also includes a Run Now button so judges do not have to wait. Publishing updates the job, variant, content item, versions, and workflow events. No real social platform APIs are called.

Example simulator result:

```text
Published successfully to @codesprint_main via InstagramAdapterSimulator
```

## Realtime Event System

Workflow events are always saved to MongoDB first. After persistence, the backend emits a `workflow:event` Socket.IO event if the socket server is available. The frontend also fetches persisted events, so the demo still works if realtime connection is unavailable.

## Setup Instructions

Prerequisites:

- Node.js
- npm
- MongoDB running locally

Install dependencies:

```powershell
cd server
npm install

cd ../client
npm install
```

Create environment files:

```powershell
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
```

Edit `server/.env` and set a local `JWT_SECRET`. AI keys are optional.

Seed demo users:

```powershell
cd server
npm run seed
```

Run backend:

```powershell
cd server
npm run dev
```

Run frontend in a second terminal:

```powershell
cd client
npm run dev
```

Open:

```text
http://localhost:3000
```

## Environment Variables

Server:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/creatorops_os
JWT_SECRET=replace_with_long_random_secret
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
NODE_ENV=development
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash
GROQ_API_KEY=
AI_PROVIDER=auto
AI_FALLBACK=template
AI_TIMEOUT_MS=8000
```

Client:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

## Demo Credentials

Editor:

```text
editor@creatorops.dev / password123
```

Creator/Admin:

```text
admin@creatorops.dev / password123
```

## API Route Summary

Auth:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

Brand Profile:

- `GET /api/brand-profile`
- `POST /api/brand-profile`
- `PATCH /api/brand-profile`

Campaigns:

- `POST /api/campaigns`
- `GET /api/campaigns`
- `GET /api/campaigns/:id/tracking`
- `GET /api/campaigns/:id/publish-summary`
- `GET /api/campaigns/:id`

Content:

- `POST /api/content`
- `GET /api/content/campaign/:campaignId`
- `PATCH /api/content/:id`
- `PATCH /api/content/:id/status`
- `GET /api/content/:id/versions`
- `GET /api/content/:id/variants`

Platform Accounts:

- `POST /api/platform-accounts`
- `GET /api/platform-accounts`
- `GET /api/platform-accounts/:id`
- `PATCH /api/platform-accounts/:id`
- `DELETE /api/platform-accounts/:id`

Platform Formats:

- `GET /api/platform-formats`
- `GET /api/platform-formats/:platform`

AI:

- `POST /api/ai/repurpose`
- `POST /api/ai/optimize`

Approvals:

- `POST /api/approvals/request`
- `GET /api/approvals/pending`
- `POST /api/approvals/:id/approve`
- `POST /api/approvals/:id/reject`
- `POST /api/approvals/:id/request-changes`

Schedule:

- `POST /api/schedule`
- `GET /api/schedule`
- `POST /api/schedule/:id/run-now`

Events:

- `GET /api/events`

Full route details are in [docs/API.md](docs/API.md).

Area 1 completion details are in [docs/AREA1_COMPLETION.md](docs/AREA1_COMPLETION.md).

## Testing Checklist

- `npm run seed` succeeds in `server/`
- Backend starts with `npm run dev`
- Frontend builds with `npm run build`
- Frontend starts with `npm run dev`
- Editor login works
- Creator/Admin login works
- Campaign creation works
- Brand profile save works
- Content idea creation works
- AI repurpose returns variants for every selected supported platform
- Platform accounts page lists seeded simulated accounts
- Platform format checklist appears on generated variants
- Editor approval attempt returns 403
- Admin approval queue loads
- Admin approve/reject/request changes work
- Scheduling creates a queued job
- Schedule job targets a matching platform account
- Run Now marks job published
- Publishing page shows queued/published simulator jobs
- Campaign tracking panel shows real stored counts
- Workflow events appear
- Version history appears
- Architecture page loads

## Known Limitations

- No deployment is included.
- No real external social or commerce platform publishing is performed.
- Platform accounts are simulated local profiles and do not store OAuth tokens.
- The worker is in-process and meant for local demo reliability.
- Analytics are intentionally minimal.
- Media asset upload/storage is not included.
- Frontend state management is simple and demo-focused.
- AI provider keys are optional; template fallback is the guaranteed path.

## Future Roadmap

- Real platform publishing adapters
- Redis and BullMQ for distributed scheduling jobs
- Workspace socket rooms
- Media asset storage
- Analytics ingestion and campaign performance reports
- Approval notifications
- CI/CD and deployment pipeline
- More roles and granular permissions

## Why Should We Choose This Project?

CreatorOps OS solves the real operational problem behind creator teams: moving content from idea to platform-ready execution with approval, brand consistency, scheduling, and accountability. It connects AI generation, workflow control, role-based review, version history, realtime events, and scheduling into one end-to-end system. The MVP is simple enough to run locally but deep enough to show backend engineering, product thinking, and a realistic path to production.
