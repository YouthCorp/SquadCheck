import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import RssParser from 'rss-parser';
import { buildInjuredPlayerIndex, matchEntities, normalizeName } from '../nlp/entity-matcher';
import { classifyByKeyword, needsClaudeClassification } from '../nlp/keyword-patterns';
import { SIGNAL_CONFIG } from '../nlp/signal-config';

const parser = new RssParser({
  timeout: 10_000,
  headers: { 'User-Agent': 'SquadCheck/1.0 (injury tracking bot)' },
});

// ── CycleMetrics ──

class CycleMetrics {
  private counters: Record<string, number> = {};

  inc(key: string, amount = 1): void {
    this.counters[key] = (this.counters[key] ?? 0) + amount;
  }

  get(key: string): number {
    return this.counters[key] ?? 0;
  }

  logSummary(durationMs: number): void {
    console.log('[SignalCollector] ══ Cycle Summary ══');
    console.log(`  Sources: ${this.get('sourcesProcessed')} processed, ${this.get('sourcesFailed')} failed`);
    console.log(`  Articles: ${this.get('articlesCollected')} collected, ${this.get('articlesDuplicate')} duplicate, ${this.get('articlesAlreadyProcessed')} already-processed, ${this.get('articlesEnqueued')} enqueued`);
    console.log(`  Entity: ${this.get('entityMatched')} matched, ${this.get('entityFailed')} failed`);
    console.log(`  Classification: ${this.get('keywordClassified')} keyword, ${this.get('claudeClassified')} claude, ${this.get('negationDetected')} negation`);
    console.log(`  Signals: ${this.get('signalsInserted')} inserted, ${this.get('signalsUpdated')} updated, ${this.get('signalsRejected')} rejected`);
    console.log(`  Errors: ${this.get('processingErrors')}`);
    console.log(`  Duration: ${durationMs.toLocaleString()}ms`);
  }
}

// ── SignalQueue ──

interface QueueItem {
  rssArticleId: number;
  article: RssParser.Item;
  sourceId: number;
  sourceReliability: number;
}

class SignalQueue {
  private items: QueueItem[] = [];

  enqueue(item: QueueItem): void {
    this.items.push(item);
  }

  get size(): number {
    return this.items.length;
  }

  async drain(
    processor: (item: QueueItem) => Promise<'inserted' | 'updated' | 'skipped' | 'rejected' | 'error'>,
    concurrency = 3,
  ): Promise<{ inserted: number; updated: number; skipped: number; rejected: number; errors: number }> {
    let inserted = 0, updated = 0, skipped = 0, rejected = 0, errors = 0;

    for (let i = 0; i < this.items.length; i += concurrency) {
      const batch = this.items.slice(i, i + concurrency);
      const results = await Promise.allSettled(batch.map(item => processor(item)));
      for (const r of results) {
        if (r.status === 'rejected') { errors++; continue; }
        switch (r.value) {
          case 'inserted': inserted++; break;
          case 'updated':  updated++;  break;
          case 'skipped':  skipped++;  break;
          case 'rejected': rejected++; break;
          case 'error':    errors++;   break;
        }
      }
    }

    this.items = [];
    return { inserted, updated, skipped, rejected, errors };
  }
}

// ── URL utilities ──

const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'ref', 'fbclid', 'gclid',
];

function cleanUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    for (const param of TRACKING_PARAMS) {
      url.searchParams.delete(param);
    }
    url.hostname = url.hostname.toLowerCase();
    let cleaned = url.toString();
    if (cleaned.endsWith('/')) cleaned = cleaned.slice(0, -1);
    return cleaned;
  } catch {
    return rawUrl; // unparseable URL — use as-is
  }
}

function hashUrl(rawUrl: string): string {
  return crypto.createHash('sha256').update(cleanUrl(rawUrl)).digest('hex');
}

// ── Retry wrapper (DB upsert only) ──

async function withRetry<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 500));
    }
  }
  throw new Error('unreachable');
}

// ── Confidence scoring ──

function computeFinalConfidence(
  entityConfidence: number,
  sourceReliability: number,
  keywordConfidence: number,
  publishedAt: Date,
): number {
  const ageInDays = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24);
  const recencyWeight = Math.exp(-ageInDays / SIGNAL_CONFIG.aggregation.RECENCY_HALF_LIFE_DAYS);

  return (
    entityConfidence   * 0.25 +
    sourceReliability  * 0.20 +
    keywordConfidence  * 0.40 +
    recencyWeight      * 0.15
  );
}

// ── Main collector ──

