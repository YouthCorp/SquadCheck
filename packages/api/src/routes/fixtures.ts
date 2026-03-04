import { Router } from 'express';
import { getPrisma } from '../lib/prisma';

export const fixturesRouter = Router();

// GET /api/fixtures/upcoming?league=39&limit=10
// GET /api/fixtures/upcoming?league=39&all=true  — returns all upcoming NS fixtures across all leagues (no limit)
fixturesRouter.get('/upcoming', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const leagueApiId = req.query.league ? parseInt(req.query.league as string) : undefined;
    const fetchAll = req.query.all === 'true';
    const limit = fetchAll ? 500 : (parseInt(req.query.limit as string) || 10);

    // Always filter by date >= now so stale NS fixtures (not yet synced after match day) don't appear
    const where: any = { status: 'NS', date: { gte: new Date() } };

    if (leagueApiId) {
      const league = await prisma.league.findUnique({ where: { apiFootballId: leagueApiId } });
      if (league) where.leagueId = league.id;
    }

    const fixtures = await prisma.fixture.findMany({
      where,
      include: {
        homeTeam: { select: { id: true, name: true, logo: true } },
        awayTeam: { select: { id: true, name: true, logo: true } },
        league: { select: { id: true, name: true, logo: true } },
      },
      orderBy: { date: 'asc' },
      take: limit,
    });
    res.json(fixtures);
  } catch (err) {
    next(err);
  }
});

// GET /api/fixtures/:id
fixturesRouter.get('/:id', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const fixtureId = parseInt(req.params.id);

    const fixture = await prisma.fixture.findUnique({
      where: { id: fixtureId },
      include: {
        homeTeam: true,
        awayTeam: true,
        league: { select: { id: true, name: true, logo: true } },
        statistics: {
          include: { team: { select: { id: true, name: true } } },
        },
        lineups: {
          include: {
            team: { select: { id: true, name: true, logo: true } },
            players: {
              include: { player: { select: { id: true, name: true, photo: true } } },
              orderBy: [{ isStarting: 'desc' }, { grid: 'asc' }],
            },
          },
        },
        events: {
          include: {
            player: { select: { id: true, name: true } },
            assist: { select: { id: true, name: true } },
          },
          orderBy: [{ timeElapsed: 'asc' }, { timeExtra: 'asc' }],
        },
      },
    });

    if (!fixture) return res.status(404).json({ error: 'Fixture not found' });
    res.json(fixture);
  } catch (err) {
    next(err);
  }
});

// GET /api/fixtures/:id/player-stats
fixturesRouter.get('/:id/player-stats', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const fixtureId = parseInt(req.params.id);

    const stats = await prisma.fixturePlayerStats.findMany({
      where: { fixtureId },
      include: {
        player: { select: { id: true, name: true, photo: true } },
      },
      orderBy: [{ teamId: 'asc' }, { rating: 'desc' }],
    });
    res.json(stats);
  } catch (err) {
    next(err);
  }
});
