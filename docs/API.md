# API Reference

Base URL:

```text
http://localhost:5000
```

Protected routes require:

```http
Authorization: Bearer <jwt>
```

Most responses use:

```json
{
  "data": {}
}
```

## Auth

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| POST | `/api/auth/register` | No | None | Create a user. Mainly useful for development. |
| POST | `/api/auth/login` | No | None | Login and receive a JWT. |
| GET | `/api/auth/me` | Yes | Any | Return the current authenticated user. |

Example login:

```json
{
  "email": "editor@creatorops.dev",
  "password": "password123"
}
```

## Brand Profile

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/api/brand-profile` | Yes | Any | Get the workspace brand profile. |
| POST | `/api/brand-profile` | Yes | Any | Create the workspace brand profile. |
| PATCH | `/api/brand-profile` | Yes | Any | Update brand profile fields. |

Example body:

```json
{
  "brandName": "CodeSprint Academy",
  "tone": "friendly, confident, educational",
  "targetAudience": "beginner programmers and university students",
  "bannedWords": ["guaranteed income", "easy money"],
  "ctaStyle": "clear, motivational, action-focused",
  "preferredPlatforms": ["facebook", "instagram", "tiktok", "youtube", "youtube_shorts", "threads", "linkedin", "x", "pinterest", "blog", "shopify"]
}
```

## Campaigns

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| POST | `/api/campaigns` | Yes | Any | Create a campaign. |
| GET | `/api/campaigns` | Yes | Any | List workspace campaigns. |
| GET | `/api/campaigns/:id/tracking` | Yes | Any | Return campaign content, variant, schedule, account, platform, event, and publish summary counts. |
| GET | `/api/campaigns/:id/publish-summary` | Yes | Any | Alias for the campaign tracking summary. |
| GET | `/api/campaigns/:id` | Yes | Any | Get one workspace campaign. |

Example body:

```json
{
  "name": "Launch Week",
  "goal": "Show the complete creator operations workflow",
  "targetAudience": "hackathon judges and creator team leads",
  "platforms": ["facebook", "instagram", "tiktok", "youtube", "youtube_shorts", "threads", "linkedin", "x", "pinterest", "blog", "shopify"]
}
```

Supported platform values:

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

## Content

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| POST | `/api/content` | Yes | Any | Create a raw content idea. |
| GET | `/api/content/campaign/:campaignId` | Yes | Any | List content items for a campaign. |
| PATCH | `/api/content/:id` | Yes | Any | Update content title/raw idea and create version history. |
| PATCH | `/api/content/:id/status` | Yes | Role rules | Change content status with backend transition validation. |
| GET | `/api/content/:id/versions` | Yes | Any | List content and variant version snapshots. |
| GET | `/api/content/:id/variants` | Yes | Any | List generated platform variants for a content item. |

Example create body:

```json
{
  "campaignId": "campaign_id_here",
  "title": "One idea to multi-platform variants",
  "rawIdea": "Show how CreatorOps OS turns one raw idea into platform-specific content, approval, and scheduling."
}
```

Example status body:

```json
{
  "status": "in_review",
  "changeNote": "Ready for review"
}
```

Status transition rules:

- Editor: `idea -> draft`, `draft -> in_review`, `changes_requested -> draft`
- Creator/Admin: `in_review -> approved`, `in_review -> rejected`, `in_review -> changes_requested`, `approved -> scheduled`, `scheduled -> published`

## AI

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| POST | `/api/ai/repurpose` | Yes | Any | Generate or update platform variants for a content item. |
| POST | `/api/ai/optimize` | Yes | Any | Improve one existing platform variant. |

Example repurpose body:

```json
{
  "contentItemId": "content_item_id_here"
}
```

Example optimize body:

```json
{
  "variantId": "variant_id_here",
  "changeNote": "Make the hook stronger"
}
```

Generated variant fields include:

- `platform`
- `caption`
- `hook`
- `cta`
- `hashtags`
- `brandScore`
- `readinessScore`
- `warnings`
- `suggestions`
- `aiProvider`
- `status`

The API always returns valid structured output by falling back to template generation when optional providers fail or keys are missing.

## Platform Accounts

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| POST | `/api/platform-accounts` | Yes | `creator_admin` | Create a simulated connected platform account. |
| GET | `/api/platform-accounts` | Yes | Any | List workspace platform accounts. |
| GET | `/api/platform-accounts/:id` | Yes | Any | Get one workspace platform account. |
| PATCH | `/api/platform-accounts/:id` | Yes | `creator_admin` | Update a simulated platform account. |
| DELETE | `/api/platform-accounts/:id` | Yes | `creator_admin` | Soft-delete by setting `isActive=false`. |

Example create body:

```json
{
  "platform": "instagram",
  "accountName": "CodeSprint Instagram",
  "accountHandle": "@codesprint_main",
  "accountType": "brand",
  "status": "connected"
}
```

Optional list filters:

```text
/api/platform-accounts?platform=instagram&status=connected&active=true
```

No OAuth tokens or secrets are stored. These records are local simulator targets.

## Platform Formats

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/api/platform-formats` | Yes | Any | List platform formatting rules. |
| GET | `/api/platform-formats/:platform` | Yes | Any | Get one platform formatting rule. |

Format rules include caption limits, hashtag limits, supported media flags, content style, CTA style, and requirements.

## Approvals

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| POST | `/api/approvals/request` | Yes | Any | Submit a draft variant for review. |
| GET | `/api/approvals/pending` | Yes | `creator_admin` | List pending approval requests. |
| POST | `/api/approvals/:id/approve` | Yes | `creator_admin` | Approve a pending request. |
| POST | `/api/approvals/:id/reject` | Yes | `creator_admin` | Reject a pending request. |
| POST | `/api/approvals/:id/request-changes` | Yes | `creator_admin` | Request changes on a pending request. |

Example request body:

```json
{
  "variantId": "variant_id_here",
  "comment": "Ready for review"
}
```

Example decision body:

```json
{
  "comment": "Approved"
}
```

Editors receive `403` if they try to approve, reject, or request changes as reviewer.

## Schedule

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| POST | `/api/schedule` | Yes | `creator_admin` | Schedule an approved platform variant. |
| GET | `/api/schedule` | Yes | Any | List workspace schedule jobs. |
| POST | `/api/schedule/:id/run-now` | Yes | `creator_admin` | Run the publishing simulator immediately. |

Example schedule body:

```json
{
  "variantId": "variant_id_here",
  "platformAccountId": "platform_account_id_here",
  "scheduledAt": "2026-05-25T06:30:00.000Z"
}
```

Only approved variants can be scheduled. Editors receive `403` if they try to schedule or run the simulator.

`platformAccountId` is optional only when exactly one active connected matching account exists. If there are multiple matching accounts, the backend returns `400` and requires a target account. If the selected account platform does not match the variant platform, the backend returns `400`.

## Events

| Method | Path | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/api/events` | Yes | Any | List persisted workflow events for the current workspace. |

Optional query:

```text
/api/events?limit=30
```

Realtime event name:

```text
workflow:event
```

Events are persisted before Socket.IO broadcast.