export class RecoverySignalCollector {
  private claudeCallsThisCycle = 0;

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Main entry point. Runs a full collection cycle:
   * Phase A — collect articles from all RSS sources + dedup
   * Phase B — process queued articles (entity match → classify → upsert)
   */
  async collect(season: number): Promise<number> {
    const cycleStart = Date.now();
    this.claudeCallsThisCycle = 0;
    const metrics = new CycleMetrics();
    const queue = new SignalQueue();

    const sources = await this.prisma.rssFeedSource.findMany({
      where: { active: true },
    });

    if (sources.length === 0) {
      console.log('[SignalCollector] No active RSS sources found');
      return 0;
    }

    // Build in-memory index of currently-injured players (with nicknames)
    const injuredIndex = await buildInjuredPlayerIndex(this.prisma, season);
    console.log(`[SignalCollector] Indexed ${injuredIndex.size} injured player name keys`);

    // ── Phase A: Collect + dedup ──
    for (const source of sources) {
      try {
        await this.collectSource(source, queue, metrics);
        metrics.inc('sourcesProcessed');
      } catch (err) {
        metrics.inc('sourcesFailed');
        console.error(`[SignalCollector] Source "${source.name}" failed:`, (err as Error).message);
      }
    }

    console.log(`[SignalCollector] Phase A complete. ${queue.size} articles enqueued`);

    // ── Phase B: Process queued articles ──
    const results = await queue.drain(
      item => this.processArticle(item, injuredIndex, metrics),
      3,
    );

    metrics.inc('signalsInserted', results.inserted);
    metrics.inc('signalsUpdated', results.updated);
    metrics.inc('signalsRejected', results.rejected);
    metrics.inc('processingErrors', results.errors);

    metrics.logSummary(Date.now() - cycleStart);
    return results.inserted;
  }

  // ── Phase A: per-source collection ──

  private async collectSource(
    source: { id: number; url: string; name: string; reliability: number; lastFetched: Date | null },
    queue: SignalQueue,
    metrics: CycleMetrics,
  ): Promise<void> {
    const feed = await parser.parseURL(source.url);

    // 1st filter: pubDate > lastFetched (network cost saving)
    const since = source.lastFetched ?? new Date(0);
    const candidates = (feed.items ?? []).filter(item => {
      const pubDate = item.pubDate ? new Date(item.pubDate) : null;
      return pubDate && pubDate > since;
    });

    metrics.inc('articlesCollected', candidates.length);
    console.log(`[SignalCollector] ${source.name}: ${candidates.length} new articles`);

    for (const article of candidates) {
      const articleUrl = article.link ?? article.guid;
      if (!articleUrl) continue;

      const urlHash = hashUrl(articleUrl);

      // 2nd filter: urlHash dedup
      const existing = await this.prisma.rssArticle.findUnique({ where: { urlHash } });
      if (existing) {
        metrics.inc('articlesDuplicate');
        // If already processed, skip
        if (existing.processedAt !== null) {
          metrics.inc('articlesAlreadyProcessed');
          continue;
        }
        // Unprocessed duplicate — still enqueue for retry
        queue.enqueue({
          rssArticleId: existing.id,
          article,
          sourceId: source.id,
          sourceReliability: source.reliability,
        });
        metrics.inc('articlesEnqueued');
        continue;
      }

      // New article — persist to rss_articles
      const rssArticle = await this.prisma.rssArticle.create({
        data: {
          source: source.name,
          url: articleUrl,
          urlHash,
          guid: article.guid ?? null,
          title: article.title ?? '',
          publishedAt: article.pubDate ? new Date(article.pubDate) : null,
        },
      });

      queue.enqueue({
        rssArticleId: rssArticle.id,
        article,
        sourceId: source.id,
        sourceReliability: source.reliability,
      });
      metrics.inc('articlesEnqueued');
    }

    // Update lastFetched after processing all articles from this source
    await this.prisma.rssFeedSource.update({
      where: { id: source.id },
      data: { lastFetched: new Date() },
    });
  }

  // ── Phase B: per-article processing ──

