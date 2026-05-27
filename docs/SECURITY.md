# Security

## Secrets

- `.env` files are ignored.
- API keys and social tokens are never printed in docs.
- Access tokens, refresh tokens, API secrets, and app passwords are encrypted at rest.
- Encrypted fields are excluded from normal Mongoose queries and stripped from JSON responses.

## Encryption

Set `ENCRYPTION_KEY` before connecting real accounts. The backend uses AES-256-GCM with a random IV for each value.

If `ENCRYPTION_KEY` is missing:

- OAuth start fails before token storage.
- OAuth callback fails safely.
- API/app-password connection creation fails safely.

Connected platform accounts are persisted server-side as encrypted delegated credentials. Tokens are never sent to the frontend. This is required for the same CreatorOps account to keep using a connected platform account from another browser or device without re-authorizing every time.

## OAuth State

OAuth state is:

- cryptographically random
- tied to user/workspace/platform
- expiry-bound
- consumed once
- stored server-side

## Social Passwords

CreatorOps OS never asks for real social platform passwords and never stores them. Users authenticate on official provider pages.

## Frontend Safety

The frontend receives only safe connection metadata: platform, account name/handle, status, scopes, expiry, health check fields, and capabilities. It never receives raw or encrypted credentials.

## Account Roles

Account capabilities come from the `roles` array. An account can have any combination of `content_creator`, `brand_rep`, and `admin`. Public signup can create one normal public role; later role changes require the `admin` role and go through admin-protected API routes.

## Brand Circulars And Statistics

Brand representative routes are backend-enforced by requiring `brand_rep` in the account roles. Brand representatives can manage only circulars in their workspace and only review applications for circulars they own.

Creator statistics are computed from stored real social metric snapshots. Missing followers, reach, impressions, growth, comments, or platform profile data remain unavailable instead of being fabricated. Application snapshots preserve their source so reviewers can tell whether data came from real sync or is unavailable.
