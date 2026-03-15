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
