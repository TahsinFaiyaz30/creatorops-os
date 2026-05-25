# Database

All operational records are workspace-scoped unless noted.

## Core Models

### User

CreatorOps login identity. Stores name, email, password hash, role, and workspace.

### Workspace

Tenant boundary for all campaign, content, connection, publishing, and social records.

### BrandProfile

Brand rules used by AI scoring and caption generation: brand name, tone, audience, banned words, CTA style, preferred platforms.

### Campaign

Campaign container with name, goal, audience, selected platforms, status, and creator.

### ContentItem

Raw idea and workflow status. Related to campaign and variants.

### PlatformVariant

Platform-specific caption, hook, CTA, hashtags, AI provider, brand/readiness scores, warnings, suggestions, and approval/publish status.

### ContentVersion

Audit snapshot for content/variant changes, approval decisions, publish state changes, and related metadata.

### ApprovalRequest

Review request for a platform variant with requestedBy, reviewedBy, status, and comments.

### WorkflowEvent

Persisted event log used by dashboard and Socket.IO realtime feed.

## Real Integration Models

### OAuthState

Random OAuth state tied to user, workspace, platform, redirect URI, PKCE verifier if needed, expiry, and consumed timestamp.

### PlatformConnection

Real connected account metadata:

- platform
- connection mode
- account name/handle/external ID
- status
- scopes and missing scopes
- capabilities
- encrypted tokens/secrets
- health check metadata

Encrypted fields are never returned to the frontend.

### PlatformFormatRule

Platform-specific limits and content requirements: caption length, hashtag count, media support, link support, style, CTA style, requirements.

### MediaAsset

Original uploaded image/video metadata. Stores local path privately, public URL, MIME type, size, media type, and crop preview metadata. Original files are not recompressed.

### PublishJob

Queued/scheduled publishing work. Tracks connection, media, caption, status, scheduledAt, provider post id/url, errors, retry count, and attempts.

### PublishedPost

Stored only when an official connector returns real publish success. Keeps provider IDs/URLs, account snapshot, media, caption, and publishedAt.

### SocialMetricSnapshot

Metrics fetched from official APIs only. Source is always `real`.

### SocialComment

Comments fetched from official APIs only. Stores provider comment id, author, text, counts, and raw provider data.

### SocialReply

Replies created through the same connected platform account. Stores provider reply id and account snapshot.

## Legacy Models

`PlatformAccount` and `ScheduleJob` remain only for backward compatibility with older code paths. The active production-shaped flow uses `PlatformConnection`, `PublishJob`, and `PublishedPost`.
