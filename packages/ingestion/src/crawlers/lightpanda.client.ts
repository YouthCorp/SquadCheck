/**
 * LightPanda browser client.
 *
 * Uses the @lightpanda/browser native `fetch` API to render JavaScript-heavy
 * pages and return the final HTML. Falls back to axios (static HTML) when:
 *   - LightPanda binary is unavailable (e.g., Windows dev environment)
 *   - LightPanda fetch fails for a specific URL
 *
 * Railway (Linux) → LightPanda binary downloaded automatically by postinstall.
 * Local Windows → axios fallback (static HTML only, no JS execution).
 */

import axios from 'axios';

const USER_AGENT = 'SquadCheck/1.0 (injury tracking bot)';
const DEFAULT_TIMEOUT_MS = 20_000;

// Lazily resolve the LightPanda fetch function — avoids crashing on import
// when the binary is unavailable.
let lpFetch: ((url: string, opts?: Record<string, unknown>) => Promise<Buffer | string>) | null = null;

function getLightPandaFetch() {
  if (lpFetch !== undefined) return lpFetch;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { lightpanda } = require('@lightpanda/browser');
    lpFetch = lightpanda.fetch ?? null;
  } catch {
    lpFetch = null;
  }
  return lpFetch;
}

/**
 * Fetches a URL using LightPanda (full JS rendering) with axios fallback.
 * Returns the rendered HTML as a string.
 */
export async function fetchPageHtml(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ html: string; renderedByJs: boolean }> {
  const fetch = getLightPandaFetch();

  if (fetch) {
    try {
      const result = await Promise.race([
        fetch(url, { dump: true, dumpOptions: { type: 'html' } }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('LightPanda timeout')), timeoutMs),
        ),
      ]);
      return { html: result.toString(), renderedByJs: true };
    } catch (err) {
      console.warn(`[LightPanda] fetch failed for ${url}, falling back to axios:`, (err as Error).message);
    }
  }

  // Axios fallback
  const response = await axios.get<string>(url, {
    headers: { 'User-Agent': USER_AGENT },
    timeout: timeoutMs,
    responseType: 'text',
  });
  return { html: response.data, renderedByJs: false };
}
