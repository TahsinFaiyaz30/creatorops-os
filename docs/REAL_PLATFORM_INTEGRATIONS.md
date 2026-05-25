# Real Platform Integrations

CreatorOps OS uses official OAuth/API connector classes. Connectors expose required environment variables, scopes, capabilities, OAuth URL creation, token exchange, profile fetch, health check, publish, analytics, comments, and replies.

## Current Connectors

- Facebook Page: OAuth, Page profile, Page feed/photo publish, comments/reactions where permissions allow
- Instagram: Meta OAuth, professional account profile, media container publish, insights/comments where permissions allow
- TikTok: OAuth/profile, blocks publishing unless Content Posting API access is approved
- YouTube/Shorts: Google OAuth, channel profile, video upload, comments/replies where scopes allow
- Threads: OAuth/profile, text publish flow where API access allows
- LinkedIn: OAuth/profile, member text post with `w_member_social`
- X: OAuth 2.0 PKCE, user profile, post creation when API access allows
- Pinterest: OAuth/profile, pin creation when board metadata and scopes exist
- WordPress: REST API with application password
- Shopify: Admin API token for content/blog article drafts

## Missing Credentials

Empty env vars do not crash the app. Account cards show not configured, and publish validation blocks the action.

## No Fake Data

The connector layer does not fabricate provider post IDs, URLs, metrics, comments, replies, or success messages.
