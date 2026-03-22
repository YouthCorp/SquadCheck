const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const fetchCacheOption: RequestInit = { cache: 'no-store' };

export async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, fetchCacheOption);
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchApiClient<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

// Auth-aware fetch for watchlist endpoints (client-side only).
// Reads the NextAuth session token from the cookie via the built-in
// /api/auth/session endpoint so it works without exposing the raw JWT.
export async function fetchApiAuth<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  // Fetch session to get the access token (next-auth stores it in a cookie)
  const sessionRes = await fetch('/api/auth/session');
  const session = sessionRes.ok ? await sessionRes.json() : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (session?.accessToken) {
    headers['Authorization'] = `Bearer ${session.accessToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 204) return undefined as T;
  if (res.status === 401) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error ?? `API error: ${res.status}`), { status: res.status, body });
  }
  return res.json();
}
