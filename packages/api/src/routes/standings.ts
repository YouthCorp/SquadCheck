import { Router } from 'express';
import { getPrisma, resolveSeason } from '../lib/prisma';
import { cached } from '../lib/cache';

export const standingsRouter = Router();

// GET /api/standings?league=39&season=2024
standingsRouter.get('/', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const leagueApiId = parseInt(req.query.league as string);
    const season = await resolveSeason(prisma, req.query.season as string);

    if (!leagueApiId) return res.status(400).json({ error: 'league parameter required' });

    const league = await prisma.league.findUnique({ where: { apiFootballId: leagueApiId } });
    if (!league) return res.status(404).json({ error: 'League not found' });

    const standing = await cached(`standings:${league.id}:${season}`, 300, () =>
      prisma.standing.findUnique({
        where: { leagueId_season: { leagueId: league.id, season } },
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

    if (!standing) return res.status(404).json({ error: 'Standings not found for this season' });
    res.json(standing);
  } catch (err) {
    next(err);
  }
});
