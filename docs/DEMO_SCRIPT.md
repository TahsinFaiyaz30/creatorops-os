# Demo Script

Use this script for a concise judge presentation.

## Demo Credentials

Editor:

```text
editor@creatorops.dev / password123
```

Creator/Admin:

```text
admin@creatorops.dev / password123
```

## Part 1: Problem Explanation

"Creator teams do not only need AI text generation. They need a workflow that moves ideas into platform-ready content with brand consistency, approval control, scheduling, and accountability. CreatorOps OS connects those steps in one end-to-end system."

## Part 2: Login As Editor

1. Open `http://localhost:3000`.
2. Click "Login as Editor".
3. Show the dashboard.
4. Point out the role badge and workflow event feed.

## Part 3: Create Campaign

1. Go to Campaigns.
2. Create a campaign.
3. Select:
   - instagram
   - linkedin
   - tiktok
   - youtube_shorts
4. Open the campaign detail page.

## Part 4: Create Brand Profile

1. Show the Brand Profile section.
2. Use or update:
   - brand name
   - tone
   - target audience
   - banned words
   - CTA style
3. Save the profile.

Talking point:

"The AI output is not generic. It is scored against brand rules and platform fit."

## Part 5: Create Content Idea

1. Add a title.
2. Add one raw content idea.
3. Save the idea.

Talking point:

"This starts from one idea, not four separate manual drafts."

## Part 6: AI Repurpose Into 4 Platform Variants

1. Click AI Repurpose.
2. Wait for generated cards.
3. Confirm four variants appear:
   - Instagram
   - LinkedIn
   - TikTok
   - YouTube Shorts

## Part 7: Show Scores, Provider, Warnings, Suggestions

For each variant, point out:

- platform
- caption
- hook
- CTA
- hashtags
- brand score
- readiness score
- warnings
- suggestions
- provider used
- status

Talking point:

"Gemini and Groq are optional. If no key exists or a provider fails, the backend still returns structured template fallback content."

## Part 8: Submit For Review

1. Choose one draft variant.
2. Click Submit for review.
3. Show that the variant status changes to `in_review`.
4. Show the workflow event.

## Part 9: Show Editor Blocked From Approval By Backend 403

1. Click "Try approve as Editor" if visible.
2. Show the UI message:
   - "Backend blocked this action: only Creator/Admin can approve."

Talking point:

"This is not just hidden UI. The backend rejects the action with RBAC."

## Part 10: Login As Admin

1. Logout.
2. Click "Login as Creator/Admin".
3. Open Approvals.

## Part 11: Approve One Variant

1. Show pending approval details.
2. Click Approve.
3. Show the recent decision and event feed.

## Part 12: Reject Or Request Changes On Other Variants

1. Submit more variants for review if needed.
2. As Creator/Admin, reject one variant.
3. Request changes on another variant.
4. Show statuses and comments.

Talking point:

"This models real collaboration, not just content generation."

## Part 13: Schedule Approved Variant

1. Use the Schedule panel on an approved variant.
2. Use the default scheduled time or pick a time.
3. Click Schedule.
4. Show job status as queued.

## Part 14: Run Publishing Simulator

1. Click Run now.
2. Show the job status becomes published.
3. Show the result message with the platform simulator adapter.

Talking point:

"No real social API is called. This safely demonstrates the backend publishing pipeline."

## Part 15: Show Live Workflow Events

1. Open Dashboard or stay on the current page.
2. Show event feed entries:
   - campaign.created
   - content.created
   - ai.variants_generated
   - approval.requested
   - approval.approved
   - schedule.created
   - schedule.processing
   - schedule.published

Talking point:

"Events persist first and broadcast second, so the audit trail exists even without a socket client."

## Part 16: Show Version History

1. Open the campaign detail page.
2. Click Version history.
3. Show snapshots for:
   - initial content
   - generated variants
   - approval
   - schedule
   - publish

## Part 17: Show Architecture Page

1. Open Architecture.
2. Walk through:
   - Next.js frontend
   - Express API
   - MongoDB
   - JWT auth
   - RBAC
   - AI fallback
   - approval service
   - scheduling worker
   - Socket.IO events

## Part 18: Closing Pitch

"CreatorOps OS is a workflow infrastructure layer for creator teams. It does not stop at AI generation. It connects content creation, platform adaptation, brand scoring, backend-enforced approval, scheduling, version history, and realtime accountability. That is the foundation a real creator operations product can grow from."
