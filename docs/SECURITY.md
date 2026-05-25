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
