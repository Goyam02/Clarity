/**
 * Typed API client for the CLARITY FastAPI backend (docs/api-contracts.md).
 *
 * Base: `${VITE_API_BASE_URL:-http://localhost:8000}/api/v1`.
 * Auth: `Authorization: Bearer <jwt>` (from POST /auth/register|login) or
 * `X-User-Id` fallback (local dev). All errors normalize to ApiError with the
 * backend's `{error: {code, message, request_id}}` shape.
 */
export const API_BASE_URL: string =
  (import.meta.env?.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ||
  'http://localhost:8000';

const TOKEN_KEY = 'clarity_auth_token';
const USER_ID_KEY = 'clarity_user_id';

export class ApiError extends Error {
  code: string;
  status: number;
  requestId?: string;

  constructor(status: number, code: string, message: string, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

// --- token / user-id session store -----------------------------------------

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function getUserId(): string | null {
  try {
    return localStorage.getItem(USER_ID_KEY);
  } catch {
    return null;
  }
}

export function setUserId(id: string | null): void {
  try {
    if (id) localStorage.setItem(USER_ID_KEY, id);
    else localStorage.removeItem(USER_ID_KEY);
  } catch {
    // ignore
  }
}

export function clearSession(): void {
  setToken(null);
  setUserId(null);
}

// --- core request helper ----------------------------------------------------

type Query = Record<string, string | number | boolean | undefined>;

function buildUrl(path: string, query?: Query): string {
  const url = `${API_BASE_URL}/api/v1${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined) params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT',
  path: string,
  opts: { body?: unknown; query?: Query; formData?: FormData } = {}
): Promise<T> {
  const headers: Record<string, string> = {};

  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const uid = getUserId();
  if (!token && uid) headers['X-User-Id'] = uid; // dev fallback

  let body: BodyInit | undefined;
  if (opts.formData) {
    body = opts.formData; // browser sets multipart boundary
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), { method, headers, body });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR',
      'Cannot reach the Clarity API. Is the backend running on :8000?');
  }

  if (!res.ok) {
    let code = 'REQUEST_FAILED';
    let message = `${res.status} ${res.statusText}`;
    let requestId: string | undefined;
    try {
      const data = await res.json();
      if (data?.error?.code) {
        code = data.error.code;
        message = data.error.message || message;
        requestId = data.error.request_id;
      } else if (typeof data?.detail === 'string') {
        message = data.detail;
      }
    } catch {
      // non-JSON body
    }
    throw new ApiError(res.status, code, message, requestId);
  }

  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, opts?: { query?: Query }) => request<T>('GET', path, opts),
  post: <T>(path: string, body?: unknown, opts?: { formData?: FormData }) =>
    request<T>('POST', path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
