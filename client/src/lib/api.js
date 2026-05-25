import { clearSession, getToken } from './auth';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const normalizeError = async response => {
  let message = `Request failed with ${response.status}`;

  try {
    const payload = await response.json();
    message = payload.message || message;
  } catch (_error) {
    // Keep the generic message when the response is not JSON.
  }

  const error = new Error(message);
  error.status = response.status;
  return error;
};

export const apiFetch = async (path, options = {}) => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body
  });

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
  patch: (path, body) => apiFetch(path, { method: 'PATCH', body })
};
