import { Router } from 'express';
import { getPrisma, resolveSeason } from '../lib/prisma';
import { cached } from '../lib/cache';

export const leaguesRouter = Router();

// GET /api/leagues
leaguesRouter.get('/', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const leagues = await cached('leagues:all', 3600, () =>
      prisma.league.findMany({
        include: {
          seasons: { orderBy: { year: 'desc' }, select: { id: true, year: true, current: true } },
        },
        orderBy: { name: 'asc' },
      }),
    );
    res.json(leagues);
  } catch (err) {
    next(err);
  }
});

// GET /api/leagues/:id
leaguesRouter.get('/:id', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const league = await prisma.league.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        seasons: { orderBy: { year: 'desc' } },
      },
    });
    if (!league) return res.status(404).json({ error: 'League not found' });
    res.json(league);
  } catch (err) {
    next(err);
  }
});

// GET /api/leagues/:id/standings?season=2024
leaguesRouter.get('/:id/standings', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const leagueId = parseInt(req.params.id);
    const season = await resolveSeason(prisma, req.query.season as string);

    const standing = await cached(`standings:${leagueId}:${season}`, 300, () =>
      prisma.standing.findUnique({
        where: { leagueId_season: { leagueId, season } },
        include: {
          entries: {
            include: {
              team: { select: { id: true, name: true, logo: true, code: true } },
            },
            orderBy: { rank: 'asc' },
          },
        },
      }),
    );

    if (!standing) return res.status(404).json({ error: 'Standings not found' });
    res.json(standing);
  } catch (err) {
    next(err);
  }
});
