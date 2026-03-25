import { PrismaClient, Prisma } from '@prisma/client';
import {
  DISCIPLINARY_REASONS as _DISCIPLINARY_REASONS,
  buildExclusionFilter,
} from '@squadcheck/database';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActiveInjury {
  playerId:    number;
  teamId:      number;
  leagueId:    number;
  fixtureId:   number;
  fixtureDate: Date;
  type:        string;
  reason:      string;
}

export interface AbsenceRecord {
  id:          number;
  playerId:    number;
  teamId:      number;
  leagueId:    number;
  fixtureId:   number;
  fixtureDate: Date;
  season:      number;
  type:        string;
  reason:      string;
  player:      { id: number; name: string; photo: string; position: string | null };
  team:        { id: number; name: string; logo: string };
  league:      { id: number; name: string; logo: string; apiFootballId: number };
  lastAppearanceFixtureDate: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

// Disciplinary reasons from shared canonical source (@squadcheck/database).
function isDisciplinary(reason: string): boolean {
  const r = reason.toLowerCase();
  return (_DISCIPLINARY_REASONS as readonly string[]).some(d => r === d || r.includes(d));
}

// Broad list: all non-physical absences to exclude from injury panels.
// Exported so callers (e.g. live-updates route) can build their own Prisma queries.
// Built from canonical NON_INJURY_EXCLUSION_MATCHER in @squadcheck/database.
export const NON_INJURY_EXCLUSION_FILTER: Prisma.InjuryWhereInput = buildExclusionFilter();

// ── Shared utilities ──────────────────────────────────────────────────────────

/**
 * Builds a map of the most recent appearance date per player from lineup data.
 * Used by multiple endpoints and analysis functions to determine last played date.
 */
export function buildLatestAppearanceMap(
  appearances: Array<{ playerId: number; lineup: { fixture: { date: Date } } }>,
): Map<number, Date> {
  const map = new Map<number, Date>();
  for (const entry of appearances) {
    const d = entry.lineup.fixture.date;
    const prev = map.get(entry.playerId);
    if (!prev || d > prev) map.set(entry.playerId, d);
  }
  return map;
}

// ── resolveActiveInjuries ─────────────────────────────────────────────────────

/**
 * Resolves the set of "currently active injuries" for a team.
 *
 * Steps:
 * 1. Query injuries (optionally filtered by leagueId for the injury record itself)
 * 2. Keep latest injury per player (ordered by fixtureDate desc)
 * 3. Remove already-served disciplinary absences
 * 4. Remove players who appeared in a completed fixture on or after their injury
 *    fixture's actual kickoff date — no league filter (cross-competition recovery counts).
 *    Uses fixture.date as anchor (authoritative) instead of injury.fixtureDate which
 *    API Football can store up to ~23h differently for the same match.
 * 5. Remove stale records (0 appearances + injury >90 days old)
 *
 * Returns a Map<playerId, ActiveInjury> of currently active injured players.
 */
export async function resolveActiveInjuries(
  prisma: PrismaClient,
  teamId: number,
  season: number,
  injuryLeagueId?: number | null,
): Promise<Map<number, ActiveInjury>> {
  // Fetch ALL injuries regardless of league — physical injuries apply across all competitions.
  // injuryLeagueId is used only in Step 3 to clear served disciplinary absences,
  // since suspensions are competition-specific (EPL red card ≠ UCL suspension).
  const injuries = await prisma.injury.findMany({
    where: {
      teamId,
      season,
    },
    orderBy: { fixtureDate: 'desc' },
    select: {
      playerId:    true,
      teamId:      true,
      leagueId:    true,
      fixtureId:   true,
      fixtureDate: true,
      type:        true,
      reason:      true,
    },
  });

  if (injuries.length === 0) return new Map();

  // Step 2: Latest injury per player
  const latestByPlayer = new Map<number, ActiveInjury>();
  for (const inj of injuries) {
    if (!latestByPlayer.has(inj.playerId)) {
      latestByPlayer.set(inj.playerId, inj);
    }
  }

  // Step 3: Remove already-served disciplinary absences.
  // A disciplinary absence is considered served when:
  //   (a) the fixture it applied to is completed (FT/AET/PEN), AND
  //   (b) newer injury data exists for the team (if the player were still absent
  //       they would appear in the newer report too).
  // Also fetch fixture.date here for use as anchor in Step 4.
  const latestTeamInjuryDate = injuries[0].fixtureDate;
  const injuryFixtures = await prisma.fixture.findMany({
    where: { id: { in: [...latestByPlayer.values()].map(i => i.fixtureId) } },
    select: { id: true, date: true, status: true },
  });
  const completedFixtureIds = new Set(
    injuryFixtures.filter(f => ['FT', 'AET', 'PEN'].includes(f.status)).map(f => f.id),
  );
  const injuryFixtureDateMap = new Map(injuryFixtures.map(f => [f.id, f.date]));

  for (const [playerId, inj] of latestByPlayer) {
    if (
      isDisciplinary(inj.reason) &&
      inj.fixtureDate < latestTeamInjuryDate &&
      completedFixtureIds.has(inj.fixtureId) &&
      // Disciplinary absences are competition-specific: only clear served bans that
      // were issued in the same league as the current fixture view.
      // If no leagueId is specified (e.g. team page), clear regardless of competition.
      (!injuryLeagueId || inj.leagueId === injuryLeagueId)
    ) {
      latestByPlayer.delete(playerId);
    }
  }

  // Step 4: Remove recovered players.
  // A player is considered recovered if they appeared in any completed fixture
  // on or after their most recent COMPLETED injury fixture date.
  //
  // IMPORTANT: We use the most recent *completed* injury fixture as anchor, NOT the
  // overall latest injury record. The API pre-populates future scheduled fixtures as
  // injury records (e.g. "expected to miss April 26"), so using the latest injury
  // (which may be weeks in the future) would block recovery detection for players
  // who returned before those predicted dates.
  const candidateIds = [...latestByPlayer.keys()];
  if (candidateIds.length > 0) {
    // Find the most recent completed injury fixture per candidate — this is the
    // true "last confirmed absence" anchor, ignoring future API predictions.
    // No league filter: the completed-absence anchor should be the most recent confirmed
    // absence in ANY competition. A player injured in UCL and missing EPL games is still
    // considered absent regardless of which league filter the caller requested.
    const completedInjuries = await prisma.injury.findMany({
      where: {
        playerId: { in: candidateIds },
        teamId,
        season,
        fixture: { status: { in: ['FT', 'AET', 'PEN'] } },
      },
      orderBy: { fixtureDate: 'desc' },
      select: { playerId: true, fixtureDate: true, fixture: { select: { date: true } } },
    });
    const latestCompletedAnchor = new Map<number, Date>();
    for (const inj of completedInjuries) {
      if (!latestCompletedAnchor.has(inj.playerId)) {
        // Use fixture.date (authoritative kickoff time) instead of injury.fixtureDate.
        // API Football stores fixtureDate with a positive offset vs actual kickoff time,
        // so using injury.fixtureDate causes false non-recoveries when comparing against
        // fixture.date-based appearance records for the exact same match (e.g. "Doubtful"
        // players who ended up starting — anchor > lastPlayed for the same fixture).
        latestCompletedAnchor.set(inj.playerId, inj.fixture?.date ?? inj.fixtureDate);
      }
    }

    const postInjuryAppearances = await prisma.fixtureLineupPlayer.findMany({
      where: {
        playerId: { in: candidateIds },
        lineup: {
          teamId,
          fixture: {
            season,
            status: { in: ['FT', 'AET', 'PEN'] },
            // No leagueId filter: recovery in any competition counts
          },
        },
      },
      select: {
        playerId: true,
        lineup: { select: { fixture: { select: { date: true } } } },
      },
    });

    const latestAppearance = buildLatestAppearanceMap(postInjuryAppearances);

    for (const [playerId, inj] of latestByPlayer) {
      const lastPlayed = latestAppearance.get(playerId);
      // Anchor: most recent completed injury fixture (ignores future API predictions).
      // Falls back to injuryFixtureDateMap (fixture.date) then inj.fixtureDate.
      const anchor = latestCompletedAnchor.get(playerId) ?? injuryFixtureDateMap.get(inj.fixtureId) ?? inj.fixtureDate;
      if (lastPlayed && lastPlayed.getTime() >= anchor.getTime()) {
        latestByPlayer.delete(playerId);
      }
    }
  }

  // Step 5: Stale injury filter.
  // Players with 0 appearances and an injury record older than 90 days have
  // likely transferred away — their early-season records are residual.
  const ninetyDaysAgo = new Date(latestTeamInjuryDate.getTime() - 90 * 86_400_000);

  const allAppearanceCounts = await prisma.fixtureLineupPlayer.groupBy({
    by: ['playerId'],
    where: {
      playerId: { in: [...latestByPlayer.keys()] },
      lineup: { teamId, fixture: { season } },
    },
    _count: { playerId: true },
  });
  const appearanceCountMap = new Map(allAppearanceCounts.map(r => [r.playerId, r._count.playerId]));

  for (const [playerId, inj] of latestByPlayer) {
    const appearances = appearanceCountMap.get(playerId) ?? 0;
    if (appearances === 0 && inj.fixtureDate < ninetyDaysAgo) {
      latestByPlayer.delete(playerId);
    }
  }

  return latestByPlayer;
}

// ── resolveAbsenceTransitions ─────────────────────────────────────────────────

/**
 * Detects players who recently transitioned from playing to injured/absent.
 * Used for the home page "recent injuries" panel (cross-team, multi-league view).
 *
 * Algorithm:
 *   1. Candidate players — anyone with a past injury record in the 90-day window
 *   2. Build appeared fixture ID set per player (fixtureId-based, no timestamp drift)
 *   3. Find each player's first injury fixture they did NOT appear in
 *      → that's the confirmed "absence start"
 *   4. Quality filter — exclude fringe squad players
 *   5. Fetch full records and return, sorted by lastPlayed desc
 */
export async function resolveAbsenceTransitions(
  prisma: PrismaClient,
  season: number,
  leagueApiIds: number[],
  options: {
    cutoffDays?: number;  // primary cutoff window in days (default 45)
    minResults?: number;  // fall back to 90 days if fewer results than this (default 5)
    limit?:      number;  // max results returned (default 20)
  } = {},
) {
  const { cutoffDays = 45, minResults = 5, limit = 20 } = options;
  const ONE_DAY_MS = 86_400_000;
  const now = new Date();

  // Step 1: Candidate player IDs — any injury record in last 90 days
  const candidateGroups = await prisma.injury.groupBy({
    by: ['playerId'],
    where: {
      season,
      fixtureDate: { lte: now, gte: new Date(Date.now() - 90 * ONE_DAY_MS) },
      league: { apiFootballId: { in: leagueApiIds } },
      ...NON_INJURY_EXCLUSION_FILTER,
    },
  });
  const candidatePlayerIds = candidateGroups.map((g) => g.playerId);

  if (candidatePlayerIds.length === 0) return [];

  // Step 2: All lineup appearances — build lastPlayedMap and appearedFixtureIds.
  // fixtureId set avoids timestamp drift between injury.fixtureDate and fixture.date.
  const lineupAppearances = await prisma.fixtureLineupPlayer.findMany({
    where: {
      playerId: { in: candidatePlayerIds },
      lineup: { fixture: { season, status: { in: ['FT', 'AET', 'PEN'] } } },
    },
    select: {
      playerId: true,
      lineup: { select: { fixture: { select: { id: true, date: true } } } },
    },
  });

  const lastPlayedMap = buildLatestAppearanceMap(lineupAppearances);
  const appearedFixtureIds = new Map<number, Set<number>>();
  for (const app of lineupAppearances) {
    const fid = app.lineup.fixture.id;
    const set = appearedFixtureIds.get(app.playerId) ?? new Set<number>();
    set.add(fid);
    appearedFixtureIds.set(app.playerId, set);
  }

  // Step 3: Individual injury records — find first missed fixture per player.
  const candidateInjuries = await prisma.injury.findMany({
    where: {
      season,
      playerId: { in: candidatePlayerIds },
      fixtureDate: { lte: now, gte: new Date(Date.now() - 90 * ONE_DAY_MS) },
      league: { apiFootballId: { in: leagueApiIds } },
      ...NON_INJURY_EXCLUSION_FILTER,
    },
    orderBy: { fixtureDate: 'asc' },
    select: { playerId: true, fixtureDate: true, fixtureId: true },
  });

  type InjuryEntry = { fixtureDate: Date; fixtureId: number };
  const injuriesByPlayer = new Map<number, InjuryEntry[]>();
  for (const inj of candidateInjuries) {
    const arr = injuriesByPlayer.get(inj.playerId);
    if (arr) arr.push({ fixtureDate: inj.fixtureDate, fixtureId: inj.fixtureId });
    else injuriesByPlayer.set(inj.playerId, [{ fixtureDate: inj.fixtureDate, fixtureId: inj.fixtureId }]);
  }

  type AbsenceEntry = { playerId: number; lastPlayed: Date; newAbsenceStart: Date };
  function buildAbsences(cutoff: Date): AbsenceEntry[] {
    const results: AbsenceEntry[] = [];
    for (const [playerId, entries] of injuriesByPlayer) {
      const lastPlayed = lastPlayedMap.get(playerId);
      if (!lastPlayed) continue; // no lineup history — cannot confirm transition

      const appeared = appearedFixtureIds.get(playerId);
      const firstMissed = entries.find((e) => !appeared?.has(e.fixtureId));
      if (!firstMissed || firstMissed.fixtureDate < cutoff) continue;

      // Exclude players who have since recovered — lastPlayed must be before the injury start.
      // Uses injury.fixtureDate as anchor (safe: API Football drift is always positive,
      // so lastPlayed from fixture.date will always be < injury.fixtureDate for earlier fixtures).
      if (lastPlayed.getTime() >= firstMissed.fixtureDate.getTime()) continue;

      results.push({ playerId, lastPlayed, newAbsenceStart: firstMissed.fixtureDate });
    }
    return results;
  }

  const cutoff1 = new Date(Date.now() - cutoffDays * ONE_DAY_MS);
  const cutoff2 = new Date(Date.now() - 90 * ONE_DAY_MS);
  let absences = buildAbsences(cutoff1);
  if (absences.length < minResults) absences = buildAbsences(cutoff2);

  // Step 4: Quality filter — exclude fringe / squad players
  const firstTeamStats = await prisma.playerSeasonStats.findMany({
    where: {
      playerId: { in: absences.map((a) => a.playerId) },
      season: { year: season },
      leagueApiId: { in: leagueApiIds },
      OR: [
        { lineups: { gte: 5 }, rating: { gte: 6.8 } },
        { lineups: { gte: 8 } },
      ],
    },
    select: { playerId: true },
  });
  const firstTeamPlayerIds = new Set(firstTeamStats.map((s) => s.playerId));
  const qualifiedAbsences = absences.filter((a) => firstTeamPlayerIds.has(a.playerId));

  if (qualifiedAbsences.length === 0) return [];

  // Step 5: Fetch full records for qualified players.
  // Pick the first injury record whose fixtureId the player did NOT appear in.
  const qualifiedPlayerIds = qualifiedAbsences.map((a) => a.playerId);
  const fullRecords = await prisma.injury.findMany({
    where: {
      season,
      playerId: { in: qualifiedPlayerIds },
      fixtureDate: { lte: now, gte: new Date(Date.now() - 90 * ONE_DAY_MS) },
      league: { apiFootballId: { in: leagueApiIds } },
      ...NON_INJURY_EXCLUSION_FILTER,
    },
    orderBy: { fixtureDate: 'asc' },
    include: {
      player: { select: { id: true, name: true, photo: true, position: true } },
      team:   { select: { id: true, name: true, logo: true } },
      league: { select: { id: true, name: true, logo: true, apiFootballId: true } },
    },
  });

  const firstRecordByPlayer = new Map<number, typeof fullRecords[0]>();
  for (const r of fullRecords) {
    if (!firstRecordByPlayer.has(r.playerId) && !appearedFixtureIds.get(r.playerId)?.has(r.fixtureId)) {
      firstRecordByPlayer.set(r.playerId, r);
    }
  }

  return qualifiedAbsences
    .filter((a) => firstRecordByPlayer.has(a.playerId))
    .sort((a, b) => b.newAbsenceStart.getTime() - a.newAbsenceStart.getTime())
    .slice(0, limit)
    .map((a) => ({
      ...firstRecordByPlayer.get(a.playerId)!,
      lastAppearanceFixtureDate: a.lastPlayed.toISOString(),
    }));
}
