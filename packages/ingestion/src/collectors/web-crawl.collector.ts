/**
 * Web crawl collector — fetches EPL club official news pages and feeds
 * article text into the existing NLP recovery-signal pipeline.
 *
 * Complements RSS collection by covering sources that have no public RSS feed
 * (most EPL club official sites). Especially valuable for low-profile players
 * whose return news is only published by their own club.
 *
 * Architecture mirrors RecoverySignalCollector:
 *   1. Load active crawl sources from rss_feed_sources (sourceType='crawl')
 *   2. Fetch each news listing page (LightPanda → axios fallback)
 *   3. Extract article links (up to 20 per source)
 *   4. Fetch each article, extract text
 *   5. Dedup via rss_articles.urlHash (same table used by RSS)
 *   6. Run existing entity match → keyword → Claude NLP pipeline
 *   7. Upsert recovery_signals (classifiedBy='web_crawl')
 */

import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { fetchPageHtml } from '../crawlers/lightpanda.client';
import { extractArticleLinks, extractArticleContent } from '../crawlers/club-news.parser';
import { discoverArticleUrls } from '../crawlers/sitemap-parser';
import { buildInjuredPlayerIndex, matchAllEntities } from '../nlp/entity-matcher';
import { classifyByKeyword, needsClaudeClassification } from '../nlp/keyword-patterns';
import { SIGNAL_CONFIG } from '../nlp/signal-config';

// Delay between article fetches to avoid hammering club servers
const INTER_ARTICLE_DELAY_MS = 600;
// Max articles to process per source per cycle (dedup will skip already-seen ones)
const MAX_ARTICLES_PER_SOURCE = 20;

function cleanUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'fbclid', 'gclid'].forEach(p =>
      url.searchParams.delete(p),
    );
    url.hostname = url.hostname.toLowerCase();
    let cleaned = url.toString();
    if (cleaned.endsWith('/')) cleaned = cleaned.slice(0, -1);
    return cleaned;
  } catch {
    return rawUrl;
  }
}

function hashUrl(rawUrl: string): string {
  return crypto.createHash('sha256').update(cleanUrl(rawUrl)).digest('hex');
}

function computeFinalConfidence(
  entityConfidence: number,
  sourceReliability: number,
  keywordConfidence: number,
  publishedAt: Date,
): number {
  const ageInDays = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24);
  const recencyWeight = Math.exp(-ageInDays / SIGNAL_CONFIG.aggregation.RECENCY_HALF_LIFE_DAYS);
  return (
    entityConfidence  * 0.25 +
    sourceReliability * 0.20 +
    keywordConfidence * 0.40 +
    recencyWeight     * 0.15
  );
}

export class WebCrawlCollector {
  private claudeCallsThisCycle = 0;

  constructor(private readonly prisma: PrismaClient) {}

  async collect(season: number): Promise<number> {
    this.claudeCallsThisCycle = 0;

    const sources = await this.prisma.rssFeedSource.findMany({
      where: { active: true, sourceType: 'crawl' },
    });

    if (sources.length === 0) {
      console.log('[WebCrawl] No active crawl sources');
      return 0;
    }

    console.log(`[WebCrawl] ${sources.length} crawl sources active`);

    const injuredIndex = await buildInjuredPlayerIndex(this.prisma, season);
    console.log(`[WebCrawl] Indexed ${injuredIndex.size} injured player name keys`);

    let totalInserted = 0;

    for (const source of sources) {
      try {
        const inserted = await this.crawlSource(source, injuredIndex);
        totalInserted += inserted;
      } catch (err) {
        console.warn(`[WebCrawl] Source "${source.name}" failed:`, (err as Error).message);
      }
    }

    console.log(`[WebCrawl] ══ Cycle Complete ══ ${sources.length} sources processed, ${totalInserted} signals inserted`);
    return totalInserted;
  }

  private async crawlSource(
    source: { id: number; url: string; name: string; reliability: number; lastFetched: Date | null },
    injuredIndex: Awaited<ReturnType<typeof buildInjuredPlayerIndex>>,
  ): Promise<number> {
    // Step 1: Discover articles via sitemap (primary) or HTML parsing (fallback)
    const origin = new URL(source.url).origin;
    let articleUrls = await discoverArticleUrls(origin, { maxAgeDays: 7 });
    let discoveryMethod = 'sitemap';

    if (articleUrls.length === 0) {
      // Sitemap failed — try old HTML parsing as fallback
      discoveryMethod = 'html-fallback';
      console.log(`[WebCrawl] ${source.name}: sitemap empty, trying HTML fallback`);
      try {
        const { html: listingHtml } = await fetchPageHtml(source.url);
        articleUrls = extractArticleLinks(listingHtml, source.url);
      } catch (err) {
        console.warn(`[WebCrawl] ${source.name}: HTML fallback failed:`, (err as Error).message);
      }
    }

    if (articleUrls.length === 0) {
      console.log(`[WebCrawl] ${source.name}: no articles found (tried ${discoveryMethod})`);
      await this.prisma.rssFeedSource.update({
        where: { id: source.id },
        data: { lastFetched: new Date() },
      });
      return 0;
    }

    console.log(`[WebCrawl] ${source.name}: ${articleUrls.length} articles via ${discoveryMethod}`);

    const since = source.lastFetched ?? new Date(0);
    let inserted = 0;

    for (const articleUrl of articleUrls.slice(0, MAX_ARTICLES_PER_SOURCE)) {
      const urlHash = hashUrl(articleUrl);

      // Dedup check
      const existing = await this.prisma.rssArticle.findUnique({ where: { urlHash } });
      if (existing?.processedAt !== null && existing?.processedAt !== undefined) {
        continue; // Already processed
      }

      // Step 2: Fetch article page
      let articleHtml: string;
      try {
        const result = await fetchPageHtml(articleUrl);
        articleHtml = result.html;
      } catch (err) {
        console.warn(`[WebCrawl] Failed to fetch article ${articleUrl}:`, (err as Error).message);
        continue;
      }

      // Step 3: Extract content
      const { title, text, publishedAt } = extractArticleContent(articleHtml);

      // Skip articles older than lastFetched (or older than 7 days if no lastFetched)
      if (publishedAt < since && since.getTime() > 0) continue;
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      if (publishedAt < sevenDaysAgo) continue;

      // Step 4: Upsert into rss_articles for dedup
      const rssArticleId = existing?.id ?? (await this.prisma.rssArticle.create({
        data: {
          source: source.name,
          url:     articleUrl,
          urlHash,
          title:   title || '',
          publishedAt,
        },
      })).id;

      // Step 5: Run NLP pipeline
      const articleText = `${title} ${text}`;
      inserted += await this.processArticle(
        { rssArticleId, articleUrl, title, text: articleText, publishedAt, sourceId: source.id, sourceReliability: source.reliability },
        injuredIndex,
      );

      // Rate-limit between article fetches
      await new Promise(r => setTimeout(r, INTER_ARTICLE_DELAY_MS));
    }

    await this.prisma.rssFeedSource.update({
      where: { id: source.id },
      data: { lastFetched: new Date() },
    });

    console.log(`[WebCrawl] ${source.name}: ${inserted} signals from ${articleUrls.length} links`);
    return inserted;
  }

