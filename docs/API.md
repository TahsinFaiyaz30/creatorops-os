# API

All application routes except OAuth callbacks require CreatorOps JWT auth. Role rules are enforced by the backend.

## Auth

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | Register a CreatorOps user |
| POST | `/api/auth/login` | Public | Login and receive JWT |
| GET | `/api/auth/me` | Auth | Return current user |

## Brand Profile

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| GET | `/api/brand-profile` | Auth | Get workspace brand profile |
| POST | `/api/brand-profile` | Auth | Create profile |
| PATCH | `/api/brand-profile` | Auth | Update profile |

## Campaigns

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| POST | `/api/campaigns` | Auth | Create campaign |
| GET | `/api/campaigns` | Auth | List campaigns |
| GET | `/api/campaigns/:id` | Auth | Get campaign |
| GET | `/api/campaigns/:id/tracking` | Auth | Real campaign tracking summary |
| GET | `/api/campaigns/:id/publish-summary` | Auth | Publish summary alias |

Supported platform values: `facebook`, `instagram`, `tiktok`, `youtube`, `youtube_shorts`, `threads`, `linkedin`, `x`, `pinterest`, `wordpress`, `shopify`.

## Content

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| POST | `/api/content` | Auth | Create content idea |
| GET | `/api/content/campaign/:campaignId` | Auth | List content for campaign |
| GET | `/api/content/:id/variants` | Auth | List variants for content |
| PATCH | `/api/content/:id` | Auth | Update content |
| PATCH | `/api/content/:id/status` | Auth | Change status with workflow validation |
| GET | `/api/content/:id/versions` | Auth | Version history |

## AI

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| POST | `/api/ai/repurpose` | Auth | Generate platform variants |
| POST | `/api/ai/optimize` | Auth | Optimize one variant |
| POST | `/api/ai/customize-captions` | Auth | Customize compose captions per selected real connection |

Caption customization body:

```json
{
  "baseCaption": "Launch idea",
  "connectionIds": ["..."],
  "mediaAssetIds": ["..."]
}
```

## Approvals

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| POST | `/api/approvals/request` | Auth | Request review for a variant |
| GET | `/api/approvals/pending` | `creator_admin` | Pending queue |
| POST | `/api/approvals/:id/approve` | `creator_admin` | Approve |
| POST | `/api/approvals/:id/reject` | `creator_admin` | Reject |
| POST | `/api/approvals/:id/request-changes` | `creator_admin` | Request changes |

## Platform Connections

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| GET | `/api/platform-connections` | Auth | Safe connection list; no tokens |
| GET | `/api/platform-connections/:id` | Auth | Safe connection metadata |
| GET | `/api/platform-connections/status` | Auth | Platform cards, configuration, capabilities, connections |
| GET | `/api/platform-connections/capabilities` | Auth | Connector requirements/capabilities |
| POST | `/api/platform-connections/:id/disconnect` | `creator_admin` | Mark disconnected |
| POST | `/api/platform-connections/:id/refresh` | `creator_admin` | Refresh token if connector supports it |
| POST | `/api/platform-connections/:id/health-check` | `creator_admin` | Connector health check |
| DELETE | `/api/platform-connections/:id` | `creator_admin` | Delete connection |

## OAuth

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| GET | `/api/oauth/:platform/start` | `creator_admin` | Create secure state and return official auth URL |
| GET | `/api/oauth/:platform/callback` | OAuth state | Exchange callback code and store encrypted tokens |

Callbacks do not require JWT because secure state restores user/workspace/platform context.

## Media

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| POST | `/api/media/upload` | Auth | Upload original image/video with multipart field `media` |
| GET | `/api/media` | Auth | List media |
| GET | `/api/media/:id` | Auth | Get media metadata |
| PATCH | `/api/media/:id` | Auth | Update crop preview metadata |
| DELETE | `/api/media/:id` | Auth | Delete media and local file |

Original files are stored without recompression. Crop settings are preview metadata.

## Publish

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| POST | `/api/publish/validate` | `creator_admin` | Validate connection, media, caption, scope, and connector capability |
| POST | `/api/publish/now` | `creator_admin` | Queue and immediately process a real publish job |
| POST | `/api/publish/schedule` | `creator_admin` | Queue a scheduled real publish job |
| GET | `/api/publish/jobs` | Auth | List publish jobs |
| GET | `/api/publish/jobs/:id` | Auth | Get one publish job |
| POST | `/api/publish/jobs/:id/cancel` | `creator_admin` | Cancel allowed job |
| POST | `/api/publish/jobs/:id/retry` | `creator_admin` | Retry failed/blocked job |

Publish body:

```json
{
  "platformConnectionId": "...",
  "variantId": "...",
  "mediaAssetIds": ["..."],
  "caption": "Final caption",
  "scheduledAt": "2026-05-26T12:00:00.000Z"
}
```

## Social

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| GET | `/api/social/post-groups` | Auth | Unified same-post groups across platform publish jobs/posts |
| GET | `/api/social/post-groups/:id` | Auth | Unified post details with combined totals, per-platform breakdown, comments, and optional `?platform=x` filter |
| POST | `/api/social/post-groups/:id/sync` | `creator_admin` | Sync real analytics/comments for every real published platform post in the group |
| GET | `/api/social/posts` | Auth | Real published posts |
| GET | `/api/social/posts/:id` | Auth | One published post |
| POST | `/api/social/posts/:id/sync` | `creator_admin` | Fetch analytics/comments via official connector |
| GET | `/api/social/posts/:id/metrics` | Auth | Stored real metric snapshots |
| GET | `/api/social/posts/:id/comments` | Auth | Stored real comments |
| POST | `/api/social/comments/:id/reply` | `creator_admin` | Reply using the same connected account |
| GET | `/api/social/analytics/summary` | Auth | Aggregate stored real data |

## Events

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| GET | `/api/events` | Auth | Persisted workflow events |

Realtime events:

- `workflow:event`
- `publishing:job_updated`
- `social:metrics_updated`
- `social:comments_synced`
- `social:reply_created`

## Legacy Schedule Route

`/api/schedule` remains only as a disabled legacy surface. It does not simulate success. Use `/api/publish/*`.
