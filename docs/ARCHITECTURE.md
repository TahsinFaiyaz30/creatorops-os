# Architecture

CreatorOps OS is a modular monolith. That choice is intentional: the hackathon MVP needs real workflow depth, not fake microservice boundaries. Each major domain has its own model, service, controller, and route layer, so it can be split later if load demands it.

## Components

- Next.js App Router frontend
- Express API
- MongoDB/Mongoose persistence
- JWT authentication
- RBAC middleware
- Admin Panel and account role management
- AI service with Gemini/Groq/template fallback
- Creator review service
- Platform connector registry
- OAuth state service
- AES-256-GCM encryption service
- Media upload service
- Publish job service and worker
- Social sync service
- Brand circular/application service
- Creator statistics service
- Script conversation service
- Calendar feed service
- Notification service
- Workflow event service
- Socket.IO realtime stream

## Workflow

```text
Content creator
  -> campaign + content idea
  -> AI platform variants
  -> queue variant for creator review
  -> approve variant for publishing
  -> connect real platform account
  -> upload/select media
  -> validate publish payload
  -> queue publish job

Admin
  -> inspect Admin Panel control overview
  -> assign account roles: content_creator, brand_rep, admin

Publishing worker
  -> connectorRegistry
  -> official platform API
  -> published | failed | blocked
  -> WorkflowEvent + Socket.IO

Social sync
  -> official platform API
  -> metrics/comments/replies if supported
  -> stored real records + realtime updates

Brand circulars
  -> brand_rep creates/publishes opportunity
  -> brand_rep connects brand-owned platform accounts
  -> creator applies with real statistics snapshot
  -> brand_rep reviews/shortlists/accepts/rejects
  -> notifications + workflow events + calendar feed

Script AI
  -> conversational prompt
  -> Gemini/Groq when available
  -> JavaScript fallback script draft
  -> optional conversion to ContentItem
```

## Real Integration Rule

The connector layer never fakes a successful publish, metric, comment, share, view, or reply. Every connector method returns a structured result:

```json
{
  "ok": false,
  "code": "NOT_CONFIGURED",
  "message": "Platform credentials are not configured.",
  "data": {}
}
```

Common codes:

- `NOT_CONFIGURED`
- `MISSING_PERMISSIONS`
- `PLATFORM_REVIEW_REQUIRED`
- `CAPABILITY_UNAVAILABLE`
- `NOT_IMPLEMENTED`
- `VALIDATION_FAILED`

## Security Shape

- CreatorOps login is separate from social login.
- Account capabilities come from the `roles` array. Admin is a role, not a separate flag.
- Only admin can change account roles.
- Users are redirected to official platform OAuth pages.
- Social platform passwords are never requested or stored.
- Access tokens, refresh tokens, API secrets, and app passwords are encrypted at rest.
- Secrets are selected only inside backend services that need them.
- Sanitizers strip secrets from API responses.
- OAuth state is random, expiry-bound, workspace-bound, user-bound, and platform-bound.

## Scalability Strategy

- Replace in-process worker with Redis/BullMQ.
- Move local uploads to object storage/CDN.
- Use workspace-specific Socket.IO rooms.
- Add provider webhooks where platforms support them.
- Add a metrics ingestion pipeline.
- Add richer creator profile imports where creators authorize platform profile APIs.
- Add monitoring, CI/CD, and audit exports.
