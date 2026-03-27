/**
 * Club news page parser (generic — all leagues).
 *
 * Extracts article links and content from club official news pages using cheerio.
 * Uses a generic heuristic approach since each club's site has a different HTML structure:
 *   - Find <a> tags whose href contains news-related path segments
 *   - Extract article body text from <p>, <article>, <main> tags
 *   - Extract publish date from <meta property="article:published_time"> or similar
 *
 * If a club site changes its structure, the parser gracefully skips that source.
 */

import * as cheerio from 'cheerio';

/** Path segments that indicate a link is to a news article */
export const ARTICLE_PATH_SEGMENTS = [
  '/news/', '/article/', '/articles/', '/story/', '/stories/',
  '/press-release/', '/media/', '/match-report/', '/match_report/',
  '/match-preview/', '/team-news/', '/injury-update/',
  '/actualites/', '/actualite/', '/noticias/', '/noticia/',
  '/aktuell/', '/aktuelles/', '/nieuws/',
];

const NON_ARTICLE_PATH_SEGMENTS = [
  '/match/', '/matches/', '/billetterie/', '/ticketing/', '/shop/', '/store/',
  '/video/', '/videos/', '/gallery/', '/photos/', '/academy/', '/formation/',
  '/equipe/', '/equipes/', '/team/', '/teams/', '/joueurs/', '/player/',
  '/players/', '/staff/', '/calendrier/', '/fixtures/', '/partner/', '/partners/',
];

/** Max article links to extract per crawl (prevents overloading) */
const MAX_LINKS_PER_SOURCE = 20;

export function isLikelyArticlePath(pathname: string): boolean {
  const normalized = pathname.toLowerCase();

  if (ARTICLE_PATH_SEGMENTS.some(seg => normalized.includes(seg))) {
    return true;
  }

  if (NON_ARTICLE_PATH_SEGMENTS.some(seg => normalized.includes(seg))) {
    return false;
  }

  if (normalized === '/' || normalized.length < 12) {
    return false;
  }

  if (/\.(xml|jpg|jpeg|png|gif|webp|svg|pdf|mp4)$/i.test(normalized)) {
    return false;
  }

  const lastSegment = normalized.split('/').filter(Boolean).pop() ?? '';
  const hyphenCount = (lastSegment.match(/-/g) ?? []).length;

  return hyphenCount >= 3;
}

/**
 * Extracts article URLs from a club news listing page.
 * Returns absolute URLs, deduplicated.
 */
export function extractArticleLinks(html: string, sourceUrl: string): string[] {
  const $ = cheerio.load(html);
  const base = new URL(sourceUrl);
  const seen = new Set<string>();
  const links: string[] = [];

  $('a[href]').each((_i, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    // Resolve relative URLs
    let absolute: string;
    try {
      absolute = new URL(href, base).toString();
    } catch {
      return;
    }

    // Must be same origin
    try {
      if (new URL(absolute).origin !== base.origin) return;
    } catch {
      return;
    }

    const pathname = new URL(absolute).pathname.toLowerCase();
    if (!isLikelyArticlePath(pathname)) return;

    // Deduplicate (strip hash/trailing slash)
    const normalised = absolute.split('#')[0].replace(/\/$/, '');
    if (seen.has(normalised)) return;
    seen.add(normalised);
    links.push(normalised);
  });

  return links.slice(0, MAX_LINKS_PER_SOURCE);
}

export interface ParsedArticle {
  title: string;
  text: string;
  publishedAt: Date;
}

/**
 * Extracts article content from a rendered article page HTML.
 * Attempts several common patterns before falling back to all <p> text.
 */
export function extractArticleContent(html: string): ParsedArticle {
  const $ = cheerio.load(html);

  // Title: prefer <meta og:title>, fall back to <title> or <h1>
  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('meta[name="twitter:title"]').attr('content') ||
    $('h1').first().text().trim() ||
    $('title').text().trim();

  // Published date: check common meta tags
  const dateMeta =
    $('meta[property="article:published_time"]').attr('content') ||
    $('meta[name="publishdate"]').attr('content') ||
    $('meta[name="DC.date.issued"]').attr('content') ||
    $('time[datetime]').first().attr('datetime');

  const publishedAt = dateMeta ? new Date(dateMeta) : new Date();

  // Body text: prefer <article>, <main>, or elements with content-related classes
  let bodyEl = $('article').first();
  if (!bodyEl.length) bodyEl = $('main').first();
  if (!bodyEl.length) bodyEl = $('[class*="content"]').first();
  if (!bodyEl.length) bodyEl = $('[class*="article"]').first();

  // Remove nav, header, footer, scripts, styles before extracting text
  const scope = bodyEl.length ? bodyEl : $('body');
  const clone = scope.clone();
  clone.find('nav, header, footer, script, style, [class*="nav"], [class*="menu"], [class*="sidebar"]').remove();

  const rawText = clone.find('p').map((_i, el) => $(el).text().trim()).get().join(' ');
  // Fallback: use all <p> on page if body extraction yielded too little
  const text = rawText.length > 100
    ? rawText
    : $('p').map((_i, el) => $(el).text().trim()).get().filter(t => t.length > 30).join(' ');

  return {
    title: title.trim(),
    text: text.slice(0, 3000), // cap at 3000 chars (enough for NLP)
    publishedAt: isNaN(publishedAt.getTime()) ? new Date() : publishedAt,
  };
}
