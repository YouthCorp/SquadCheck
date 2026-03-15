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

// POST /api/admin/signals/expire-stale
// 잘못 수집된 player_availability 즉시 만료 처리
// ① 완료된 경기(FT/AET/PEN)에 연결된 레코드
// ② 부상 기록 자체가 없는 선수의 레코드
// ③ 부상 기록은 있지만 그 이후 라인업에 출전한 선수의 레코드
adminRouter.post('/signals/expire-stale', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);

    // ① 완료된 경기 OR 이미 지난 날짜의 경기에 연결된 가용성 레코드 만료
    // (DB status가 FT로 업데이트 안 됐어도 과거 경기면 만료 처리)
    const now = new Date();
    const { count: expiredByFixture } = await prisma.playerAvailability.updateMany({
      where: {
        expired: false,
        fixture: {
          OR: [
            { status: { in: ['FT', 'AET', 'PEN'] } },
            { date: { lt: now } },
          ],
        },
      },
      data: { expired: true },
    });

    // 남은 활성 레코드 대상 추가 정리
    const activeAvail = await prisma.playerAvailability.findMany({
      where: { expired: false },
      select: { id: true, playerId: true, teamId: true, lastSignalAt: true },
    });

    if (activeAvail.length === 0) {
      return res.json({
        expiredByFixture,
        expiredByNoInjury: 0,
        expiredByLineupReturn: 0,
        totalExpired: expiredByFixture,
        remainingActive: 0,
      });
    }

    const playerIds = [...new Set(activeAvail.map(a => a.playerId))];

    // 활성 부상 기록 조회 (부상 날짜 포함)
    const injuries = await prisma.injury.findMany({
      where: { playerId: { in: playerIds } },
      select: { playerId: true, fixtureDate: true },
      orderBy: { fixtureDate: 'desc' },
    });
    const latestInjuryDateByPlayer = new Map<number, Date>();
    for (const inj of injuries) {
      if (!latestInjuryDateByPlayer.has(inj.playerId)) {
        latestInjuryDateByPlayer.set(inj.playerId, inj.fixtureDate);
      }
    }

    // 라인업 출전 기록 조회 (최근 90일) — status 필터 없음 (entity-matcher와 동일)
    // 경기가 DB에 FT로 업데이트되지 않았더라도 라인업 데이터가 있으면 복귀로 처리
    const appearances = await prisma.fixtureLineupPlayer.findMany({
      where: {
        playerId: { in: playerIds },
        lineup: {
          fixture: {
            date: { gte: new Date(Date.now() - 90 * 86_400_000) },
          },
        },
      },
      select: {
        playerId: true,
        lineup: { select: { fixture: { select: { date: true } } } },
      },
    });
    const latestAppearanceByPlayer = new Map<number, Date>();
    for (const app of appearances) {
      const d = app.lineup.fixture.date;
      const prev = latestAppearanceByPlayer.get(app.playerId);
      if (!prev || d > prev) latestAppearanceByPlayer.set(app.playerId, d);
    }

    // ② 부상 기록 없는 선수, ③ 복귀 확인된 선수
    const toExpireIds: number[] = [];
    for (const avail of activeAvail) {
      const injuryDate = latestInjuryDateByPlayer.get(avail.playerId);
      const lastPlayed = latestAppearanceByPlayer.get(avail.playerId);

      if (!injuryDate) {
        // 부상 기록 자체가 없음 → 잘못 수집된 신호
        toExpireIds.push(avail.id);
      } else if (lastPlayed && lastPlayed > injuryDate) {
        // 부상 이후 경기에 출전 → 이미 복귀
        toExpireIds.push(avail.id);
      }
    }

    let expiredByNoInjury = 0;
    let expiredByLineupReturn = 0;

    if (toExpireIds.length > 0) {
      // 구분을 위해 두 번에 나눠서 업데이트
      const noInjuryIds = activeAvail
        .filter(a => toExpireIds.includes(a.id) && !latestInjuryDateByPlayer.has(a.playerId))
        .map(a => a.id);
      const returnedIds = toExpireIds.filter(id => !noInjuryIds.includes(id));

      if (noInjuryIds.length > 0) {
        const r = await prisma.playerAvailability.updateMany({
          where: { id: { in: noInjuryIds } },
          data: { expired: true },
        });
        expiredByNoInjury = r.count;
      }
      if (returnedIds.length > 0) {
        const r = await prisma.playerAvailability.updateMany({
          where: { id: { in: returnedIds } },
          data: { expired: true },
        });
        expiredByLineupReturn = r.count;
      }
    }

    const totalExpired = expiredByFixture + expiredByNoInjury + expiredByLineupReturn;

    // 디버그: 만료 안 된 활성 레코드의 선수 정보 조회
    const stillActive = await prisma.playerAvailability.findMany({
      where: { expired: false },
      select: {
        id: true,
        playerId: true,
        predictedAvailability: true,
        lastSignalAt: true,
        player: { select: { name: true } },
        fixture: { select: { date: true, status: true, homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } } },
      },
    });

    const remainingActive = stillActive.length;

    // 각 선수에 대해 왜 만료 안 됐는지 진단 정보 추가
    const debugInfo = stillActive.map(a => {
      const injuryDate = latestInjuryDateByPlayer.get(a.playerId);
      const lastPlayed = latestAppearanceByPlayer.get(a.playerId);
      let reason = '알 수 없음';
      if (!injuryDate) reason = '부상 기록 없음인데 만료 안 됨 (버그)';
      else if (!lastPlayed) reason = `라인업 출전 기록 없음 (부상일: ${injuryDate.toISOString().slice(0,10)})`;
      else if (lastPlayed <= injuryDate) reason = `최근 출전(${lastPlayed.toISOString().slice(0,10)}) ≤ 부상일(${injuryDate.toISOString().slice(0,10)})`;
      return {
        playerName: a.player?.name,
        playerId: a.playerId,
        fixtureDate: a.fixture?.date,
        fixtureStatus: a.fixture?.status,
        fixture: a.fixture ? `${a.fixture.homeTeam?.name} vs ${a.fixture.awayTeam?.name}` : null,
        injuryDate: injuryDate?.toISOString().slice(0,10) ?? null,
        lastLineupAppearance: lastPlayed?.toISOString().slice(0,10) ?? null,
        reason,
      };
    });

    console.log(`[Admin] expire-stale: 경기완료/과거=${expiredByFixture}, 부상없음=${expiredByNoInjury}, 복귀확인=${expiredByLineupReturn}, 총=${totalExpired}, 잔여=${remainingActive}`);
    if (debugInfo.length > 0) {
      console.log('[Admin] expire-stale 잔여 활성 선수:', JSON.stringify(debugInfo, null, 2));
    }

    res.json({
      expiredByFixture,
      expiredByNoInjury,
      expiredByLineupReturn,
      totalExpired,
      remainingActive,
      debug: debugInfo,
    });
  } catch (err) {
    next(err);
  }
});
