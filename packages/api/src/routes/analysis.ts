import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { getPrisma, resolveSeason } from '../lib/prisma';
import { cached } from '../lib/cache';
import {
  computePlayerWeights,
  computeRichInjuryImpact,
  computePerformanceDelta,
  computeTeamPowerLoss,
  computePredictedLineup,
} from '@squadcheck/analysis';

export const analysisRouter = Router();

// ── Season chain helper ─────────────────────────────────────
async function resolveSeasonChain(
  prisma: PrismaClient,
  leagueId: number,
  currentYear: number,
  lookback = 2,
): Promise<{ ids: number[]; years: number[] }> {
  const years = Array.from({ length: lookback + 1 }, (_, i) => currentYear - i);
  const seasons = await prisma.season.findMany({
    where: { leagueId, year: { in: years } },
    orderBy: { year: 'desc' },
  });

  const ids: number[] = [];
  const foundYears: number[] = [];
  for (const y of years) {
    const s = seasons.find(s => s.year === y);
    if (s) {
      ids.push(s.id);
      foundYears.push(s.year);
    }
  }
  return { ids, years: foundYears };
}

async function resolveTeamLeague(prisma: PrismaClient, teamId: number): Promise<number | null> {
  // Find leagueId from a standing entry or season stats
  const entry = await prisma.playerSeasonStats.findFirst({
    where: { teamId },
    select: { season: { select: { leagueId: true } } },
    orderBy: { seasonId: 'desc' },
  });
  return entry?.season.leagueId ?? null;
}

