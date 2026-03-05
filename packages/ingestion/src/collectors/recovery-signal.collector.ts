import { PrismaClient } from '@prisma/client';
import RssParser from 'rss-parser';
import { buildInjuredPlayerIndex, matchEntities } from '../nlp/entity-matcher';
import { classifyByKeyword, needsClaudeClassification } from '../nlp/keyword-patterns';
import { SIGNAL_CONFIG } from '../nlp/signal-config';

const parser = new RssParser({
  timeout: 10_000,
  headers: { 'User-Agent': 'SquadCheck/1.0 (injury tracking bot)' },
});

export class RecoverySignalCollector {
  private claudeCallsThisCycle = 0;

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Main entry point. Fetches all active RSS sources, processes new articles,
   * and stores recovery signals. Returns the count of new signals inserted.
   */
  async collect(season: number): Promise<number> {
    this.claudeCallsThisCycle = 0;
    let totalInserted = 0;

    const sources = await this.prisma.rssFeedSource.findMany({
      where: { active: true },
    });

    if (sources.length === 0) {
      console.log('[SignalCollector] No active RSS sources found');
      return 0;
    }

    // Build in-memory index of currently-injured players
    const injuredIndex = await buildInjuredPlayerIndex(this.prisma, season);
    console.log(`[SignalCollector] Indexed ${injuredIndex.size} injured player name keys`);

    for (const source of sources) {
      try {
        const inserted = await this.processSource(source, injuredIndex, season);
        totalInserted += inserted;
      } catch (err) {
        console.error(`[SignalCollector] Source "${source.name}" failed:`, (err as Error).message);
        // Continue to next source — don't let one failure abort the cycle
      }
    }

    console.log(`[SignalCollector] Cycle complete. Inserted ${totalInserted} new signals`);
    return totalInserted;
  }

  private async processSource(
    source: { id: number; url: string; name: string; reliability: number; lastFetched: Date | null },
    injuredIndex: ReturnType<typeof buildInjuredPlayerIndex> extends Promise<infer T> ? T : never,
    season: number,
  ): Promise<number> {
    const feed = await parser.parseURL(source.url);
    let inserted = 0;

    // Determine cutoff: only process articles newer than lastFetched
    const since = source.lastFetched ?? new Date(0);

    const newArticles = (feed.items ?? []).filter(item => {
      const pubDate = item.pubDate ? new Date(item.pubDate) : null;
      return pubDate && pubDate > since;
    });

    console.log(`[SignalCollector] ${source.name}: ${newArticles.length} new articles`);

    for (const article of newArticles) {
      try {
        const wasInserted = await this.processArticle(article, source, injuredIndex, season);
        if (wasInserted) inserted++;
      } catch (err) {
        // Log and continue — article-level errors are non-fatal
        console.warn(`[SignalCollector] Article error (${article.link}):`, (err as Error).message);
      }
    }

    // Update lastFetched for this source
    await this.prisma.rssFeedSource.update({
      where: { id: source.id },
      data: { lastFetched: new Date() },
    });

    return inserted;
  }

  private async processArticle(
    article: RssParser.Item,
    source: { id: number; reliability: number },
    injuredIndex: Awaited<ReturnType<typeof buildInjuredPlayerIndex>>,
    _season: number,
  ): Promise<boolean> {
    const articleUrl = article.link ?? article.guid;
    if (!articleUrl) return false;

    const text = [article.title, article.contentSnippet, article.content].join(' ');

    // Step 1: Entity matching
    const entity = matchEntities(text, injuredIndex);
    if (!entity.matched || !entity.playerId || !entity.teamId) return false;

    // Step 2: Keyword classification (Pass 1)
    const keywordResult = classifyByKeyword(text);

    // If negation detected → skip entirely
    if (keywordResult?.negationDetected) return false;

    // Step 3: Determine if Claude is needed
    const usesClaude = needsClaudeClassification(
      keywordResult,
      this.claudeCallsThisCycle,
      SIGNAL_CONFIG.claude.MAX_CALLS_PER_CYCLE,
    );

    let stage: string;
    let recoveryScore: number;
    let confidence: number;
    let classifiedBy: string;
    let snippet: string | undefined;

    if (usesClaude) {
      // Lazy import to avoid loading Claude SDK when not needed
      const { classifyWithClaude } = await import('../nlp/claude-classifier');
      snippet = text.slice(0, 500);
      const claudeResult = await classifyWithClaude(snippet, entity.playerName!, entity.teamName!);
      this.claudeCallsThisCycle++;

      if (!claudeResult) return false; // Claude couldn't classify

      stage = claudeResult.stage;
      recoveryScore = claudeResult.recoveryScore;
      confidence = claudeResult.confidence;
      classifiedBy = 'claude';
    } else {
      if (!keywordResult || keywordResult.confidence < SIGNAL_CONFIG.keyword.AMBIGUOUS_LOWER) {
        return false; // Too weak to store
      }
      stage = keywordResult.stage;
      recoveryScore = keywordResult.score;
      confidence = keywordResult.confidence;
      classifiedBy = 'keyword';
    }

    const publishedAt = article.pubDate ? new Date(article.pubDate) : new Date();

    // Step 4: Upsert RecoverySignal
    await this.prisma.recoverySignal.upsert({
      where: { playerId_articleUrl: { playerId: entity.playerId!, articleUrl } },
      create: {
        playerId: entity.playerId!,
        teamId: entity.teamId!,
        sourceId: source.id,
        articleUrl,
        articleTitle: article.title ?? '',
        publishedAt,
        signalStage: stage,
        recoveryScore,
        confidence,
        classifiedBy,
        extractedSnippet: snippet ?? null,
      },
      update: {
        signalStage: stage,
        recoveryScore,
        confidence,
        classifiedBy,
        extractedSnippet: snippet ?? null,
      },
    });

    return true;
  }
}
