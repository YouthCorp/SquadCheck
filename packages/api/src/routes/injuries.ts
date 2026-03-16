import { Router } from 'express';
import { getPrisma, resolveSeason } from '../lib/prisma';
import { cached } from '../lib/cache';

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
      // 1. Recent injuries — "absence transition" panel.
      // Shows players who were playing and then became absent, sorted by when they last played.
      // Correctly handles re-injuries after recovery (old logic missed these).
      //
      // Algorithm:
      //   Step 1. Candidate player IDs — anyone with injury records in last 90 days
      //   Step 2. Last lineup date per candidate (MAX across full season)
      //   Step 3. Per player: find first injury record AFTER last lineup date
      //           If that date is within the cutoff → "new absence" (was playing, now not)
      //           Long-term absent players (lastPlayed far in past) naturally filter out.
      //           Players who returned after injury also filter out (their new lastPlayed > any new injury).
      //   Step 4. Quality filter
      //   Step 5. Fetch full records (with player/team/league) for final set, sort & return.
      const now = new Date();
      const TOP5_LEAGUE_IDS = [39, 140, 135, 78, 61];
      const ONE_DAY_MS = 86_400_000;

      // Exclude disciplinary, squad management, and non-injury absences.
      const NOT_DISCIPLINARY = {
        NOT: {
          OR: [
            { reason: { contains: 'red card',           mode: 'insensitive' as const } },
            { reason: { equals:   'suspended',          mode: 'insensitive' as const } },
            { reason: { equals:   'suspension',         mode: 'insensitive' as const } },
            { reason: { contains: 'yellow card',        mode: 'insensitive' as const } },
            { reason: { equals:   'international duty', mode: 'insensitive' as const } },
            { reason: { equals:   'inactive',           mode: 'insensitive' as const } },
            { reason: { contains: 'coach',              mode: 'insensitive' as const } },
            { reason: { equals:   'loan agreement',     mode: 'insensitive' as const } },
            { reason: { equals:   'rest',               mode: 'insensitive' as const } },
            { reason: { equals:   'doping',             mode: 'insensitive' as const } },
          ],
        },
      };

      // Step 1: Candidate player IDs — any injury record in last 90 days (lightweight, no includes)
      const candidateGroups = await prisma.injury.groupBy({
        by: ['playerId'],
        where: {
          season,
          fixtureDate: { lte: now, gte: new Date(Date.now() - 90 * ONE_DAY_MS) },
          league: { apiFootballId: { in: TOP5_LEAGUE_IDS } },
          ...NOT_DISCIPLINARY,
        },
      });
      const candidatePlayerIds = candidateGroups.map((g) => g.playerId);

      if (candidatePlayerIds.length === 0) return { recentInjuries: [], recentSignals: [] };

      // Step 2: All lineup appearances for candidates this season (scalar only, no includes).
      // Using MAX per player captures full-season history:
      //   - If player returned after injury their MAX date > new injury date → no "new absence"
      //   - Long-term absent players have an old MAX date → newAbsenceStart is old → excluded
      const lineupAppearances = await prisma.fixtureLineupPlayer.findMany({
        where: {
          playerId: { in: candidatePlayerIds },
          lineup: { fixture: { season, status: { in: ['FT', 'AET', 'PEN'] } } },
        },
        select: {
          playerId: true,
          lineup: { select: { fixture: { select: { date: true } } } },
        },
      });

      const lastPlayedMap = new Map<number, Date>();
      for (const app of lineupAppearances) {
        const d = app.lineup.fixture.date;
        const prev = lastPlayedMap.get(app.playerId);
        if (!prev || d > prev) lastPlayedMap.set(app.playerId, d);
      }

      // Step 3: Individual injury records for candidates (scalar only, no includes).
      // Ordered asc so first record per player = earliest injury after last lineup.
      const candidateInjuries = await prisma.injury.findMany({
        where: {
          season,
          playerId: { in: candidatePlayerIds },
          fixtureDate: { lte: now, gte: new Date(Date.now() - 90 * ONE_DAY_MS) },
          league: { apiFootballId: { in: TOP5_LEAGUE_IDS } },
          ...NOT_DISCIPLINARY,
        },
        orderBy: { fixtureDate: 'asc' },
        select: { playerId: true, fixtureDate: true },
      });

      const injuriesByPlayer = new Map<number, Date[]>();
      for (const inj of candidateInjuries) {
        const arr = injuriesByPlayer.get(inj.playerId);
        if (arr) arr.push(inj.fixtureDate);
        else injuriesByPlayer.set(inj.playerId, [inj.fixtureDate]);
      }

      // Find players whose "absence transition" falls within the cutoff.
      // newAbsenceStart = first injury date strictly after last lineup appearance.
      type AbsenceEntry = { playerId: number; lastPlayed: Date; newAbsenceStart: Date };
      function buildAbsences(cutoff: Date): AbsenceEntry[] {
        const results: AbsenceEntry[] = [];
        for (const [playerId, injuryDates] of injuriesByPlayer) {
          const lastPlayed = lastPlayedMap.get(playerId);
          if (!lastPlayed) continue; // no lineup history — cannot confirm transition

          // First injury AFTER last lineup (1-day UTC buffer)
          const firstPostLineup = injuryDates.find(
            (d) => d.getTime() > lastPlayed.getTime(),
          );
          if (!firstPostLineup || firstPostLineup < cutoff) continue;

          results.push({ playerId, lastPlayed, newAbsenceStart: firstPostLineup });
        }
        return results;
      }

      const cutoff45 = new Date(Date.now() - 45 * ONE_DAY_MS);
      const cutoff90 = new Date(Date.now() - 90 * ONE_DAY_MS);
      let absences = buildAbsences(cutoff45);
      if (absences.length < 5) absences = buildAbsences(cutoff90);

      // Step 4: Quality filter — exclude fringe / squad players
      const firstTeamStats = await prisma.playerSeasonStats.findMany({
        where: {
          playerId: { in: absences.map((a) => a.playerId) },
          season: { year: season },
          leagueApiId: { in: TOP5_LEAGUE_IDS },
          OR: [
            { lineups: { gte: 5 }, rating: { gte: 6.8 } },
            { lineups: { gte: 8 } },
          ],
        },
        select: { playerId: true },
      });
      const firstTeamPlayerIds = new Set(firstTeamStats.map((s) => s.playerId));
      const qualifiedAbsences = absences.filter((a) => firstTeamPlayerIds.has(a.playerId));

      // Step 5: Fetch full records (with player/team/league) for qualified players only.
      // Pick the first injury record at or after newAbsenceStart for each player.
      const qualifiedPlayerIds = qualifiedAbsences.map((a) => a.playerId);
      const fullRecords = await prisma.injury.findMany({
        where: {
          season,
          playerId: { in: qualifiedPlayerIds },
          fixtureDate: { lte: now, gte: new Date(Date.now() - 90 * ONE_DAY_MS) },
          league: { apiFootballId: { in: TOP5_LEAGUE_IDS } },
          ...NOT_DISCIPLINARY,
        },
        orderBy: { fixtureDate: 'asc' },
        include: {
          player: { select: { id: true, name: true, photo: true, position: true } },
          team: { select: { id: true, name: true, logo: true } },
          league: { select: { id: true, name: true, logo: true, apiFootballId: true } },
        },
      });

      // Map playerId → first full record that is the "absence start" record
      const absenceMap = new Map(qualifiedAbsences.map((a) => [a.playerId, a]));
      const firstRecordByPlayer = new Map<number, typeof fullRecords[0]>();
      for (const r of fullRecords) {
        const absence = absenceMap.get(r.playerId);
        if (!absence) continue;
        if (r.fixtureDate.getTime() > absence.lastPlayed.getTime()
          && !firstRecordByPlayer.has(r.playerId)) {
          firstRecordByPlayer.set(r.playerId, r);
        }
      }

      const recentInjuries = qualifiedAbsences
        .filter((a) => firstRecordByPlayer.has(a.playerId))
        .sort((a, b) => b.lastPlayed.getTime() - a.lastPlayed.getTime())
        .slice(0, 20)
        .map((a) => ({
          ...firstRecordByPlayer.get(a.playerId)!,
          lastAppearanceFixtureDate: a.lastPlayed.toISOString(),
        }));

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
