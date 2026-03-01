import { Router } from 'express';
import { getPrisma } from '../lib/prisma';

export const playersRouter = Router();

// GET /api/players/:id
playersRouter.get('/:id', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const player = await prisma.player.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        seasonStats: {
          include: { season: { include: { league: { select: { name: true, logo: true } } } } },
          orderBy: { season: { year: 'desc' } },
        },
      },
    });
    if (!player) return res.status(404).json({ error: 'Player not found' });
    res.json(player);
  } catch (err) {
    next(err);
  }
});

// GET /api/players/:id/stats?season=2024
playersRouter.get('/:id/stats', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const playerId = parseInt(req.params.id);
    const season = req.query.season ? parseInt(req.query.season as string) : undefined;

    const where: any = { playerId };
    if (season) {
      const seasonRecord = await prisma.season.findFirst({ where: { year: season } });
      if (seasonRecord) where.seasonId = seasonRecord.id;
    }

    const stats = await prisma.playerSeasonStats.findMany({
      where,
      include: { season: { include: { league: { select: { name: true, logo: true } } } } },
      orderBy: { season: { year: 'desc' } },
    });
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// GET /api/players/:id/injuries
playersRouter.get('/:id/injuries', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const playerId = parseInt(req.params.id);

    const [injuries, appearances] = await Promise.all([
      prisma.injury.findMany({
        where: { playerId },
        include: {
          team: { select: { id: true, name: true, logo: true } },
          league: { select: { id: true, name: true } },
          fixture: {
            select: {
              id: true, date: true, round: true,
              homeTeam: { select: { id: true, name: true, logo: true } },
              awayTeam: { select: { id: true, name: true, logo: true } },
              goalsHome: true, goalsAway: true,
            },
          },
        },
        orderBy: { fixtureDate: 'desc' },
      }),
      prisma.fixtureLineupPlayer.findMany({
        where: { playerId },
        select: {
          lineup: {
            select: {
              teamId: true,
              fixture: {
                select: {
                  id: true, date: true, round: true, season: true,
                  homeTeam: { select: { id: true, name: true } },
                  awayTeam: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
        orderBy: { lineup: { fixture: { date: 'desc' } } },
      }),
    ]);

    const matchLog = appearances.map((a) => ({
      teamId: a.lineup.teamId,
      fixtureId: a.lineup.fixture.id,
      date: a.lineup.fixture.date,
      round: a.lineup.fixture.round,
      season: a.lineup.fixture.season,
      homeTeam: a.lineup.fixture.homeTeam,
      awayTeam: a.lineup.fixture.awayTeam,
    }));

    res.json({ injuries, appearances: matchLog });
  } catch (err) {
    next(err);
  }
});

// GET /api/players/:id/match-stats?season=2024
playersRouter.get('/:id/match-stats', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const playerId = parseInt(req.params.id);
    const season = req.query.season ? parseInt(req.query.season as string) : undefined;

    const where: any = { playerId };
    if (season) {
      where.fixture = { season };
    }

    const matchStats = await prisma.fixturePlayerStats.findMany({
      where,
      include: {
        fixture: {
          select: {
            id: true, date: true, round: true,
            homeTeam: { select: { id: true, name: true } },
            awayTeam: { select: { id: true, name: true } },
            goalsHome: true, goalsAway: true,
          },
        },
      },
      orderBy: { fixture: { date: 'desc' } },
      take: 50,
    });
    res.json(matchStats);
  } catch (err) {
    next(err);
  }
});
