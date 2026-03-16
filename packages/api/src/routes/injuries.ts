import { Router } from 'express';
import { getPrisma, resolveSeason } from '../lib/prisma';
import { cached } from '../lib/cache';
import { resolveAbsenceTransitions } from '@squadcheck/analysis';

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

      // 1. Recent injuries — delegates to shared resolveAbsenceTransitions().
      const recentInjuries = await resolveAbsenceTransitions(prisma, season, TOP5_LEAGUE_IDS);

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
