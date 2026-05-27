# API

All application routes except OAuth callbacks require CreatorOps JWT auth. Role rules are enforced by the backend against the account's `roles` array.

## Roles

Accounts can have any combination of `content_creator`, `brand_rep`, and `admin`. Public signup creates one normal public role. Changing roles later is admin-only.

## Auth

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | Register a CreatorOps user |
| POST | `/api/auth/login` | Public | Login and receive JWT |
| GET | `/api/auth/me` | Auth | Return current user |

## Admin

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| GET | `/api/admin/users` | `admin` | List accounts and available roles |
| PATCH | `/api/admin/users/:id/roles` | `admin` | Replace an account's roles |

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
| POST | `/api/ai/script` | Auth | Send a conversational scripting prompt and receive structured script output |

Caption customization body:

```json
{
  "baseCaption": "Launch idea",
  "connectionIds": ["..."],
  "mediaAssetIds": ["..."]
}
```

## Creator Review

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| POST | `/api/approvals/request` | Auth | Queue a variant for creator review |
| GET | `/api/approvals/pending` | includes `content_creator` | Pending creator review queue |
| POST | `/api/approvals/:id/approve` | includes `content_creator` | Approve for publishing |
| POST | `/api/approvals/:id/reject` | includes `content_creator` | Reject from publishing |
| POST | `/api/approvals/:id/request-changes` | includes `content_creator` | Request changes before publishing |

## Platform Connections

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| GET | `/api/platform-connections` | Auth | Safe connection list; no tokens |
| GET | `/api/platform-connections/:id` | Auth | Safe connection metadata |
| GET | `/api/platform-connections/status` | Auth | Platform cards, configuration, capabilities, connections |
| GET | `/api/platform-connections/capabilities` | Auth | Connector requirements/capabilities |
| POST | `/api/platform-connections/:id/disconnect` | Auth | Mark disconnected |
| POST | `/api/platform-connections/:id/refresh` | Auth | Refresh token if connector supports it |
| POST | `/api/platform-connections/:id/health-check` | Auth | Connector health check |
| DELETE | `/api/platform-connections/:id` | Auth | Delete connection |

## OAuth

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| GET | `/api/oauth/:platform/start` | Auth | Create secure state and return official auth URL |
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
| POST | `/api/publish/validate` | includes `content_creator` or `brand_rep` | Validate connection, media, caption, scope, and connector capability |
| POST | `/api/publish/now` | includes `content_creator` or `brand_rep` | Queue and immediately process a real publish job |
| POST | `/api/publish/schedule` | includes `content_creator` or `brand_rep` | Queue a scheduled real publish job |
| GET | `/api/publish/jobs` | Auth | List publish jobs |
| GET | `/api/publish/jobs/:id` | Auth | Get one publish job |
| POST | `/api/publish/jobs/:id/pause` | includes `content_creator` or `brand_rep` | Pause queued job immediately or request pause for an active publishing job |
| POST | `/api/publish/jobs/:id/resume` | includes `content_creator` or `brand_rep` | Resume a paused publish job |
| POST | `/api/publish/jobs/:id/cancel` | includes `content_creator` or `brand_rep` | Cancel queued/paused/failed/blocked job immediately or request cancel for an active publishing job |
| POST | `/api/publish/jobs/:id/retry` | includes `content_creator` or `brand_rep` | Retry failed/blocked job |

Publish body:

```json
{
  "platformConnectionId": "...",
  "variantId": "...",
  "mediaAssetIds": ["..."],
  "caption": "Final caption",
  "visibility": "public",
  "scheduledAt": "2026-05-26T12:00:00.000Z"
}
```

Visibility values are `public`, `private`, and `friends_only`. The backend validates each value against connector/platform support and blocks unsupported settings honestly.

## Brand Circulars And Applications

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| POST | `/api/brand-circulars` | includes `brand_rep` | Create a brand representative circular |
| GET | `/api/brand-circulars` | Auth | List own circulars for brand reps or published circulars for creators |
| GET | `/api/brand-circulars/:id` | Auth | Get circular detail |
| PATCH | `/api/brand-circulars/:id` | includes `brand_rep` | Update own draft/published circular |
| POST | `/api/brand-circulars/:id/publish` | includes `brand_rep` | Publish own circular |
| POST | `/api/brand-circulars/:id/close` | includes `brand_rep` | Close own circular |
| POST | `/api/brand-circulars/:id/archive` | includes `brand_rep` | Archive own circular |
| POST | `/api/brand-circulars/:id/apply` | Auth | Creator applies to an open circular with stats snapshot |
| GET | `/api/brand-circulars/:id/applications` | includes `brand_rep` | List applications for own circular |
| GET | `/api/applications` | Auth | List applications relevant to the current user |
| POST | `/api/applications/:id/view-profile` | includes `brand_rep` | Mark profile viewed and notify creator |
| POST | `/api/applications/:id/shortlist` | includes `brand_rep` | Shortlist creator and notify creator |
| POST | `/api/applications/:id/reject` | includes `brand_rep` | Reject creator and notify creator |
| POST | `/api/applications/:id/accept` | includes `brand_rep` | Accept creator and notify creator |

## Statistics

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| GET | `/api/statistics/creator` | Auth | Combined and per-platform creator statistics from real synced data |
| POST | `/api/statistics/snapshot` | Auth | Save a statistics snapshot for application attachment |

## Scripts

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| GET | `/api/scripts` | Auth | List script conversations |
| GET | `/api/scripts/:id` | Auth | Get one script conversation |
| POST | `/api/scripts/:id/convert-to-content` | Auth | Convert final script into a campaign content item |

## Calendar And Notifications

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| GET | `/api/calendar/feed` | Auth | Scheduled posts, published posts, circular deadlines, applications, campaign milestones, workflow events |
| GET | `/api/notifications` | Auth | List current user notifications |
| POST | `/api/notifications/:id/read` | Auth | Mark one notification as read |

## Social

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| GET | `/api/social/post-groups` | Auth | Unified same-post groups across platform publish jobs/posts |
| GET | `/api/social/post-groups/:id` | Auth | Unified post details with combined totals, per-platform breakdown, comments, and optional `?platform=x` filter |
| POST | `/api/social/post-groups/:id/sync` | Auth | Sync real analytics/comments for every real published platform post in the group |
| GET | `/api/social/posts` | Auth | Real published posts |
| GET | `/api/social/posts/:id` | Auth | One published post |
| POST | `/api/social/posts/:id/sync` | Auth | Fetch analytics/comments via official connector |
| GET | `/api/social/posts/:id/metrics` | Auth | Stored real metric snapshots |
| GET | `/api/social/posts/:id/comments` | Auth | Stored real comments |
| POST | `/api/social/comments/:id/reply` | includes `content_creator` or `brand_rep` | Reply using the same connected account |
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
- `circular:application_submitted`
- `circular:application_updated`
- `notification:created`
- `notification:read`
- `calendar:updated`

## Legacy Schedule Route

`/api/schedule` remains only as a disabled legacy surface. It does not simulate success. Use `/api/publish/*`.
