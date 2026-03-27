/**
 * Sitemap-based article URL discovery for EPL club websites.
 *
 * Attempts to find articles via XML sitemaps (Google News sitemap,
 * standard sitemap, sitemap index, robots.txt) before falling back.
 * Avoids JS-rendered listing pages — sitemaps are static XML.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { isLikelyArticlePath } from './club-news.parser';

const HTTP_HEADERS = {
  'User-Agent': 'SquadCheck/1.0 (injury tracking bot)',
};
const TIMEOUT_MS = 15_000;
const MAX_URLS = 20;
const DEFAULT_MAX_AGE_DAYS = 7;

/** Keywords used to identify news/article child sitemaps inside a sitemap index */
const NEWS_SITEMAP_KEYWORDS = ['news', 'article', 'post'];

export interface DiscoverOptions {
  maxAgeDays?: number;
}

interface DatedUrl {
  url: string;
  date: Date | null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Discovers recent article URLs from an EPL club website using XML sitemaps.
 *
 * Tries the following discovery chain in order, stopping at the first success:
 *  1. `<origin>/sitemap-news.xml`  (Google News sitemap)
 *  2. `<origin>/sitemap.xml`       (standard sitemap or sitemap index)
 *  3. `<origin>/sitemap_index.xml` (alternative naming)
 *  4. `<origin>/robots.txt`        → parses `Sitemap:` directives
 *
 * @param baseUrl   Any URL on the club domain (only the origin is used).
 * @param options   Optional: `maxAgeDays` (default 7).
 * @returns         Up to 20 article URLs sorted newest-first.
 */
export async function discoverArticleUrls(
  baseUrl: string,
  options: DiscoverOptions = {},
): Promise<string[]> {
  const maxAgeDays = options.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS;
  const origin = new URL(baseUrl).origin;

  const candidates = [
    `${origin}/sitemap-news.xml`,
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
  ];

  // Try each candidate sitemap URL in order
  for (const sitemapUrl of candidates) {
    const xml = await fetchXml(sitemapUrl);
    if (!xml) continue;

    console.log(`[Sitemap] Found sitemap at ${sitemapUrl}`);
    const urls = await extractArticleUrlsFromXml(xml, sitemapUrl, origin, maxAgeDays);
    if (urls.length > 0) {
      console.log(`[Sitemap] Found ${urls.length} article URLs from ${sitemapUrl}`);
      return urls;
    }
  }

  // Fallback: parse robots.txt for Sitemap: directives
  const robotsSitemaps = await discoverViRobotsTxt(origin);
  for (const sitemapUrl of robotsSitemaps) {
    const xml = await fetchXml(sitemapUrl);
    if (!xml) continue;

    console.log(`[Sitemap] Found sitemap via robots.txt: ${sitemapUrl}`);
    const urls = await extractArticleUrlsFromXml(xml, sitemapUrl, origin, maxAgeDays);
    if (urls.length > 0) {
      console.log(`[Sitemap] Found ${urls.length} article URLs from ${sitemapUrl}`);
      return urls;
    }
  }

  console.log(`[Sitemap] No article URLs found for ${origin}`);
  return [];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Fetches a URL and returns the response body as a string.
 * Returns null on any HTTP or network error.
 */
async function fetchXml(url: string): Promise<string | null> {
  try {
    const res = await axios.get<string>(url, {
      headers: HTTP_HEADERS,
      timeout: TIMEOUT_MS,
      responseType: 'text',
      // Don't throw on 4xx/5xx — we check status ourselves
      validateStatus: () => true,
    });
    if (res.status < 200 || res.status >= 300) {
      return null;
    }
    return res.data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[Sitemap] Fetch error for ${url}: ${msg}`);
    return null;
  }
}

/**
 * Parses robots.txt and returns any `Sitemap:` directive URLs.
 */
async function discoverViRobotsTxt(origin: string): Promise<string[]> {
  const robotsUrl = `${origin}/robots.txt`;
  try {
    const res = await axios.get<string>(robotsUrl, {
      headers: HTTP_HEADERS,
      timeout: TIMEOUT_MS,
      responseType: 'text',
      validateStatus: () => true,
    });
    if (res.status < 200 || res.status >= 300) return [];

    const sitemaps: string[] = [];
    for (const line of res.data.split('\n')) {
      const match = line.match(/^Sitemap:\s*(.+)$/i);
      if (match) {
        const url = match[1].trim();
        if (url) sitemaps.push(url);
      }
    }
    if (sitemaps.length > 0) {
      console.log(`[Sitemap] Found ${sitemaps.length} sitemap(s) in robots.txt for ${origin}`);
    }
    return sitemaps;
  } catch {
    return [];
  }
}

/**
 * Given raw XML, determines whether it is a sitemap index or a URL set,
 * then extracts and filters article URLs accordingly.
 */
async function extractArticleUrlsFromXml(
  xml: string,
  sourceUrl: string,
  origin: string,
  maxAgeDays: number,
): Promise<string[]> {
  const $ = cheerio.load(xml, { xmlMode: true });

  const isSitemapIndex = $('sitemapindex').length > 0 || $('sitemap > loc').length > 0;

  if (isSitemapIndex) {
    return handleSitemapIndex($, origin, maxAgeDays);
  }

  return filterAndSortUrls($, origin, maxAgeDays);
}

/**
 * Handles a sitemap index: selects the best child sitemap and fetches it.
 *
 * Selection priority:
 *  1. Child sitemaps whose URL contains "news", "article", or "post"
 *  2. If none match, the child sitemap with the most recent <lastmod>
 *
 * Supports nested sitemap indexes (e.g. Arsenal: index → paginated index → URLs)
 * via recursive calls up to depth 2. Paginated child sitemaps (containing `?page=`)
 * are sorted by page number descending so the most recent pages are tried first.
 * At most 3 child sitemaps are fetched per level to avoid excessive requests.
 */
async function handleSitemapIndex(
  $: ReturnType<typeof cheerio.load>,
  origin: string,
  maxAgeDays: number,
  depth: number = 0,
): Promise<string[]> {
  interface ChildSitemap {
    loc: string;
    lastmod: Date | null;
  }

  const children: ChildSitemap[] = [];
  $('sitemap').each((_i, el) => {
    const loc = $(el).find('loc').first().text().trim();
    if (!loc) return;
    const lastmodText = $(el).find('lastmod').first().text().trim();
    const lastmod = lastmodText ? new Date(lastmodText) : null;
    children.push({ loc, lastmod: lastmod && isValidDate(lastmod) ? lastmod : null });
  });

  if (children.length === 0) return [];

  // Prefer child sitemaps containing news/article/post keywords
  const newsChildren = children.filter(c =>
    NEWS_SITEMAP_KEYWORDS.some(kw => c.loc.toLowerCase().includes(kw)),
  );

  // When no keyword-matched children, use ALL paginated children (sorted below)
  // instead of just mostRecent — allows trying multiple pages
  const allPaginated = children.some(c => c.loc.includes('?page='));
  let targets =
    newsChildren.length > 0
      ? newsChildren
      : allPaginated
        ? [...children]
        : [mostRecent(children)];

  // Sort targets so we try the most recent ones first:
  //  - Paginated (?page=N): sort by page number descending
  //  - Yearly (sitemap-articles-2026.xml): sort by lastmod descending
  const isPaginated = targets.some(t => t.loc.includes('?page='));
  if (isPaginated) {
    targets.sort((a, b) => {
      const pageA = parseInt(a.loc.match(/[?&]page=(\d+)/)?.[1] ?? '0');
      const pageB = parseInt(b.loc.match(/[?&]page=(\d+)/)?.[1] ?? '0');
      return pageB - pageA;
    });
  } else if (targets.length > 1) {
    // Sort by lastmod descending (most recent first) — handles yearly sitemaps
    targets.sort((a, b) => {
      if (a.lastmod && b.lastmod) return b.lastmod.getTime() - a.lastmod.getTime();
      if (a.lastmod) return -1;
      if (b.lastmod) return 1;
      // Fallback: sort by URL descending (higher year/number comes first)
      return b.loc.localeCompare(a.loc);
    });
  }

  // Limit to 3 child sitemaps per level to avoid excessive fetches
  targets = targets.slice(0, 3);

  for (const target of targets) {
    if (!target) continue;
    const xml = await fetchXml(target.loc);
    if (!xml) continue;

    console.log(`[Sitemap] Fetching child sitemap (depth=${depth}): ${target.loc}`);
    const $child = cheerio.load(xml, { xmlMode: true });

    // Use child sitemap's origin for URL filtering (handles cross-domain sitemaps,
    // e.g. nufc.co.uk sitemap → newcastleunited.com article URLs)
    let childOrigin: string;
    try {
      childOrigin = new URL(target.loc).origin;
    } catch {
      childOrigin = origin;
    }
    const effectiveOrigin = childOrigin !== origin ? childOrigin : origin;

    // Check if this child is itself a sitemap index — recurse if depth allows
    const isNestedIndex =
      $child('sitemapindex').length > 0 || $child('sitemap > loc').length > 0;
    if (isNestedIndex && depth < 2) {
      console.log(`[Sitemap] Child is a nested sitemap index, recursing (depth=${depth + 1})`);
      const urls = await handleSitemapIndex($child, effectiveOrigin, maxAgeDays, depth + 1);
      if (urls.length > 0) return urls;
      continue;
    }

    const urls = filterAndSortUrls($child, effectiveOrigin, maxAgeDays);
    if (urls.length > 0) return urls;
  }

  return [];
}

/**
 * Filters `<url><loc>` entries from a URL-set sitemap:
 *  - Same origin as the club website
 *  - Path matches ARTICLE_PATH_SEGMENTS
 *  - Within maxAgeDays (using <lastmod> or <news:publication_date>)
 * Sorts by date descending and returns at most MAX_URLS URLs.
 */
function filterAndSortUrls(
  $: ReturnType<typeof cheerio.load>,
  origin: string,
  maxAgeDays: number,
): string[] {
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
  const dated: DatedUrl[] = [];

  $('url').each((_i, el) => {
    const loc = $(el).find('loc').first().text().trim();
    if (!loc) return;

    // Must be same origin
    let parsed: URL;
    try {
      parsed = new URL(loc);
    } catch {
      return;
    }
    if (parsed.origin !== origin) return;

    // Must match an article path segment
    const pathname = parsed.pathname.toLowerCase();
    if (!isLikelyArticlePath(pathname)) return;

    // Extract the best available date
    const lastmodText = $(el).find('lastmod').first().text().trim();
    const newsDateText = $(el).find('news\\:publication_date, publication_date').first().text().trim();
    const rawDate = newsDateText || lastmodText;
    const date = rawDate ? new Date(rawDate) : null;

    // Apply date filter only when a date is present
    if (date && isValidDate(date) && date < cutoff) return;

    dated.push({ url: loc, date: date && isValidDate(date) ? date : null });
  });

  // Sort: entries with a date come first (newest first), then undated entries
  dated.sort((a, b) => {
    if (a.date && b.date) return b.date.getTime() - a.date.getTime();
    if (a.date) return -1;
    if (b.date) return 1;
    return 0;
  });

  return dated.slice(0, MAX_URLS).map(d => d.url);
}

/** Returns the element with the most recent lastmod (or the first if none have dates). */
function mostRecent<T extends { lastmod: Date | null }>(items: T[]): T {
  return items.reduce((best, cur) => {
    if (!best.lastmod) return cur;
    if (!cur.lastmod) return best;
    return cur.lastmod > best.lastmod ? cur : best;
  });
}

function isValidDate(d: Date): boolean {
  return !isNaN(d.getTime());
}
