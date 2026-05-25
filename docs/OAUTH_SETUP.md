# OAuth Setup

Copy `server/.env.example` to `server/.env` and fill only the platforms you want to test. Never commit `.env`.

Required for any real connection:

```env
ENCRYPTION_KEY=replace_with_long_random_secret_or_64_hex_chars
PUBLIC_BASE_URL=http://localhost:5000
CLIENT_URL=http://localhost:3000
CLIENT_URLS=http://localhost:3000,http://127.0.0.1:3000
```

## Redirect URIs

Use the redirect URI shown in `.env.example` for each provider:

- Facebook: `http://localhost:5000/api/oauth/facebook/callback`
- Instagram: `http://localhost:5000/api/oauth/instagram/callback`
- Threads: `http://localhost:5000/api/oauth/threads/callback`
- TikTok: `http://localhost:5000/api/oauth/tiktok/callback`
- Google/YouTube: `http://localhost:5000/api/oauth/google/callback`
- LinkedIn: `http://localhost:5000/api/oauth/linkedin/callback`
- X: `http://127.0.0.1:5000/api/oauth/x/callback`
- Pinterest: `http://localhost:5000/api/oauth/pinterest/callback`
- Shopify OAuth: `http://localhost:5000/api/oauth/shopify/callback`

## Google / YouTube Local Testing

1. Open Google Auth Platform.
2. Go to Audience -> Test users.
3. Add the exact Google account used for OAuth testing.
4. Go to Clients -> OAuth web client.
5. Add Authorized JavaScript origin: `http://localhost:3000`.
6. Add Authorized redirect URI: `http://localhost:5000/api/oauth/google/callback`.
7. Enable YouTube Data API v3 for the Google Cloud project.
8. Set:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:5000/api/oauth/google/callback
```

Google testing-mode apps show "Access blocked" unless the signed-in Google account is added as a test user. The redirect URI must match exactly, including host, protocol, path, and port.

One Google OAuth connection is stored as platform `youtube` and is reused by the YouTube Shorts card. YouTube Shorts does not require a second Google OAuth connection.

YouTube metrics sync uses the YouTube Data API `videos.list` statistics part for real counts. It can populate views, likes/reactions, and comment count after a real provider video id exists. Shares and saves are not exposed by that endpoint, so CreatorOps leaves them at zero/unavailable instead of faking them.

For YouTube comments and replies, add these OAuth scopes in Google Auth Platform -> Data Access and reconnect the YouTube account from CreatorOps:

- `https://www.googleapis.com/auth/youtube.readonly`
- `https://www.googleapis.com/auth/youtube.upload`
- `https://www.googleapis.com/auth/youtube.force-ssl`

Adding a scope in Google Cloud does not update an already-saved OAuth token. After changing scopes, go back to CreatorOps -> Accounts and connect YouTube again so Google issues a new token with the new grant. The Accounts page shows missing granted scopes when an existing connection needs reconnecting.

CreatorOps syncs top-level YouTube comments with `commentThreads.list`. For replies under those comments, it calls `comments.list` with the top-level comment id as `parentId`. If replies still do not appear, check that the latest YouTube connection includes `youtube.force-ssl` and that the video actually has public replies returned by the YouTube Data API.

For full `127.0.0.1` frontend testing, `client/.env` can use:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:5000
NEXT_PUBLIC_SOCKET_URL=http://127.0.0.1:5000
```

Keep Google's redirect URI on `localhost` unless that exact `127.0.0.1` redirect URI is also configured in Google Cloud.

## X Local Testing

X OAuth 2.0 requires the callback URL in the authorization request to exactly match a Callback URI saved in the X Developer Portal app settings. For local development, use `127.0.0.1` rather than `localhost`.

In the X Developer Portal:

1. Open the app used by `X_CLIENT_ID` and `X_CLIENT_SECRET`.
2. Enable OAuth 2.0 / User authentication settings.
3. Set the app/client type to a web or confidential client when using the backend token exchange.
4. Add this Callback URI exactly:

```text
http://127.0.0.1:5000/api/oauth/x/callback
```

5. Make sure the app has read/write permissions if requesting `tweet.write`.
6. Add `media.write` permission/scope if you want image posts from Compose.
7. Restart the backend after editing `server/.env`.

`X_REDIRECT_URI` should match the portal value exactly:

```env
X_REDIRECT_URI=http://127.0.0.1:5000/api/oauth/x/callback
```

If X stays on the consent page or shows a provider-side error instead of returning to CreatorOps, check the exact Callback URI, OAuth 2.0 settings, app permissions, and whether the X app has access to the requested scopes.

For image publishing, reconnect the X account after enabling `media.write`; older X connections that only granted `tweet.read tweet.write users.read offline.access` can still validate text-only posts but will block image posts honestly.

If publishing returns HTTP 402, X is rejecting the write request because the developer app does not have the required API credits/billing access for write operations. CreatorOps will mark that job as blocked and will not fake a successful post.

## WordPress

WordPress uses REST API application passwords configured server-side:

```env
WORDPRESS_BASE_URL=
WORDPRESS_USERNAME=
WORDPRESS_APP_PASSWORD=
```

No WordPress password is entered in the browser.

## Shopify

For local Admin API testing:

```env
SHOPIFY_SHOP_DOMAIN=
SHOPIFY_ADMIN_ACCESS_TOKEN=
```

OAuth app credentials are optional if building a Shopify public/custom app.

## Platform Review

Some features require developer review, product access, or paid/API-tier permissions. CreatorOps OS reports those states honestly and blocks unsupported actions.
