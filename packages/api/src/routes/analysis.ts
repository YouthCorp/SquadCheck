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
  computeTeamOutcomeImpact,
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
  // Primary: find leagueId from player season stats
  const statsEntry = await prisma.playerSeasonStats.findFirst({
    where: { teamId },
    select: { season: { select: { leagueId: true } } },
    orderBy: { seasonId: 'desc' },
  });
  if (statsEntry) return statsEntry.season.leagueId;

  // Fallback: find leagueId from standing entries (covers leagues without player stats seeded)
  const standingEntry = await prisma.standingEntry.findFirst({
    where: { teamId },
    select: { standing: { select: { leagueId: true } } },
    orderBy: { id: 'desc' },
  });
  return standingEntry?.standing.leagueId ?? null;
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
      const [players, currentSeasonStats, availabilities, teamSeasonStats, standingEntry] = await Promise.all([
        prisma.player.findMany({
          where: { id: { in: playerIds } },
          select: { id: true, name: true, photo: true, position: true },
        }),
        prisma.playerSeasonStats.findMany({
          where: { playerId: { in: playerIds }, teamId, seasonId: chain.ids[0] },
          select: { playerId: true, goalsTotal: true, assists: true, minutes: true, appearances: true },
        }),
        prisma.playerAvailability.findMany({
          where: { playerId: { in: playerIds }, expired: false },
          orderBy: { updatedAt: 'desc' },
          select: {
            playerId: true,
            predictedAvailability: true,
            confidenceLevel: true,
            latestSignalStage: true,
            lastSignalAt: true,
            signalCount: true,
          },
        }),
        prisma.teamSeasonStats.findUnique({
          where: { teamId_seasonId: { teamId, seasonId: chain.ids[0] } },
          select: { avgXg: true, avgXgAgainst: true, totalGoals: true, totalConceded: true },
        }),
        prisma.standingEntry.findFirst({
          where: { teamId, seasonId: chain.ids[0] },
          select: { played: true, wins: true, draws: true, losses: true, goalsFor: true, goalsAgainst: true },
          orderBy: { rank: 'asc' },
        }),
      ]);
      const photoMap = new Map(players.map(p => [p.id, p]));
      const currentStatsMap = new Map(currentSeasonStats.map(s => [s.playerId, s]));
      // Take only the first (most recent) availability record per player
      const availMap = new Map<number, typeof availabilities[number]>();
      for (const a of availabilities) {
        if (!availMap.has(a.playerId)) availMap.set(a.playerId, a);
      }

      // Compute outcome impact from enriched players + season stats
      const outcomeImpact = computeTeamOutcomeImpact(
        rich.enrichedInjuredPlayers,
        teamSeasonStats,
        standingEntry,
      );

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
        outcomeImpact,
        injuredPlayers: rich.enrichedInjuredPlayers.map(p => {
          const cs = currentStatsMap.get(p.playerId);
          const avail = availMap.get(p.playerId);
          const hasSignal = avail && avail.signalCount > 0;
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
            recoverySignal: hasSignal ? {
              predictedAvailability: avail!.predictedAvailability,
              confidenceLevel: avail!.confidenceLevel,
              latestSignalStage: avail!.latestSignalStage,
              lastSignalAt: avail!.lastSignalAt?.toISOString() ?? null,
            } : undefined,
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


// ── GET /api/analysis/recovery-signals/:teamId?season=2025 ──
analysisRouter.get('/recovery-signals/:teamId', async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    const teamId = parseInt(req.params.teamId);
    const season = await resolveSeason(prisma, req.query.season as string);

    const cacheKey = `analysis:recovery-signals:${teamId}:${season}`;

    const result = await cached(cacheKey, 120, async () => {
      const team = await prisma.team.findUnique({ where: { id: teamId } });
      if (!team) return null;

      // Get upcoming fixture for this team (to find active availability rows)
      const now = new Date();
      const upcomingFixture = await prisma.fixture.findFirst({
        where: {
          season,
          status: { notIn: ['FT', 'AET', 'PEN', 'CANC', 'ABD'] },
          date: { gte: now },
          OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
        },
        orderBy: { date: 'asc' },
        select: { id: true, date: true },
      });

      // Get all active availability rows for this team
      const availabilities = await prisma.playerAvailability.findMany({
        where: {
          teamId,
          expired: false,
          ...(upcomingFixture ? { fixtureId: upcomingFixture.id } : {}),
        },
        include: {
          player: { select: { id: true, name: true, photo: true, position: true } },
        },
        orderBy: { predictedAvailability: 'desc' },
      });

      // Get recent signals for this team (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentSignals = await prisma.recoverySignal.findMany({
        where: {
          teamId,
          publishedAt: { gte: sevenDaysAgo },
        },
        include: {
          player: { select: { id: true, name: true, photo: true, position: true } },
          source: { select: { name: true, reliability: true } },
        },
        orderBy: { publishedAt: 'desc' },
        take: 50,
      });

      return {
        team,
        season,
        upcomingFixture: upcomingFixture
          ? { id: upcomingFixture.id, date: upcomingFixture.date }
          : null,
        playerAvailabilities: availabilities.map(a => ({
          player: a.player,
          officialStatus: a.officialStatus,
          recoverySignalScore: a.recoverySignalScore,
          predictedAvailability: a.predictedAvailability,
          confidenceLevel: a.confidenceLevel,
          latestSignalStage: a.latestSignalStage,
          lastSignalAt: a.lastSignalAt,
          signalCount: a.signalCount,
        })),
        recentSignals: recentSignals.map(s => ({
          player: s.player,
          source: s.source.name,
          sourceReliability: s.source.reliability,
          articleTitle: s.articleTitle,
          articleUrl: s.articleUrl,
          publishedAt: s.publishedAt,
          signalStage: s.signalStage,
          recoveryScore: s.recoveryScore,
          confidence: s.confidence,
          classifiedBy: s.classifiedBy,
        })),
      };
    });

    if (!result) return res.status(404).json({ error: 'Team not found' });
    res.json(result);
  } catch (err) {
    next(err);
  }
});