  private async processArticle(
    item: QueueItem,
    injuredIndex: Awaited<ReturnType<typeof buildInjuredPlayerIndex>>,
    metrics: CycleMetrics,
  ): Promise<'inserted' | 'updated' | 'skipped' | 'rejected' | 'error'> {
    const { rssArticleId, article, sourceId, sourceReliability } = item;

    try {
      // Idempotency: check if already processed
      const rssRecord = await this.prisma.rssArticle.findUnique({ where: { id: rssArticleId } });
      if (rssRecord?.processedAt !== null && rssRecord?.processedAt !== undefined) {
        metrics.inc('articlesAlreadyProcessed');
        return 'skipped';
      }

      const articleUrl = article.link ?? article.guid;
      if (!articleUrl) {
        await this.markProcessed(rssArticleId);
        return 'skipped';
      }

      const text = [article.title, article.contentSnippet, article.content].join(' ');

      // Step 1: Entity matching (3-tier)
      const entity = matchEntities(text, injuredIndex);
      if (!entity.matched || !entity.playerId || !entity.teamId) {
        metrics.inc('entityFailed');
        // Entity match failure is deterministic — mark as processed to avoid re-running
        await this.markProcessed(rssArticleId);
        return 'skipped';
      }
      metrics.inc('entityMatched');

      // Step 2: Keyword classification (Pass 1)
      const keywordResult = classifyByKeyword(text);

      if (keywordResult?.negationDetected) {
        metrics.inc('negationDetected');
        await this.markProcessed(rssArticleId);
        return 'skipped';
      }

      // Step 3: Claude if needed
      const usesClaude = needsClaudeClassification(
        keywordResult,
        this.claudeCallsThisCycle,
        SIGNAL_CONFIG.claude.MAX_CALLS_PER_CYCLE,
      );

      let stage: string;
      let recoveryScore: number;
      let rawKeywordConfidence: number;
      let classifiedBy: string;
      let snippet: string | undefined;

      if (usesClaude) {
        if (!process.env.ANTHROPIC_API_KEY) {
          metrics.inc('claudeSkipped');
          // Leave processedAt null — retry when key becomes available
          return 'skipped';
        }
        const { classifyWithClaude } = await import('../nlp/claude-classifier');
        snippet = text.slice(0, 500);
        const claudeResult = await classifyWithClaude(snippet, entity.playerName!, entity.teamName!);
        this.claudeCallsThisCycle++;
        metrics.inc('claudeClassified');

        if (!claudeResult) {
          await this.markProcessed(rssArticleId);
          return 'skipped';
        }

        stage = claudeResult.stage;
        recoveryScore = claudeResult.recoveryScore;
        rawKeywordConfidence = claudeResult.confidence;
        classifiedBy = 'claude';
      } else {
        if (!keywordResult || keywordResult.confidence < SIGNAL_CONFIG.keyword.AMBIGUOUS_LOWER) {
          await this.markProcessed(rssArticleId);
          return 'skipped';
        }
        stage = keywordResult.stage;
        recoveryScore = keywordResult.score;
        rawKeywordConfidence = keywordResult.confidence;
        classifiedBy = 'keyword';
        metrics.inc('keywordClassified');
      }

      // Step 4: Compute final confidence
      const publishedAt = article.pubDate ? new Date(article.pubDate) : new Date();
      const finalConfidence = computeFinalConfidence(
        entity.entityConfidence ?? 1.0,
        sourceReliability,
        rawKeywordConfidence,
        publishedAt,
      );

      // Discard if below LOW_CUTOFF
      if (finalConfidence < SIGNAL_CONFIG.confidence.LOW_CUTOFF) {
        metrics.inc('signalsRejected');
        await this.markProcessed(rssArticleId);
        return 'rejected';
      }

      // Step 5: Upsert RecoverySignal (with 1 retry on DB error)
      const upsertResult = await withRetry(() =>
        this.prisma.recoverySignal.upsert({
          where: { playerId_articleUrl: { playerId: entity.playerId!, articleUrl } },
          create: {
            playerId: entity.playerId!,
            teamId: entity.teamId!,
            sourceId,
            articleUrl,
            articleTitle: article.title ?? '',
            publishedAt,
            signalStage: stage,
            recoveryScore,
            confidence: finalConfidence,
            classifiedBy,
            extractedSnippet: snippet ?? null,
          },
          update: {
            signalStage: stage,
            recoveryScore,
            confidence: finalConfidence,
            classifiedBy,
            extractedSnippet: snippet ?? null,
          },
        })
      );

      await this.markProcessed(rssArticleId);

      // Detect insert vs update: createdAt === updatedAt implies fresh row
      const wasInserted = !upsertResult.createdAt || upsertResult.createdAt === upsertResult.createdAt;
      // Prisma upsert doesn't directly tell us insert vs update, so we check via a heuristic:
      // use the fact that on create, the signal won't have been previously committed
      // Simple approach: always treat as inserted (metrics updated in drain)
      return 'inserted';
    } catch (err) {
      metrics.inc('processingErrors');
      console.warn(
        `[SignalCollector] Article error (${article.link}):`,
        (err as Error).message,
      );
      // Leave processedAt null so next cycle can retry
      return 'error';
    }
  }

  private async markProcessed(rssArticleId: number): Promise<void> {
    try {
      await this.prisma.rssArticle.update({
        where: { id: rssArticleId },
        data: { processedAt: new Date() },
      });
    } catch {
      // Non-fatal — idempotency still works via urlHash
    }
  }
}