  private async processArticle(item: {
    rssArticleId: number;
    articleUrl:   string;
    title:        string;
    text:         string;
    publishedAt:  Date;
    sourceId:     number;
    sourceReliability: number;
  }, injuredIndex: Awaited<ReturnType<typeof buildInjuredPlayerIndex>>): Promise<number> {
    const { rssArticleId, articleUrl, text, publishedAt, sourceId, sourceReliability } = item;

    try {
      // Entity match — returns all matched players in the article
      const entities = matchAllEntities(text, injuredIndex);
      if (entities.length === 0) {
        await this.markProcessed(rssArticleId);
        return 0;
      }

      // Keyword classification (Pass 1) — run ONCE for the whole article
      const keywordResult = classifyByKeyword(text);
      if (keywordResult?.negationDetected) {
        await this.markProcessed(rssArticleId);
        return 0;
      }

      const usesClaude = needsClaudeClassification(
        keywordResult,
        this.claudeCallsThisCycle,
        SIGNAL_CONFIG.claude.MAX_CALLS_PER_CYCLE,
      );

      let stage: string;
      let recoveryScore: number;
      let rawKeywordConfidence: number;
      let snippet: string | undefined;

      // Use the first entity for Claude context (article-level classification)
      const firstEntity = entities[0];

      if (usesClaude) {
        if (!process.env.ANTHROPIC_API_KEY) {
          await this.markProcessed(rssArticleId);
          return 0;
        }
        const { classifyWithClaude } = await import('../nlp/claude-classifier');
        snippet = text.slice(0, 500);
        const claudeResult = await classifyWithClaude(snippet, firstEntity.playerName!, firstEntity.teamName!);
        this.claudeCallsThisCycle++;

        if (!claudeResult) {
          await this.markProcessed(rssArticleId);
          return 0;
        }

        stage                = claudeResult.stage;
        recoveryScore        = claudeResult.recoveryScore;
        rawKeywordConfidence = claudeResult.confidence;
      } else {
        if (!keywordResult || keywordResult.confidence < SIGNAL_CONFIG.keyword.AMBIGUOUS_LOWER) {
          await this.markProcessed(rssArticleId);
          return 0;
        }
        stage                = keywordResult.stage;
        recoveryScore        = keywordResult.score;
        rawKeywordConfidence = keywordResult.confidence;
      }

      // Loop through each matched entity and upsert a signal per player
      let insertCount = 0;
      for (const entity of entities) {
        const finalConfidence = computeFinalConfidence(
          entity.entityConfidence ?? 1.0,
          sourceReliability,
          rawKeywordConfidence,
          publishedAt,
        );

        if (finalConfidence < SIGNAL_CONFIG.confidence.LOW_CUTOFF) continue;

        await this.prisma.recoverySignal.upsert({
          where: { playerId_articleUrl: { playerId: entity.playerId!, articleUrl } },
          create: {
            playerId:         entity.playerId!,
            teamId:           entity.teamId!,
            sourceId,
            articleUrl,
            articleTitle:     item.title || '',
            publishedAt,
            signalStage:      stage,
            recoveryScore,
            confidence:       finalConfidence,
            classifiedBy:     'web_crawl',
            extractedSnippet: snippet ?? null,
          },
          update: {
            signalStage:      stage,
            recoveryScore,
            confidence:       finalConfidence,
            classifiedBy:     'web_crawl',
            extractedSnippet: snippet ?? null,
          },
        });

        insertCount++;
      }

      await this.markProcessed(rssArticleId);
      return insertCount;
    } catch (err) {
      console.warn(`[WebCrawl] Article error (${articleUrl}):`, (err as Error).message);
      return 0;
    }
  }

  private async markProcessed(rssArticleId: number): Promise<void> {
    try {
      await this.prisma.rssArticle.update({
        where: { id: rssArticleId },
        data: { processedAt: new Date() },
      });
    } catch {
      // Non-fatal
    }
  }
}
