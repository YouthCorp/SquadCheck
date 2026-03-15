import { Router } from 'express';
import { getPrisma } from '../lib/prisma';

export const adminRouter = Router();

// GET /api/admin/ingestion/jobs?limit=20
adminRouter.get('/ingestion/jobs', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const limit = parseInt(req.query.limit as string) || 20;

    const jobs = await prisma.ingestionJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const summary = await prisma.ingestionJob.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    res.json({ jobs, summary });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/stats
adminRouter.get('/stats', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);

    const [
      leagues, teams, players, fixtures,
      injuries, fixtureStats, lineups, events,
      recoverySignals, playerAvailability, rssFeedSources, rssArticles,
    ] = await Promise.all([
      prisma.league.count(),
      prisma.team.count(),
      prisma.player.count(),
      prisma.fixture.count(),
      prisma.injury.count(),
      prisma.fixtureStatistics.count(),
      prisma.fixtureLineup.count(),
      prisma.fixtureEvent.count(),
      prisma.recoverySignal.count(),
      prisma.playerAvailability.count(),
      prisma.rssFeedSource.count(),
      prisma.rssArticle.count(),
    ]);

    res.json({
      leagues,
      teams,
      players,
      fixtures,
      injuries,
      fixtureStatistics: fixtureStats,
      fixtureLineups: lineups,
      fixtureEvents: events,
      recoverySignals,
      playerAvailability,
      rssFeedSources,
      rssArticles,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/signals/status
// RSS/크롤 파이프라인 전반 현황 — 소스 목록, 신호 수집 통계, 가용성 요약
adminRouter.get('/signals/status', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const now = new Date();
    const ago24h = new Date(now.getTime() - 86_400_000);
    const ago7d  = new Date(now.getTime() - 7 * 86_400_000);

    const [
      rssSources,
      crawlSources,
      totalSignals,
      last24hSignals,
      last7dSignals,
      signalsByClassifier,
      signalsBySource,
      activeAvail,
      aboveThresholdAvail,
      totalAvail,
      totalArticles,
      unprocessedArticles,
      recentArticles,
    ] = await Promise.all([
      prisma.rssFeedSource.findMany({
        where: { sourceType: 'rss' },
        select: { id: true, name: true, url: true, reliability: true, active: true, lastFetched: true },
        orderBy: { name: 'asc' },
      }),
      prisma.rssFeedSource.findMany({
        where: { sourceType: 'crawl' },
        select: { id: true, name: true, url: true, reliability: true, active: true, lastFetched: true },
        orderBy: { name: 'asc' },
      }),
      prisma.recoverySignal.count(),
      prisma.recoverySignal.count({ where: { createdAt: { gte: ago24h } } }),
      prisma.recoverySignal.count({ where: { createdAt: { gte: ago7d } } }),
      prisma.recoverySignal.groupBy({
        by: ['classifiedBy'],
        _count: { id: true },
      }),
      prisma.recoverySignal.groupBy({
        by: ['sourceId'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 20,
      }),
      prisma.playerAvailability.count({ where: { expired: false } }),
      prisma.playerAvailability.count({
        where: { expired: false, predictedAvailability: { gte: 0.7 }, confidenceLevel: { gte: 0.5 } },
      }),
      prisma.playerAvailability.count(),
      prisma.rssArticle.count(),
      prisma.rssArticle.count({ where: { processedAt: null } }),
      prisma.rssArticle.count({ where: { firstSeenAt: { gte: ago24h } } }),
    ]);

    // signal count per source → join with source name
    const allSourceIds = signalsBySource.map(s => s.sourceId);
    const sourceNames = await prisma.rssFeedSource.findMany({
      where: { id: { in: allSourceIds } },
      select: { id: true, name: true, sourceType: true },
    });
    const sourceNameMap = new Map(sourceNames.map(s => [s.id, s]));

    const signalsBySourceNamed = signalsBySource.map(s => ({
      sourceId: s.sourceId,
      sourceName: sourceNameMap.get(s.sourceId)?.name ?? `#${s.sourceId}`,
      sourceType: sourceNameMap.get(s.sourceId)?.sourceType ?? 'unknown',
      count: s._count.id,
    }));

    const classifierMap: Record<string, number> = {};
    for (const row of signalsByClassifier) {
      classifierMap[row.classifiedBy] = row._count.id;
    }

    const rssLastFetched = rssSources
      .map(s => s.lastFetched)
      .filter(Boolean)
      .sort((a, b) => (b!.getTime() - a!.getTime()))[0] ?? null;

    const crawlLastFetched = crawlSources
      .map(s => s.lastFetched)
      .filter(Boolean)
      .sort((a, b) => (b!.getTime() - a!.getTime()))[0] ?? null;

    res.json({
      rssSources: {
        total: rssSources.length,
        active: rssSources.filter(s => s.active).length,
        lastFetchedAt: rssLastFetched,
        sources: rssSources,
      },
      crawlSources: {
        total: crawlSources.length,
        active: crawlSources.filter(s => s.active).length,
        lastFetchedAt: crawlLastFetched,
        sources: crawlSources,
      },
      signals: {
        totalAllTime: totalSignals,
        last24h: last24hSignals,
        last7d: last7dSignals,
        byClassifier: classifierMap,
        topSourcesByVolume: signalsBySourceNamed,
      },
      availability: {
        activeRecords: activeAvail,
        totalRecords: totalAvail,
        expiredRecords: totalAvail - activeAvail,
        aboveThreshold: aboveThresholdAvail,
      },
      articles: {
        totalTracked: totalArticles,
        unprocessed: unprocessedArticles,
        discoveredLast24h: recentArticles,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/signals/players?limit=50
// 현재 활성 복귀 신호 선수 목록 (각 선수별 최근 신호 raw 데이터 포함)
adminRouter.get('/signals/players', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const availabilities = await prisma.playerAvailability.findMany({
      where: { expired: false, signalCount: { gt: 0 } },
      orderBy: { lastSignalAt: 'desc' },
      include: {
        player: { select: { id: true, name: true, photo: true, position: true } },
        fixture: {
          select: {
            id: true,
            date: true,
            homeTeam: { select: { id: true, name: true } },
            awayTeam: { select: { id: true, name: true } },
          },
        },
      },
      take: limit,
    });

    if (availabilities.length === 0) {
      return res.json({ players: [] });
    }

    // Fetch team info separately (no direct relation on PlayerAvailability)
    const teamIds = [...new Set(availabilities.map(a => a.teamId))];
    const teams = await prisma.team.findMany({
      where: { id: { in: teamIds } },
      select: { id: true, name: true, logo: true },
    });
    const teamMap = new Map(teams.map(t => [t.id, t]));

    // Fetch recent signals for each player
    const playerIds = availabilities.map(a => a.playerId);
    const recentSignals = await prisma.recoverySignal.findMany({
      where: {
        playerId: { in: playerIds },
        publishedAt: { gte: new Date(Date.now() - 14 * 86_400_000) },
      },
      orderBy: { publishedAt: 'desc' },
      include: {
        source: { select: { id: true, name: true, sourceType: true, reliability: true } },
      },
      take: 200,
    });

    // Group signals by playerId
    const signalsByPlayer = new Map<number, typeof recentSignals>();
    for (const sig of recentSignals) {
      const existing = signalsByPlayer.get(sig.playerId) ?? [];
      existing.push(sig);
      signalsByPlayer.set(sig.playerId, existing);
    }

    const players = availabilities.map(a => {
      const team = teamMap.get(a.teamId);
      const signals = signalsByPlayer.get(a.playerId) ?? [];
      return {
        playerId: a.playerId,
        playerName: a.player.name,
        playerPhoto: a.player.photo,
        playerPosition: a.player.position,
        teamId: a.teamId,
        teamName: team?.name ?? null,
        teamLogo: team?.logo ?? null,
        predictedAvailability: a.predictedAvailability,
        confidenceLevel: a.confidenceLevel,
        recoverySignalScore: a.recoverySignalScore,
        latestSignalStage: a.latestSignalStage,
        lastSignalAt: a.lastSignalAt,
        signalCount: a.signalCount,
        officialStatus: a.officialStatus,
        upcomingFixture: a.fixture
          ? {
              id: a.fixture.id,
              date: a.fixture.date,
              homeTeam: a.fixture.homeTeam.name,
              awayTeam: a.fixture.awayTeam.name,
            }
          : null,
        recentSignals: signals.map(s => ({
          id: s.id,
          articleTitle: s.articleTitle,
          articleUrl: s.articleUrl,
          signalStage: s.signalStage,
          recoveryScore: s.recoveryScore,
          confidence: s.confidence,
          classifiedBy: s.classifiedBy,
          publishedAt: s.publishedAt,
          sourceName: s.source.name,
          sourceType: s.source.sourceType,
          sourceReliability: s.source.reliability,
          extractedSnippet: s.extractedSnippet,
        })),
      };
    });

    res.json({ players });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/signals/injuries?season=2025
// 현재 활성 부상자 vs 복귀 완료(stale) 부상자 전체 현황
adminRouter.get('/signals/injuries', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const season = req.query.season ? parseInt(req.query.season as string) : 2025;
    const DISCIPLINARY_KEYWORDS = ['red card', 'suspended', 'suspension', 'yellow card'];

    // Get all non-disciplinary injuries for this season (latest per player)
    const allInjuries = await prisma.injury.findMany({
      where: {
        season,
        NOT: {
          OR: DISCIPLINARY_KEYWORDS.map(k => ({
            reason: { contains: k, mode: 'insensitive' as const },
          })),
        },
      },
      select: {
        playerId: true,
        teamId: true,
        leagueId: true,
        fixtureDate: true,
        type: true,
        reason: true,
        player: { select: { name: true, photo: true, position: true } },
        team:   { select: { name: true } },
        league: { select: { name: true, apiFootballId: true } },
      },
      orderBy: { fixtureDate: 'desc' },
    });

    // Keep latest injury per player
    const latestByPlayer = new Map<number, typeof allInjuries[0]>();
    for (const inj of allInjuries) {
      if (!latestByPlayer.has(inj.playerId)) {
        latestByPlayer.set(inj.playerId, inj);
      }
    }

    const playerIds = [...latestByPlayer.keys()];
    if (playerIds.length === 0) {
      return res.json({ activeInjuries: [], staleInjuries: [], summary: { totalInjuries: 0, activeInjuries: 0, staleInjuries: 0, withRecoverySignal: 0 } });
    }

    // Cross-competition lineup check (no league filter)
    const lineupAppearances = await prisma.fixtureLineupPlayer.findMany({
      where: {
        playerId: { in: playerIds },
        lineup: {
          fixture: {
            season,
            status: { in: ['FT', 'AET', 'PEN'] },
            date: { gte: new Date(Date.now() - 90 * 86_400_000) },
          },
        },
      },
      select: {
        playerId: true,
        lineup: {
          select: {
            fixture: { select: { date: true, homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } } },
          },
        },
      },
      orderBy: { lineup: { fixture: { date: 'desc' } } },
    });

    // Build player → latest lineup appearance
    const latestAppearanceMap = new Map<number, { date: Date; fixture: string }>();
    for (const app of lineupAppearances) {
      const date = app.lineup.fixture.date;
      const existing = latestAppearanceMap.get(app.playerId);
      if (!existing || date > existing.date) {
        latestAppearanceMap.set(app.playerId, {
          date,
          fixture: `${app.lineup.fixture.homeTeam.name} vs ${app.lineup.fixture.awayTeam.name}`,
        });
      }
    }

    // Get active recovery signals per player
    const availabilities = await prisma.playerAvailability.findMany({
      where: { playerId: { in: playerIds }, expired: false },
      select: { playerId: true, predictedAvailability: true, confidenceLevel: true, latestSignalStage: true },
    });
    const availMap = new Map(availabilities.map(a => [a.playerId, a]));

    const activeInjuries: object[] = [];
    const staleInjuries: object[] = [];

    for (const [playerId, inj] of latestByPlayer) {
      const latestAppearance = latestAppearanceMap.get(playerId);
      const hasReturnedToLineup = latestAppearance
        ? latestAppearance.date > inj.fixtureDate
        : false;
      const avail = availMap.get(playerId);

      const base = {
        playerId,
        playerName: inj.player.name,
        playerPhoto: inj.player.photo,
        playerPosition: inj.player.position,
        teamName: inj.team.name,
        teamId: inj.teamId,
        reason: inj.reason,
        type: inj.type,
        injuryDate: inj.fixtureDate,
        league: inj.league.name,
      };

      if (hasReturnedToLineup) {
        staleInjuries.push({
          ...base,
          hasReturnedToLineup: true,
          returnedAt: latestAppearance!.date,
          returnedFixture: latestAppearance!.fixture,
          note: 'Appeared in fixture lineup after injury date — record is stale',
        });
      } else {
        activeInjuries.push({
          ...base,
          hasReturnedToLineup: false,
          hasRecoverySignal: !!avail,
          predictedAvailability: avail?.predictedAvailability ?? null,
          confidenceLevel: avail?.confidenceLevel ?? null,
          latestSignalStage: avail?.latestSignalStage ?? null,
        });
      }
    }

    const withRecoverySignal = (activeInjuries as any[]).filter(i => i.hasRecoverySignal).length;

    res.json({
      activeInjuries,
      staleInjuries,
      summary: {
        totalUniqueInjuredPlayers: playerIds.length,
        activeInjuries: activeInjuries.length,
        staleInjuries: staleInjuries.length,
        withRecoverySignal,
      },
    });
  } catch (err) {
    next(err);
  }
});
