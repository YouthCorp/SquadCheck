import { Router } from 'express';
import { getPrisma, resolveSeason } from '../lib/prisma';
import { cached } from '../lib/cache';

export const injuriesRouter = Router();

// GET /api/injuries?league=39&season=2024&page=1&limit=50
injuriesRouter.get('/', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const leagueApiId = req.query.league ? parseInt(req.query.league as string) : undefined;
    const season = req.query.season ? parseInt(req.query.season as string) : undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (leagueApiId) {
      const league = await prisma.league.findUnique({ where: { apiFootballId: leagueApiId } });
      if (league) where.leagueId = league.id;
    }
    if (season) where.season = season;

    const [injuries, total] = await Promise.all([
      prisma.injury.findMany({
        where,
        include: {
          player: { select: { id: true, name: true, photo: true, position: true } },
          team: { select: { id: true, name: true, logo: true } },
          fixture: { select: { id: true, date: true, round: true } },
        },
        orderBy: { fixtureDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.injury.count({ where }),
    ]);

    res.json({
      data: injuries,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/injuries/live-updates?season=2025
injuriesRouter.get('/live-updates', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const season = await resolveSeason(prisma, req.query.season as string);

    const cacheKey = `injuries:live-updates:${season}`;

    const result = await cached(cacheKey, 60, async () => {
      // 1. Recent injuries — show the 20 players whose injuries started most recently.
      // "Injury start" = the earliest fixture they missed this season (MIN fixtureDate).
      // Two-query strategy to avoid loading all 14k+ records:
      //   Query A: groupBy playerId → MIN(fixtureDate) ordered DESC, take 20
      //   Query B: fetch full details for those 20 players
      const now = new Date();
      const TOP5_LEAGUE_IDS = [39, 140, 135, 78, 61];

      // Only genuine injuries — exclude disciplinary, squad management, and non-injury absences.
      const NOT_DISCIPLINARY = {
        NOT: {
          OR: [
            { reason: { contains: 'red card',           mode: 'insensitive' as const } },
            { reason: { equals:   'suspended',          mode: 'insensitive' as const } },
            { reason: { equals:   'suspension',         mode: 'insensitive' as const } },
            { reason: { contains: 'yellow card',        mode: 'insensitive' as const } },
            // Non-injury exclusions
            { reason: { equals:   'international duty', mode: 'insensitive' as const } },
            { reason: { equals:   'inactive',           mode: 'insensitive' as const } },
            { reason: { contains: 'coach',              mode: 'insensitive' as const } },
            { reason: { equals:   'loan agreement',     mode: 'insensitive' as const } },
            { reason: { equals:   'rest',               mode: 'insensitive' as const } },
            { reason: { equals:   'doping',             mode: 'insensitive' as const } },
          ],
        },
      };

      // Query A: 최근 N일 이내에 "처음" 부상한 선수만 (= 신규 부상자)
      // HAVING MIN(fixtureDate) >= cutoff 를 사용해 장기 결장자 제외
      // 45일 윈도우 → 결과 5명 미만이면 90일로 확장 (비시즌 기간 등 대비)
      const buildInjuryGroupBy = (cutoff: Date) =>
        prisma.injury.groupBy({
          by: ['playerId'],
          where: {
            season,
            fixtureDate: { lte: now },
            league: { apiFootballId: { in: TOP5_LEAGUE_IDS } },
            ...NOT_DISCIPLINARY,
          },
          _min: { fixtureDate: true },
          having: { fixtureDate: { _min: { gte: cutoff } } },
          orderBy: { _min: { fixtureDate: 'desc' } },
          take: 20,
        });

      const cutoff45 = new Date(Date.now() - 45 * 86_400_000);
      let injuryStarts = await buildInjuryGroupBy(cutoff45);
      if (injuryStarts.length < 5) {
        const cutoff90 = new Date(Date.now() - 90 * 86_400_000);
        injuryStarts = await buildInjuryGroupBy(cutoff90);
      }

      // Query B: fetch full record for each player (their earliest fixture = start date)
      const playerIds = injuryStarts.map((s) => s.playerId);
      const fullRecords = await prisma.injury.findMany({
        where: {
          season,
          playerId: { in: playerIds },
          fixtureDate: { lte: now },
          league: { apiFootballId: { in: TOP5_LEAGUE_IDS } },
          ...NOT_DISCIPLINARY,
        },
        orderBy: { fixtureDate: 'asc' },
        include: {
          player: { select: { id: true, name: true, photo: true, position: true } },
          team: { select: { id: true, name: true, logo: true } },
          league: { select: { id: true, name: true, logo: true, apiFootballId: true } },
        },
      });

      // Keep only the first (earliest) record per player
      const seenInjury = new Set<number>();
      const dedupedFull = fullRecords.filter((r) => {
        if (seenInjury.has(r.playerId)) return false;
        seenInjury.add(r.playerId);
        return true;
      });

      // Query C-0: moderate-impact filter — 프린지/2군 선수 제외
      // player_season_stats.rating >= 6.8 (Moderate 수준 이상) + lineups >= 5
      // rating은 player-weight 계산의 핵심 인자 → injury-impact 카드의 severity와 상관관계 높음
      // OR lineups >= 8: 주전급이면 rating 무관하게 포함 (비율: ~1/3 시즌 선발)
      const firstTeamStats = await prisma.playerSeasonStats.findMany({
        where: {
          playerId: { in: playerIds },
          season: { year: season },
          leagueApiId: { in: TOP5_LEAGUE_IDS },
          OR: [
            { lineups: { gte: 5 }, rating: { gte: 6.8 } },
            { lineups: { gte: 8 } },
          ],
        },
        select: { playerId: true },
      });
      const firstTeamPlayerIds = new Set(firstTeamStats.map((s) => s.playerId));
      const firstTeamDedupedFull = dedupedFull.filter((r) => firstTeamPlayerIds.has(r.playerId));

      // Query C: lineup cross-check — 부상일 이후 출전한 선수 제외 (복귀 처리)
      // injury-resolver / entity-matcher 와 동일한 1일 버퍼 적용 (UTC 타임존 보정)
      const ONE_DAY_MS = 86_400_000;
      const injuryStartByPlayer = new Map(
        firstTeamDedupedFull.map((r) => [r.playerId, new Date(r.fixtureDate)]),
      );
      const firstTeamPlayerIdList = [...firstTeamPlayerIds];
      const lineupAppearances = await prisma.fixtureLineupPlayer.findMany({
        where: {
          playerId: { in: firstTeamPlayerIdList },
          lineup: { fixture: { date: { gte: new Date(Date.now() - 90 * ONE_DAY_MS) } } },
        },
        select: {
          playerId: true,
          isStarting: true,
          lineup: { select: { fixture: { select: { date: true } } } },
        },
      });
      const returnedIds = new Set<number>();
      // Last start BEFORE injury date — used as a better proxy for "when injury happened"
      const lastStartBeforeInjury = new Map<number, Date>();
      for (const app of lineupAppearances) {
        const injuryStart = injuryStartByPlayer.get(app.playerId);
        const appDate = app.lineup.fixture.date;
        if (injuryStart && appDate.getTime() >= injuryStart.getTime() - ONE_DAY_MS) {
          returnedIds.add(app.playerId);
        }
        // Track last appearance (start OR sub) before injury — best injury date proxy
        if (injuryStart && appDate < injuryStart) {
          const existing = lastStartBeforeInjury.get(app.playerId);
          if (!existing || appDate > existing) lastStartBeforeInjury.set(app.playerId, appDate);
        }
      }

      const recentInjuries = firstTeamDedupedFull
        .filter((r) => !returnedIds.has(r.playerId))
        .sort((a, b) => {
          const dateA = lastStartBeforeInjury.get(a.playerId) ?? new Date(a.fixtureDate);
          const dateB = lastStartBeforeInjury.get(b.playerId) ?? new Date(b.fixtureDate);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 20)
        .map((r) => ({
          ...r,
          lastStartFixtureDate: lastStartBeforeInjury.get(r.playerId)?.toISOString() ?? null,
        }));

      // 2. Recovery signals — from player_availability (deduplicated by player)
      const allSignals = await prisma.playerAvailability.findMany({
        where: { expired: false, signalCount: { gt: 0 } },
        orderBy: { lastSignalAt: 'desc' },
        include: {
          player: { select: { id: true, name: true, photo: true, position: true } },
          fixture: {
            select: {
              id: true,
              date: true,
              homeTeam: { select: { id: true, name: true, logo: true } },
              awayTeam: { select: { id: true, name: true, logo: true } },
            },
          },
        },
        take: 200,
      });

      const seenSignal = new Set<number>();
      const dedupedSignals = allSignals
        .filter((pa) => {
          if (seenSignal.has(pa.playerId)) return false;
          seenSignal.add(pa.playerId);
          return true;
        })
        .slice(0, 20);

      // Fetch team info separately (no team relation on PlayerAvailability)
      const teamIds = [...new Set(dedupedSignals.map((s) => s.teamId))];
      const teams = await prisma.team.findMany({
        where: { id: { in: teamIds } },
        select: { id: true, name: true, logo: true },
      });
      const teamMap = new Map(teams.map((t) => [t.id, t]));

      const recentSignals = dedupedSignals.map((pa) => ({
        playerId: pa.playerId,
        player: pa.player,
        team: teamMap.get(pa.teamId) ?? null,
        predictedAvailability: pa.predictedAvailability,
        confidenceLevel: pa.confidenceLevel,
        latestSignalStage: pa.latestSignalStage,
        lastSignalAt: pa.lastSignalAt,
        signalCount: pa.signalCount,
        officialStatus: pa.officialStatus,
        upcomingFixture: pa.fixture ? {
          id: pa.fixture.id,
          date: pa.fixture.date,
          homeTeam: { id: pa.fixture.homeTeam.id, name: pa.fixture.homeTeam.name, logo: pa.fixture.homeTeam.logo },
          awayTeam: { id: pa.fixture.awayTeam.id, name: pa.fixture.awayTeam.name, logo: pa.fixture.awayTeam.logo },
        } : null,
      }));

      return { recentInjuries, recentSignals };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/injuries/summary?league=39&season=2024
injuriesRouter.get('/summary', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const leagueApiId = req.query.league ? parseInt(req.query.league as string) : undefined;
    const season = await resolveSeason(prisma, req.query.season as string);

    const cacheKey = `injuries:summary:${leagueApiId}:${season}`;

    const summary = await cached(cacheKey, 300, async () => {
      const where: any = { season };
      if (leagueApiId) {
        const league = await prisma.league.findUnique({ where: { apiFootballId: leagueApiId } });
        if (league) where.leagueId = league.id;
      }

      const grouped = await prisma.injury.groupBy({
        by: ['teamId'],
        where,
        _count: { id: true },
      });

      const teams = await prisma.team.findMany({
        where: { id: { in: grouped.map((g) => g.teamId) } },
        select: { id: true, name: true, logo: true },
      });

      const teamMap = new Map(teams.map((t) => [t.id, t]));

      return grouped
        .map((g) => ({
          team: teamMap.get(g.teamId),
          injuryCount: g._count.id,
        }))
        .sort((a, b) => b.injuryCount - a.injuryCount);
    });

    res.json(summary);
  } catch (err) {
    next(err);
  }
});
