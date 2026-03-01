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
    ] = await Promise.all([
      prisma.league.count(),
      prisma.team.count(),
      prisma.player.count(),
      prisma.fixture.count(),
      prisma.injury.count(),
      prisma.fixtureStatistics.count(),
      prisma.fixtureLineup.count(),
      prisma.fixtureEvent.count(),
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
    });
  } catch (err) {
    next(err);
  }
});
