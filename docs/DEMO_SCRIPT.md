# Demo Script

## Credentials

Editor: `editor@creatorops.dev` / `password123`

Creator/Admin: `admin@creatorops.dev` / `password123`

## Part 1: Problem

Explain that creator teams need operational infrastructure, not just AI captions: platform adaptation, approval, account targeting, real publishing checks, and accountability.

## Part 2: Editor Flow

1. Login as Editor.
2. Open Campaigns.
3. Create a campaign with multiple platforms.
4. Open the campaign detail page.
5. Create or update the brand profile.
6. Create a content idea.
7. Click AI Repurpose.
8. Show platform variants, captions, hooks, CTAs, hashtags, scores, warnings, suggestions, and provider.
9. Submit one variant for review.
10. Try approval as Editor and show backend `403`.

## Part 3: Admin Approval

1. Logout and login as Creator/Admin.
2. Open Approvals.
3. Approve one variant.
4. Reject or request changes on another variant if available.
5. Open the campaign detail page and show version history.

## Part 4: Real Account Connections

1. Open Accounts.
2. Show all platform cards.
3. Explain required env vars/scopes/capabilities.
4. If credentials are empty, click Connect Account and show the honest not-configured/encryption message.
5. If credentials are configured, click Connect Account and redirect to the official platform OAuth page.
6. Emphasize there is no social password field and no simulated account form.

## Part 5: Compose

1. Open Compose.
2. Upload image/video or write a text-only status.
3. Show 9:16 preview by default.
4. Change aspect ratio or crop preview metadata.
5. Select connected real accounts if available.
6. Click Customize Captions with AI.
7. Show per-platform/account caption output.

## Part 6: Publishing

1. Click Publish Now or Schedule Later.
2. If no connection/permission exists, show blocked reason.
3. If a connector is fully configured and permitted, show real publish job moving to published only after official API success.
4. Open Publishing and show grouped jobs.
5. Show provider URL only if the API returned one.

## Part 7: Analytics And Replies

1. Open Analytics.
2. Show empty real-data state when nothing has been synced.
3. For a real published post, click Sync real data.
4. Show metrics/comments only if official APIs/scopes allow.
5. Reply to a comment as Creator/Admin through the same connected account.

## Part 8: Realtime And Architecture

1. Show live events updating after approval/publish/social actions.
2. Open Architecture.
3. Explain modular monolith, encrypted connections, connector registry, publish worker, social sync, and honest unavailable states.

## Closing Pitch

CreatorOps OS connects the full creator-team workflow while refusing to fake social outcomes. It is ready to plug into real platform credentials and platform review scopes.
