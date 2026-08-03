import { clearSession, getToken } from './auth';

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * Service URL resolution.
 *
 * NEXT_PUBLIC_* values are inlined at BUILD time, and client/.env is gitignored.
 * A hosted build made without NEXT_PUBLIC_API_URL therefore baked in
 * `http://localhost:5000`, so every request from the deployed site was aimed at
 * the *visitor's own machine*: the marketing page rendered fine and sign-in and
 * every authenticated page failed. Setting the variable later in the host's
 * dashboard also does nothing until the project is rebuilt, which is easy to
 * miss.
 *
 * So: off localhost we no longer guess localhost. We fall back to the page's own
 * origin and let the `/api/:path*` rewrite in next.config.mjs proxy through to
 * the backend. That rewrite reads a plain (non-NEXT_PUBLIC) env var at runtime,
 * and because the browser then only ever talks to its own origin it also removes
 * CORS and mixed-content from the equation.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0']);

const stripTrailingSlash = value => String(value || '').trim().replace(/\/+$/, '');

export const resolveServiceUrl = configured => {
  const explicit = stripTrailingSlash(configured);
  if (explicit) return explicit;
  if (typeof window === 'undefined') return '';
  /* Local dev without an .env still gets the usual backend port. */
  return LOCAL_HOSTS.has(window.location.hostname) ? 'http://localhost:5000' : '';
};

export const API_URL = resolveServiceUrl(process.env.NEXT_PUBLIC_API_URL);

/* Same-origin means requests ride the rewrite proxy rather than hitting the API
   host directly, which is what a hosted deployment should be doing. */
export const usesApiProxy = API_URL === '';

const CONFIG_HINT =
  'The API is not reachable. Set NEXT_PUBLIC_API_URL to the backend URL, or set API_ORIGIN so the /api proxy can forward to it, then redeploy.';

const normalizeError = async response => {
  let message = `Request failed with ${response.status}`;

  try {
    const payload = await response.json();
    message = payload.message || message;
  } catch (_error) {
    /*
     * A non-JSON 404 on an /api path means the request was answered by Next
     * itself, not the backend — i.e. the rewrite proxy is not configured. That
     * used to surface as a bare "Request failed with 404".
     */
    if (response.status === 404 && usesApiProxy) {
      message = CONFIG_HINT;
    }
  }

  const error = new Error(message);
  error.status = response.status;
  return error;
};

export const apiFetch = async (path, options = {}) => {
  const token = getToken();
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const isRawBody = Boolean(options.rawBody);
  const headers = {
    ...(isFormData || isRawBody ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      body:
        options.body && !isFormData && !isRawBody && typeof options.body !== 'string'
          ? JSON.stringify(options.body)
          : options.body
    });
  } catch (cause) {
    /* fetch only rejects on network-level failure, which otherwise reached the
       UI as an unactionable "Failed to fetch" / "Load failed". */
    const error = new Error(CONFIG_HINT);
    error.status = 0;
    error.cause = cause;
    throw error;
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
    }
    throw await normalizeError(response);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
};

export const api = {
  get: path => apiFetch(path),
  post: (path, body) => apiFetch(path, { method: 'POST', body }),
  patch: (path, body) => apiFetch(path, { method: 'PATCH', body }),
  raw: (path, body, options = {}) => apiFetch(path, { ...options, method: options.method || 'POST', body, rawBody: true }),
  delete: path => apiFetch(path, { method: 'DELETE' })
};
