/*
 * `API_ORIGIN` is a plain server-side variable, read when the rewrite is
 * evaluated rather than inlined into the bundle the way NEXT_PUBLIC_* is. That
 * difference is what matters for hosting: changing it and redeploying is
 * enough, and the browser only ever talks to its own origin, so there is no
 * CORS preflight and no mixed-content block between the page and the API.
 *
 * NEXT_PUBLIC_API_URL still wins when it is set — the client then calls the API
 * host directly and these rewrites go unused.
 */
const apiOrigin = (process.env.API_ORIGIN || process.env.NEXT_PUBLIC_API_URL || '')
  .trim()
  .replace(/\/+$/, '');

const nextConfig = {
  outputFileTracingRoot: process.cwd(),
  allowedDevOrigins: ['localhost', '127.0.0.1'],

  async rewrites() {
    if (!apiOrigin) return [];
    return [{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }];
  }
};

export default nextConfig;
