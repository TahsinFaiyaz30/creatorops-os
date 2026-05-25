# Architecture

CreatorOps OS is a modular monolith. It runs as one Express API and one Next.js frontend, but the backend is organized around clear service boundaries instead of large route handlers.

## Why Modular Monolith

This MVP does not pretend to be microservices. The app runs locally, uses one MongoDB database, and keeps deployment simple. The architecture still separates responsibilities so future extraction is possible when there is real operational pressure.

This gives the hackathon demo:

- simple local setup
- fewer moving parts
- real backend depth
- clean boundaries for future scaling

## System Components

### Next.js Frontend

The frontend provides the browser demo for editors and creator/admins:

- login
- dashboard
- campaigns
- campaign detail workflow
- approvals
- scheduling
- live workflow events
- architecture page

### Express Backend

The Express API exposes workflow routes and delegates business logic to services. Controllers stay thin; services own validation, state changes, events, and versioning.

### MongoDB And Mongoose

MongoDB stores workspace-scoped records for users, campaigns, content, variants, approvals, schedules, versions, and workflow events. Mongoose models define relationships, indexes, enums, and timestamps.

### JWT Auth

Login returns a JWT. Protected routes require a bearer token. The auth middleware loads the user and attaches it to `req.user`.

### RBAC Middleware

Role middleware protects admin-only routes. Services also enforce business rules so the backend remains authoritative even if the frontend hides or shows the wrong button.

### AI Service

The AI service supports:

- Gemini when configured
- Groq when configured
- JavaScript template fallback

Provider failure never breaks the demo. The service always returns valid structured variants.

### Approval Service

The approval service manages pending review requests and creator/admin decisions. It blocks duplicate pending requests, updates variant/content status, writes version snapshots, and creates workflow events.

### Scheduling Service

The scheduling service creates queued jobs for approved variants and marks content/variants as scheduled. It assigns simulator adapter names based on platform.

### Publishing Worker

The worker polls queued jobs and simulates publishing. It marks jobs processing, then published or failed, while creating events and versions.

### Socket.IO Realtime Event Stream

Workflow events are persisted first, then emitted as `workflow:event`. If no socket client is connected, persistence still succeeds.

## Main Workflow Diagram

```text
Editor
  |
  v
Create Campaign
  |
  v
Create Content Idea
  |
  v
AI Repurpose Service
  |
  +--> Gemini or Groq if configured
  |
  +--> Template fallback if missing key, timeout, rate limit, invalid data, or provider error
  |
  v
Platform Variants
  |
  v
Submit For Review
  |
  v
ApprovalRequest pending
  |
  +--> Editor approval attempt -> 403 from backend
  |
  v
Creator/Admin Decision
  |
  +--> Approve -> schedule allowed
  |
  +--> Reject -> workflow stops
  |
  +--> Request changes -> editor revises later
  |
  v
Schedule Approved Variant
  |
  v
ScheduleJob queued
  |
  v
Publishing Worker or Run Now
  |
  v
ScheduleJob published
  |
  v
WorkflowEvent persisted and broadcast
```

## Data And Control Flow

1. Frontend sends authenticated API requests.
2. Auth middleware validates the JWT and loads the user.
3. Services scope every query by `workspaceId`.
4. Business services update models.
5. Versioning service saves snapshots for meaningful changes.
6. Event service persists workflow events.
7. Socket.IO broadcasts events after persistence.
8. Frontend listens for `workflow:event` and also fetches persisted events.

## Scalability Strategy

Future production work can scale the same architecture without rewriting the MVP:

- Replace in-process publishing worker with Redis and BullMQ.
- Add real platform adapters for Instagram, TikTok, YouTube, and LinkedIn.
- Use workspace-specific socket rooms instead of global event broadcast.
- Add an analytics pipeline for campaign performance and content attribution.
- Store images/videos in object storage.
- Add observability, monitoring, CI/CD, and deployment automation.
- Split services only after traffic or team ownership requires it.