// ── GET /api/analysis/team-power/:teamId?season=2024 ────────
analysisRouter.get('/team-power/:teamId', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const teamId = parseInt(req.params.teamId);
    const season = await resolveSeason(prisma, req.query.season as string);

    const cacheKey = `analysis:team-power:${teamId}:${season}`;

    const result = await cached(cacheKey, 300, async () => {
      const team = await prisma.team.findUnique({ where: { id: teamId } });
      if (!team) return null;

      const leagueId = await resolveTeamLeague(prisma, teamId);
      if (!leagueId) return null;

      const chain = await resolveSeasonChain(prisma, leagueId, season);
      if (chain.ids.length === 0) return null;

      const weights = await computePlayerWeights(prisma, teamId, chain.ids, chain.years);
      if (weights.length === 0) return { team, season, players: [], totalWeight: 0 };

      const totalWeight = weights.reduce((sum, pw) => sum + pw.weight, 0);

      // Fetch player photos for backward compatibility
      const playerIds = weights.map(w => w.playerId);
      const players = await prisma.player.findMany({
        where: { id: { in: playerIds } },
        select: { id: true, name: true, photo: true, position: true },
      });
      const photoMap = new Map(players.map(p => [p.id, p]));

      const enrichedPlayers = weights.map(w => ({
        player: photoMap.get(w.playerId) || { id: w.playerId, name: w.playerName, photo: null, position: w.position },
        position: w.position,
        positionGroup: w.positionGroup,
        weight: w.weight,
        rawWeight: w.rawWeight,
        decayFactor: w.decayFactor,
        dataSource: w.dataSource,
        components: w.components,
        skillBreakdown: w.skillBreakdown,
        stats: w.stats,
      }));

      return { team, season, players: enrichedPlayers, totalWeight: Math.round(totalWeight * 1000) / 1000 };
    });

    if (!result) return res.status(404).json({ error: 'Team or season not found' });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/analysis/injury-impact/:teamId?season=2024 ─────
analysisRouter.get('/injury-impact/:teamId', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const teamId = parseInt(req.params.teamId);
    const season = await resolveSeason(prisma, req.query.season as string);

    const cacheKey = `analysis:injury-impact:${teamId}:${season}`;

    const result = await cached(cacheKey, 300, async () => {
      const team = await prisma.team.findUnique({ where: { id: teamId } });
      if (!team) return null;

      const leagueId = await resolveTeamLeague(prisma, teamId);
      if (!leagueId) return null;

      const chain = await resolveSeasonChain(prisma, leagueId, season);
      if (chain.ids.length === 0) return null;

      const rich = await computeRichInjuryImpact(prisma, teamId, chain.ids, chain.years, season);
      if (!rich) return null;

      // Fetch current-season stats directly — avoids showing prior-season
      // goals/assists for players who were injured all current season.
      const playerIds = rich.enrichedInjuredPlayers.map(p => p.playerId);
      const [players, currentSeasonStats] = await Promise.all([
        prisma.player.findMany({
          where: { id: { in: playerIds } },
          select: { id: true, name: true, photo: true, position: true },
        }),
        prisma.playerSeasonStats.findMany({
          where: { playerId: { in: playerIds }, teamId, seasonId: chain.ids[0] },
          select: { playerId: true, goalsTotal: true, assists: true, minutes: true, appearances: true },
        }),
      ]);
      const photoMap = new Map(players.map(p => [p.id, p]));
      const currentStatsMap = new Map(currentSeasonStats.map(s => [s.playerId, s]));

      return {
        team,
        season,
        totalWeight: rich.powerLoss.totalWeight,
        injuredWeight: rich.powerLoss.injuredWeight,
        powerLossPct: rich.powerLoss.powerLossPct,
        compositeImpactTotal: rich.powerLoss.compositeImpactTotal,
        totalInjuries: rich.totalInjuries,
        uniquePlayers: rich.uniquePlayers,
        severitySummary: rich.severitySummary,
        injuredPlayers: rich.enrichedInjuredPlayers.map(p => {
          const cs = currentStatsMap.get(p.playerId);
          return {
            player: photoMap.get(p.playerId) || { id: p.playerId, name: p.playerName, photo: null, position: p.position },
            weight: p.weight,
            weightPct: p.weightPct,
            positionGroup: p.positionGroup,
            dataSource: p.dataSource,
            injury: { type: p.injuryType, reason: p.injuryReason, date: p.injuryDate },
            injuryContext: p.injuryContext,
            starterProfile: p.starterProfile,
            performanceDelta: p.performanceDelta,
            hasSignificantSample: p.hasSignificantSample,
            winRateBoost: p.winRateBoost,
            compositeImpactScore: p.compositeImpactScore,
            severity: p.severity,
            stats: {
              goals: cs?.goalsTotal ?? 0,
              assists: cs?.assists ?? 0,
              minutes: cs?.minutes ?? 0,
              appearances: cs?.appearances ?? 0,
            },
          };
        }),
        injuryTypes: rich.injuryTypes,
        injuryReasons: rich.injuryReasons,
        monthlyDistribution: rich.monthlyDistribution,
        mostInjuredPlayers: rich.mostInjuredPlayers,
      };
    });

    if (!result) return res.status(404).json({ error: 'Team or season not found' });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/analysis/player-weight/:playerId?season=2024 ───
analysisRouter.get('/player-weight/:playerId', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const playerId = parseInt(req.params.playerId);
    const season = await resolveSeason(prisma, req.query.season as string);

    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) return res.status(404).json({ error: 'Player not found' });

    // Find the team for this player in this season
    const ps = await prisma.playerSeasonStats.findFirst({
      where: { playerId },
      include: { season: { select: { leagueId: true, year: true } } },
      orderBy: { seasonId: 'desc' },
    });

    if (!ps) return res.json({ player, season, weight: 0, components: {}, dataSource: 'none' });

    const chain = await resolveSeasonChain(prisma, ps.season.leagueId, season);
    if (chain.ids.length === 0) return res.json({ player, season, weight: 0, components: {}, dataSource: 'none' });

    const weights = await computePlayerWeights(prisma, ps.teamId, chain.ids, chain.years);
    const pw = weights.find(w => w.playerId === playerId);

    if (!pw) return res.json({ player, season, weight: 0, components: {}, dataSource: 'none' });

    res.json({
      player,
      season,
      weight: pw.weight,
      rawWeight: pw.rawWeight,
      decayFactor: pw.decayFactor,
      dataSource: pw.dataSource,
      positionGroup: pw.positionGroup,
      components: pw.components,
      skillBreakdown: pw.skillBreakdown,
      stats: pw.stats,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/analysis/player-impact/:playerId?teamId=X&season=2024 ──
analysisRouter.get('/player-impact/:playerId', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const playerId = parseInt(req.params.playerId);
    const season = await resolveSeason(prisma, req.query.season as string);
    const teamIdParam = req.query.teamId ? parseInt(req.query.teamId as string) : null;

    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) return res.status(404).json({ error: 'Player not found' });

    // Resolve team
    let teamId = teamIdParam;
    if (!teamId) {
      const ps = await prisma.playerSeasonStats.findFirst({
        where: { playerId },
        orderBy: { seasonId: 'desc' },
      });
      teamId = ps?.teamId ?? null;
    }
    if (!teamId) return res.status(404).json({ error: 'Could not resolve team for player' });

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const leagueId = await resolveTeamLeague(prisma, teamId);
    if (!leagueId) return res.status(404).json({ error: 'League not found' });

    const chain = await resolveSeasonChain(prisma, leagueId, season);
    if (chain.ids.length === 0) return res.status(404).json({ error: 'Season not found' });

    // Weight
    const weights = await computePlayerWeights(prisma, teamId, chain.ids, chain.years);
    const pw = weights.find(w => w.playerId === playerId);

    // Performance delta
    const perfDelta = await computePerformanceDelta(prisma, teamId, playerId, season);

    // Injury history
    const injuries = await prisma.injury.findMany({
      where: { playerId, season },
      orderBy: { fixtureDate: 'desc' },
    });

    res.json({
      player,
      team: { id: team.id, name: team.name },
      season,
      weight: pw ? {
        weight: pw.weight,
        rawWeight: pw.rawWeight,
        decayFactor: pw.decayFactor,
        dataSource: pw.dataSource,
        positionGroup: pw.positionGroup,
        components: pw.components,
        skillBreakdown: pw.skillBreakdown,
        stats: pw.stats,
      } : null,
      performanceDelta: perfDelta ? {
        withPlayer: perfDelta.withPlayer,
        withoutPlayer: perfDelta.withoutPlayer,
        delta: perfDelta.delta,
      } : null,
      injuries: injuries.map(i => ({
        type: i.type,
        reason: i.reason,
        date: i.fixtureDate,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/analysis/team-impact-report/:teamId?season=2024 ──
analysisRouter.get('/team-impact-report/:teamId', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const teamId = parseInt(req.params.teamId);
    const season = await resolveSeason(prisma, req.query.season as string);

    const cacheKey = `analysis:team-impact-report:${teamId}:${season}`;

    const result = await cached(cacheKey, 300, async () => {
      const team = await prisma.team.findUnique({ where: { id: teamId } });
      if (!team) return null;

      const leagueId = await resolveTeamLeague(prisma, teamId);
      if (!leagueId) return null;

      const chain = await resolveSeasonChain(prisma, leagueId, season);
      if (chain.ids.length === 0) return null;

      const powerLoss = await computeTeamPowerLoss(prisma, teamId, chain.ids, chain.years, season);
      if (!powerLoss) return null;

      // Fetch player photos
      const allPlayerIds = [
        ...powerLoss.enrichedInjuredPlayers.map(p => p.playerId),
        ...powerLoss.healthyTopPlayers.map(p => p.playerId),
      ];
      const players = await prisma.player.findMany({
        where: { id: { in: allPlayerIds } },
        select: { id: true, name: true, photo: true, position: true },
      });
      const photoMap = new Map(players.map(p => [p.id, p]));

      return {
        team,
        season,
        seasonChain: { ids: chain.ids, years: chain.years },
        summary: {
          totalWeight: powerLoss.totalWeight,
          injuredWeight: powerLoss.injuredWeight,
          powerLossPct: powerLoss.powerLossPct,
          compositeImpactTotal: powerLoss.compositeImpactTotal,
          injuredCount: powerLoss.enrichedInjuredPlayers.length,
        },
        injuredPlayers: powerLoss.enrichedInjuredPlayers.map(p => ({
          player: photoMap.get(p.playerId) || { id: p.playerId, name: p.playerName, photo: null, position: p.position },
          weight: p.weight,
          weightPct: p.weightPct,
          positionGroup: p.positionGroup,
          dataSource: p.dataSource,
          injury: { type: p.injuryType, reason: p.injuryReason, date: p.injuryDate },
          injuryContext: p.injuryContext,
          starterProfile: p.starterProfile,
          performanceDelta: p.performanceDelta,
          hasSignificantSample: p.hasSignificantSample,
          winRateBoost: p.winRateBoost,
          compositeImpactScore: p.compositeImpactScore,
          severity: p.severity,
        })),
        healthyTopPlayers: powerLoss.healthyTopPlayers.map(p => ({
          player: photoMap.get(p.playerId) || { id: p.playerId, name: p.playerName, photo: null, position: p.position },
          weight: p.weight,
          positionGroup: p.positionGroup,
          dataSource: p.dataSource,
          components: p.components,
        })),
      };
    });

    if (!result) return res.status(404).json({ error: 'Team or season not found' });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/analysis/predicted-lineup/:teamId?season=2024 ──
analysisRouter.get('/predicted-lineup/:teamId', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const teamId = parseInt(req.params.teamId);
    const season = await resolveSeason(prisma, req.query.season as string);

    const cacheKey = `analysis:predicted-lineup:${teamId}:${season}`;

    const result = await cached(cacheKey, 300, async () => {
      const leagueId = await resolveTeamLeague(prisma, teamId);
      if (!leagueId) return null;

      const chain = await resolveSeasonChain(prisma, leagueId, season);
      if (chain.ids.length === 0) return null;

      const lineup = await computePredictedLineup(prisma, teamId, chain.ids, chain.years, season);
      if (!lineup) return null;

      return lineup;
    });

    if (!result) return res.status(404).json({ error: 'Team or season not found' });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/analysis/matchup?home=:id&away=:id&season=2024 ──
analysisRouter.get('/matchup', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const homeId = parseInt(req.query.home as string);
    const awayId = parseInt(req.query.away as string);
    const season = await resolveSeason(prisma, req.query.season as string);

    if (!homeId || !awayId) return res.status(400).json({ error: 'home and away parameters required' });

    const [homeTeam, awayTeam] = await Promise.all([
      prisma.team.findUnique({ where: { id: homeId } }),
      prisma.team.findUnique({ where: { id: awayId } }),
    ]);

    if (!homeTeam || !awayTeam) return res.status(404).json({ error: 'Team not found' });

    const seasonRecord = await prisma.season.findFirst({ where: { year: season } });

    const [homeStats, awayStats] = await Promise.all([
      seasonRecord ? prisma.teamSeasonStats.findUnique({ where: { teamId_seasonId: { teamId: homeId, seasonId: seasonRecord.id } } }) : null,
      seasonRecord ? prisma.teamSeasonStats.findUnique({ where: { teamId_seasonId: { teamId: awayId, seasonId: seasonRecord.id } } }) : null,
    ]);

    const h2h = await prisma.fixture.findMany({
      where: {
        OR: [
          { homeTeamId: homeId, awayTeamId: awayId },
          { homeTeamId: awayId, awayTeamId: homeId },
        ],
        status: 'FT',
      },
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
      take: 10,
    });

    const [homeForm, awayForm] = await Promise.all([
      prisma.fixture.findMany({
        where: { OR: [{ homeTeamId: homeId }, { awayTeamId: homeId }], status: 'FT', season },
        orderBy: { date: 'desc' },
        take: 5,
        select: { homeTeamId: true, goalsHome: true, goalsAway: true },
      }),
      prisma.fixture.findMany({
        where: { OR: [{ homeTeamId: awayId }, { awayTeamId: awayId }], status: 'FT', season },
        orderBy: { date: 'desc' },
        take: 5,
        select: { homeTeamId: true, awayTeamId: true, goalsHome: true, goalsAway: true },
      }),
    ]);

    res.json({
      homeTeam: { ...homeTeam, seasonStats: homeStats },
      awayTeam: { ...awayTeam, seasonStats: awayStats },
      h2h,
      homeForm,
      awayForm,
    });
  } catch (err) {
    next(err);
  }
});
