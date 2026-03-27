/**
 * Web crawl collector fetches club official news pages and feeds
 * article text into the existing NLP recovery-signal pipeline.
 */

import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { fetchPageHtml } from '../crawlers/lightpanda.client';
import { extractArticleLinks, extractArticleContent } from '../crawlers/club-news.parser';
import { discoverArticleUrls } from '../crawlers/sitemap-parser';
import { buildInjuredPlayerIndex, matchAllEntities, normalizeName } from '../nlp/entity-matcher';
import { classifyByKeyword, needsClaudeClassification } from '../nlp/keyword-patterns';
import { SIGNAL_CONFIG, TEAM_ALIASES } from '../nlp/signal-config';

const INTER_ARTICLE_DELAY_MS = 600;
const MAX_ARTICLES_PER_SOURCE = 20;

type ProcessOutcome =
  | 'signals_inserted'
  | 'entity_no_match'
  | 'negation_detected'
  | 'claude_unavailable'
  | 'claude_no_result'
  | 'keyword_rejected'
  | 'below_confidence'
  | 'article_error';

interface ProcessResult {
  inserted: number;
  outcome: ProcessOutcome;
}

function cleanUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'fbclid', 'gclid'].forEach((p) =>
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
    entityConfidence * 0.25 +
    sourceReliability * 0.20 +
    keywordConfidence * 0.40 +
    recencyWeight * 0.15
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

    console.log(
      `[WebCrawl] Cycle Complete: ${sources.length} sources processed, ${totalInserted} signals inserted`,
    );
    return totalInserted;
  }

  private async crawlSource(
    source: { id: number; url: string; name: string; reliability: number; lastFetched: Date | null },
    injuredIndex: Awaited<ReturnType<typeof buildInjuredPlayerIndex>>,
  ): Promise<number> {
    const origin = new URL(source.url).origin;
    let articleUrls = await discoverArticleUrls(origin, { maxAgeDays: 7 });
    let discoveryMethod = 'sitemap';

    if (articleUrls.length === 0) {
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
      return 0;
    }

    console.log(`[WebCrawl] ${source.name}: ${articleUrls.length} articles via ${discoveryMethod}`);

    const since = source.lastFetched ?? new Date(0);
    let inserted = 0;
    let articleFetchFailed = 0;
    let entityNoMatch = 0;
    let keywordRejected = 0;
    let negationDetected = 0;
    let claudeUnavailable = 0;
    let belowConfidence = 0;
    let articleErrors = 0;

    for (const articleUrl of articleUrls.slice(0, MAX_ARTICLES_PER_SOURCE)) {
      const urlHash = hashUrl(articleUrl);
      const existing = await this.prisma.rssArticle.findUnique({ where: { urlHash } });
      if (existing?.processedAt !== null && existing?.processedAt !== undefined) {
        continue;
      }

      let articleHtml: string;
      try {
        const result = await fetchPageHtml(articleUrl);
        articleHtml = result.html;
      } catch (err) {
        console.warn(`[WebCrawl] Failed to fetch article ${articleUrl}:`, (err as Error).message);
        articleFetchFailed++;
        continue;
      }

      const { title, text, publishedAt } = extractArticleContent(articleHtml);

      if (publishedAt < since && since.getTime() > 0) continue;
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      if (publishedAt < sevenDaysAgo) continue;

      const rssArticleId =
        existing?.id ??
        (
          await this.prisma.rssArticle.create({
            data: {
              source: source.name,
              url: articleUrl,
              urlHash,
              title: title || '',
              publishedAt,
            },
          })
        ).id;

      const articleText = `${title} ${text}`;
      const result = await this.processArticle(
        {
          rssArticleId,
          articleUrl,
          title,
          text: articleText,
          publishedAt,
          sourceId: source.id,
          sourceReliability: source.reliability,
        },
        injuredIndex,
        source.name,
      );
      inserted += result.inserted;

      switch (result.outcome) {
        case 'entity_no_match':
          entityNoMatch++;
          break;
        case 'keyword_rejected':
          keywordRejected++;
          break;
        case 'negation_detected':
          negationDetected++;
          break;
        case 'claude_unavailable':
        case 'claude_no_result':
          claudeUnavailable++;
          break;
        case 'below_confidence':
          belowConfidence++;
          break;
        case 'article_error':
          articleErrors++;
          break;
      }

      await new Promise((r) => setTimeout(r, INTER_ARTICLE_DELAY_MS));
    }

    await this.prisma.rssFeedSource.update({
      where: { id: source.id },
      data: { lastFetched: new Date() },
    });

    console.log(
      `[WebCrawl] ${source.name}: ${inserted} signals from ${articleUrls.length} links ` +
        `(fetchFail=${articleFetchFailed}, entityMiss=${entityNoMatch}, keywordReject=${keywordRejected}, ` +
        `negation=${negationDetected}, claudeSkip=${claudeUnavailable}, lowConfidence=${belowConfidence}, articleError=${articleErrors})`,
    );
    return inserted;
  }

  private async processArticle(
    item: {
      rssArticleId: number;
      articleUrl: string;
      title: string;
      text: string;
      publishedAt: Date;
      sourceId: number;
      sourceReliability: number;
    },
    injuredIndex: Awaited<ReturnType<typeof buildInjuredPlayerIndex>>,
    sourceName: string,
  ): Promise<ProcessResult> {
    const { rssArticleId, articleUrl, text, publishedAt, sourceId, sourceReliability } = item;

    try {
      const directEntities = matchAllEntities(text, injuredIndex);
      const entities =
        directEntities.length > 0
          ? directEntities
          : this.matchEntitiesFromSourceContext(text, sourceName, injuredIndex);
      if (entities.length === 0) {
        await this.markProcessed(rssArticleId);
        return { inserted: 0, outcome: 'entity_no_match' };
      }

      const keywordResult = classifyByKeyword(text);
      if (keywordResult?.negationDetected) {
        await this.markProcessed(rssArticleId);
        return { inserted: 0, outcome: 'negation_detected' };
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

      const firstEntity = entities[0];

      if (usesClaude) {
        if (!process.env.ANTHROPIC_API_KEY) {
          await this.markProcessed(rssArticleId);
          return { inserted: 0, outcome: 'claude_unavailable' };
        }

        const { classifyWithClaude } = await import('../nlp/claude-classifier');
        snippet = text.slice(0, 500);
        const claudeResult = await classifyWithClaude(
          snippet,
          firstEntity.playerName!,
          firstEntity.teamName!,
        );
        this.claudeCallsThisCycle++;

        if (!claudeResult) {
          await this.markProcessed(rssArticleId);
          return { inserted: 0, outcome: 'claude_no_result' };
        }

        stage = claudeResult.stage;
        recoveryScore = claudeResult.recoveryScore;
        rawKeywordConfidence = claudeResult.confidence;
      } else {
        if (!keywordResult || keywordResult.confidence < SIGNAL_CONFIG.keyword.AMBIGUOUS_LOWER) {
          await this.markProcessed(rssArticleId);
          return { inserted: 0, outcome: 'keyword_rejected' };
        }

        stage = keywordResult.stage;
        recoveryScore = keywordResult.score;
        rawKeywordConfidence = keywordResult.confidence;
      }

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
            playerId: entity.playerId!,
            teamId: entity.teamId!,
            sourceId,
            articleUrl,
            articleTitle: item.title || '',
            publishedAt,
            signalStage: stage,
            recoveryScore,
            confidence: finalConfidence,
            classifiedBy: 'web_crawl',
            extractedSnippet: snippet ?? null,
          },
          update: {
            signalStage: stage,
            recoveryScore,
            confidence: finalConfidence,
            classifiedBy: 'web_crawl',
            extractedSnippet: snippet ?? null,
          },
        });

        insertCount++;
      }

      await this.markProcessed(rssArticleId);
      if (insertCount === 0) {
        return { inserted: 0, outcome: 'below_confidence' };
      }
      return { inserted: insertCount, outcome: 'signals_inserted' };
    } catch (err) {
      console.warn(`[WebCrawl] Article error (${articleUrl}):`, (err as Error).message);
      return { inserted: 0, outcome: 'article_error' };
    }
  }

  private matchEntitiesFromSourceContext(
    articleText: string,
    sourceName: string,
    injuredIndex: Awaited<ReturnType<typeof buildInjuredPlayerIndex>>,
  ): ReturnType<typeof matchAllEntities> {
    const text = normalizeName(articleText);
    const sourceText = normalizeName(sourceName);
    const unique = new Map<number, ReturnType<typeof matchAllEntities>[number]>();

    for (const [nameKey, players] of injuredIndex) {
      if (nameKey.length < 4) continue;
      if (!this.containsToken(text, nameKey)) continue;

      for (const player of players) {
        if (!this.sourceMatchesTeam(sourceText, player.teamName)) continue;
        unique.set(player.id, {
          matched: true,
          playerId: player.id,
          teamId: player.teamId,
          playerName: player.name,
          teamName: player.teamName,
          entityConfidence: 0.8,
          matchTier: 'alias',
        });
      }
    }

    return [...unique.values()];
  }

  private sourceMatchesTeam(sourceText: string, teamName: string): boolean {
    const normalizedTeam = normalizeName(teamName);
    if (this.containsToken(sourceText, normalizedTeam)) {
      return true;
    }

    const aliases = TEAM_ALIASES[normalizedTeam] ?? [];
    return aliases.some((alias) => {
      const normalizedAlias = normalizeName(alias);
      return normalizedAlias.length >= 3 && this.containsToken(sourceText, normalizedAlias);
    });
  }

  private containsToken(text: string, token: string): boolean {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`);
    return re.test(text);
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
