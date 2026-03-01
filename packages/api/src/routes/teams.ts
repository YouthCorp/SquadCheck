import { Router } from 'express';
import { getPrisma } from '../lib/prisma';
import { cached } from '../lib/cache';

export const teamsRouter = Router();

// GET /api/teams/:id
teamsRouter.get('/:id', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const team = await prisma.team.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!team) return res.status(404).json({ error: 'Team not found' });
    res.json(team);
  } catch (err) {
    next(err);
  }
});

// GET /api/teams/:id/players?season=2024
teamsRouter.get('/:id/players', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const teamId = parseInt(req.params.id);
    const season = req.query.season ? parseInt(req.query.season as string) : undefined;

    const where: any = { teamId };
    if (season) {
      const seasonRecord = await prisma.season.findFirst({ where: { year: season } });
      if (seasonRecord) where.seasonId = seasonRecord.id;
    } else {
      // Default to the latest season available for this team to avoid cross-season duplicates
      const latest = await prisma.playerSeasonStats.findFirst({
        where: { teamId },
        orderBy: { season: { year: 'desc' } },
        select: { seasonId: true },
      });
      if (latest) where.seasonId = latest.seasonId;
    }

    const rows = await prisma.playerSeasonStats.findMany({
      where,
      include: {
        player: { select: { id: true, name: true, photo: true, position: true, nationality: true } },
      },
      orderBy: [{ minutes: 'desc' }],
    });

    // Deduplicate by playerId — same player may have rows for multiple leagues
    // (e.g. EPL + cup comps). Keep the row with the most minutes (first after desc sort).
    const seen = new Set<number>();
    const players = rows.filter(r => {
      if (seen.has(r.playerId)) return false;
      seen.add(r.playerId);
      return true;
    });

    res.json(players);
  } catch (err) {
    next(err);
  }
});

// GET /api/teams/:id/fixtures?season=2024&limit=10
teamsRouter.get('/:id/fixtures', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const teamId = parseInt(req.params.id);
    const season = req.query.season ? parseInt(req.query.season as string) : undefined;
    const limit = parseInt(req.query.limit as string) || 20;

    const where: any = {
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
    };
    if (season) where.season = season;

    const fixtures = await prisma.fixture.findMany({
      where,
      include: {
        homeTeam: { select: { id: true, name: true, logo: true } },
        awayTeam: { select: { id: true, name: true, logo: true } },
        league: { select: { id: true, name: true, logo: true } },
      },
      orderBy: { date: 'desc' },
      take: limit,
    });
    res.json(fixtures);
  } catch (err) {
    next(err);
  }
});

// GET /api/teams/:id/injuries/current
teamsRouter.get('/:id/injuries/current', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const teamId = parseInt(req.params.id);

    // Get most recent injuries (latest fixture date per player)
    const injuries = await prisma.injury.findMany({
      where: { teamId },
      include: {
        player: { select: { id: true, name: true, photo: true, position: true } },
        fixture: { select: { id: true, date: true, status: true } },
      },
      orderBy: { fixtureDate: 'desc' },
      take: 50,
    });

    // Group by player, keep only latest
    const latestByPlayer = new Map<number, typeof injuries[0]>();
    for (const inj of injuries) {
      if (!latestByPlayer.has(inj.playerId)) {
        latestByPlayer.set(inj.playerId, inj);
      }
    }

    res.json(Array.from(latestByPlayer.values()));
  } catch (err) {
    next(err);
  }
});
