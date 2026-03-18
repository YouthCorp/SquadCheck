import { Router } from 'express';
import { getPrisma, resolveSeason } from '../lib/prisma';
import { cached } from '../lib/cache';
import { buildLatestAppearanceMap } from '@squadcheck/analysis';

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
      const TOP5_LEAGUE_IDS = [39, 140, 135, 78, 61];

      // 1. Recent injuries — read from pre-computed player_injury_status table.
      // Populated by the ingestion scheduler (every ~hour). Single source of truth
      // shared with team pages and all analysis endpoints.
      const now = new Date();
      const cutoff = new Date(Date.now() - 45 * 86_400_000);
      // "Inactive" / "Loan Agreement" = registration status markers, not real absences.
      // These players are no longer on the squad and shouldn't appear in the injury panel.
      const SQUAD_STATUS_REASONS = ['inactive', 'loan agreement'];

      const [rawInjuries, leagues] = await Promise.all([
        prisma.playerInjuryStatus.findMany({
          where: {
            leagueApiId: { in: TOP5_LEAGUE_IDS },
            season,
            isActive: true,
            injuredSince: { gte: cutoff, lte: now },
            NOT: { reason: { in: SQUAD_STATUS_REASONS, mode: 'insensitive' } },
          },
          include: {
            player: { select: { id: true, name: true, photo: true, position: true } },
            team:   { select: { id: true, name: true, logo: true } },
          },
          orderBy: { injuredSince: 'desc' },
          take: 60,  // fetch more candidates; filtered and re-sorted by lastAppearanceFixtureDate below
        }),
        prisma.league.findMany({
          where: { apiFootballId: { in: TOP5_LEAGUE_IDS } },
          select: { id: true, name: true, logo: true, apiFootballId: true },
        }),
      ]);
      type LeagueInfo = { id: number; name: string; logo: string | null; apiFootballId: number };
      const leagueMap = new Map<number, LeagueInfo>((leagues as LeagueInfo[]).map(l => [l.apiFootballId, l]));

      // Fetch last appearance date per injured player from lineup data —
      // same source as team page (InjuredPlayerCard.lastAppearanceFixtureDate).
      // This is the most accurate injury date proxy: the last match they played in.
      const injuredPlayerIds = rawInjuries.map((inj: { playerId: number }) => inj.playerId);
      const appearances = await prisma.fixtureLineupPlayer.findMany({
        where: {
          playerId: { in: injuredPlayerIds },
          lineup: { fixture: { season, status: { in: ['FT', 'AET', 'PEN'] } } },
        },
        select: {
          playerId: true,
          lineup: { select: { fixture: { select: { date: true } } } },
        },
      });
      const lastAppearanceDateMap = buildLatestAppearanceMap(appearances);

      type RawInj = { id: number; playerId: number; type: string | null; reason: string | null; injuredSince: Date | null; leagueApiId: number; player: { id: number; name: string; photo: string | null; position: string | null }; team: { id: number; name: string; logo: string | null } };
      type MappedInj = { id: number; type: string; reason: string; fixtureDate: string; lastAppearanceFixtureDate: string | null; player: RawInj['player']; team: RawInj['team']; league: { id: number; name: string; logo: string | null; apiFootballId: number } };

      // Filter to players with at least 1 appearance this season (excludes fringe/loan/youth),
      // then sort by lastAppearanceFixtureDate desc so most recently injured appear first.
      const recentInjuries = (rawInjuries as RawInj[])
        .filter(inj => lastAppearanceDateMap.has(inj.playerId))
        .map((inj): MappedInj => ({
          id:          inj.id,
          type:        inj.type ?? '',
          reason:      inj.reason ?? '',
          fixtureDate: inj.injuredSince?.toISOString() ?? new Date(0).toISOString(),
          lastAppearanceFixtureDate: lastAppearanceDateMap.get(inj.playerId)?.toISOString() ?? null,
          player: inj.player,
          team:   inj.team,
          league: leagueMap.get(inj.leagueApiId) ?? { id: 0, name: '', logo: null, apiFootballId: inj.leagueApiId },
        }))
        .sort((a: MappedInj, b: MappedInj) => {
          const da = a.lastAppearanceFixtureDate ?? a.fixtureDate;
          const db = b.lastAppearanceFixtureDate ?? b.fixtureDate;
          return new Date(db).getTime() - new Date(da).getTime();
        })
        .slice(0, 20);

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

      // Derive league info from rawInjuries (already fetched, leagueApiId = apiFootballId directly).
      // Signal players not in rawInjuries (outside 45-day/top-5 window) get null — acceptable.
      const signalLeagueApiIdMap = new Map<number, number>(
        (rawInjuries as RawInj[]).map((inj) => [inj.playerId, inj.leagueApiId]),
      );

      const recentSignals = dedupedSignals.map((pa) => ({
        playerId: pa.playerId,
        player: pa.player,
        team: teamMap.get(pa.teamId) ?? null,
        leagueApiFootballId: signalLeagueApiIdMap.get(pa.playerId) ?? null,
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
