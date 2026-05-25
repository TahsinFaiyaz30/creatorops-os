# Database Design

CreatorOps OS uses MongoDB with Mongoose models. All operational records are scoped by `workspaceId` so teams cannot access another workspace's data.

## User

Purpose:

Stores authenticated users and their role.

Important fields:

- `name`
- `email`
- `passwordHash`
- `role`
- `workspaceId`

Relationships:

- Belongs to one `Workspace`
- Can create `Campaign`, `ContentItem`, `ApprovalRequest`, `ScheduleJob`, `ContentVersion`, and `WorkflowEvent` records

Notes:

- `email` is unique
- Passwords are hashed before save
- Roles are `editor` and `creator_admin`

## Workspace

Purpose:

Represents the tenant boundary for a creator team.

Important fields:

- `name`
- `ownerId`

Relationships:

- Owns brand profiles, campaigns, content, variants, approvals, schedules, versions, and events
- Owner references `User`

## BrandProfile

Purpose:

Stores brand guidance used by the AI service and scoring logic.

Important fields:

- `workspaceId`
- `brandName`
- `tone`
- `targetAudience`
- `bannedWords`
- `ctaStyle`
- `preferredPlatforms`

Relationships:

- Belongs to one `Workspace`
- Used when generating or optimizing `PlatformVariant` records

## Campaign

Purpose:

Groups content work around a goal, audience, and selected platforms.

Important fields:

- `workspaceId`
- `name`
- `goal`
- `targetAudience`
- `platforms`
- `status`
- `createdBy`

Relationships:

- Belongs to one `Workspace`
- Created by a `User`
- Has many `ContentItem` and `PlatformVariant` records

Indexes:

- `workspaceId`
- `status`
- `createdBy`

## ContentItem

Purpose:

Stores the raw idea and workflow status for content.

Important fields:

- `workspaceId`
- `campaignId`
- `title`
- `rawIdea`
- `status`
- `createdBy`
- `assignedTo`
- `currentVersion`

Relationships:

- Belongs to one `Workspace`
- Belongs to one `Campaign`
- Created by a `User`
- Has many `PlatformVariant` records
- Has many `ContentVersion` snapshots

Statuses:

- `idea`
- `draft`
- `in_review`
- `approved`
- `scheduled`
- `published`
- `rejected`
- `changes_requested`

Indexes:

- `workspaceId`
- `campaignId`
- `status`
- `createdAt`

## PlatformVariant

Purpose:

Stores platform-specific generated content.

Important fields:

- `workspaceId`
- `campaignId`
- `contentItemId`
- `platform`
- `caption`
- `hook`
- `cta`
- `hashtags`
- `brandScore`
- `readinessScore`
- `warnings`
- `suggestions`
- `status`
- `aiProvider`

Relationships:

- Belongs to one `Workspace`
- Belongs to one `Campaign`
- Belongs to one `ContentItem`
- Can have approval requests
- Can have schedule jobs
- Can have version snapshots

Supported platforms:

- `facebook`
- `instagram`
- `tiktok`
- `youtube`
- `youtube_shorts`
- `threads`
- `linkedin`
- `x`
- `pinterest`
- `blog`
- `shopify`

Indexes:

- `workspaceId`
- `campaignId`
- `contentItemId`
- `status`
- `platform`

## ContentVersion

Purpose:

Stores immutable snapshots for content and variant history.

Important fields:

- `workspaceId`
- `contentItemId`
- `variantId`
- `versionNumber`
- `snapshot`
- `changedBy`
- `changeNote`
- `createdAt`

Relationships:

- Belongs to one `Workspace`
- Belongs to one `ContentItem`
- Optionally belongs to one `PlatformVariant`
- Created by a `User`

Used for:

- initial content creation
- content updates
- AI generated variants
- optimized variants
- approval decisions
- scheduling
- publishing simulation

## ApprovalRequest

Purpose:

Tracks review requests and creator/admin decisions.

Important fields:

- `workspaceId`
- `contentItemId`
- `variantId`
- `requestedBy`
- `reviewedBy`
- `status`
- `comment`

Relationships:

- Belongs to one `Workspace`
- References one `ContentItem`
- References one `PlatformVariant`
- Requested by a `User`
- Reviewed by a `User`

Statuses:

- `pending`
- `approved`
- `rejected`
- `changes_requested`

Indexes:

- `workspaceId`
- `status`
- `requestedBy`
- `reviewedBy`
- `workspaceId`, `variantId`, `status`

## ScheduleJob

Purpose:

Represents a queued or completed publishing simulator job.

Important fields:

- `workspaceId`
- `contentItemId`
- `variantId`
- `platformAccountId`
- `platformAccountSnapshot`
- `platform`
- `scheduledAt`
- `status`
- `adapterName`
- `resultMessage`
- `createdBy`

Relationships:

- Belongs to one `Workspace`
- References one `ContentItem`
- References one `PlatformVariant`
- References one simulated `PlatformAccount`
- Created by a `User`

Statuses:

- `queued`
- `processing`
- `published`
- `failed`
- `cancelled`

Indexes:

- `workspaceId`
- `status`
- `scheduledAt`
- `platformAccountId`

## PlatformAccount

Purpose:

Stores simulated connected platform account profiles for local MVP publishing targets. No OAuth tokens or external API secrets are stored.

Important fields:

- `workspaceId`
- `platform`
- `accountName`
- `accountHandle`
- `accountType`
- `status`
- `isActive`
- `createdBy`

Relationships:

- Belongs to one `Workspace`
- Created by a `User`
- Can be referenced by `ScheduleJob`

Supported account types:

- `brand`
- `creator`
- `client`
- `page`
- `shop`
- `blog`

Statuses:

- `connected`
- `disconnected`
- `expired`
- `missing_permissions`
- `blocked`

Indexes:

- `workspaceId`
- `platform`
- `status`
- `isActive`
- unique `workspaceId`, `platform`, `accountHandle`

## PlatformFormatRule

Purpose:

Stores platform-specific content rules used by frontend readiness checklists and future optimization workflows.

Important fields:

- `platform`
- `displayName`
- `maxCaptionLength`
- `maxHashtags`
- `recommendedHashtags`
- `supportsLongText`
- `supportsShortVideo`
- `supportsImage`
- `supportsLinks`
- `contentStyle`
- `ctaStyle`
- `requirements`

Relationships:

- Referenced by platform value
- Used by generated `PlatformVariant` UI checks

## WorkflowEvent

Purpose:

Stores the persistent event stream used by the dashboard and realtime feed.

Important fields:

- `workspaceId`
- `actorId`
- `eventType`
- `message`
- `entityType`
- `entityId`
- `metadata`
- `createdAt`

Relationships:

- Belongs to one `Workspace`
- Actor references `User`
- Entity can reference workflow records by type/id

Indexes:

- `workspaceId`
- `createdAt`
- `eventType`

Example event types:

- `brand_profile.created`
- `campaign.created`
- `content.created`
- `ai.variants_generated`
- `approval.requested`
- `approval.approved`
- `schedule.created`
- `schedule.processing`
- `schedule.published`
