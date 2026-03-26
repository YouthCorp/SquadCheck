import type { PrismaClient, Prisma } from '@prisma/client';
import {
  DISCIPLINARY_REASONS as _DISCIPLINARY_REASONS,
} from '@squadcheck/database';
import type { ActiveInjuryInput, AbsenceTransitionInput, InjuryRecord, AppearanceEntry } from '../ports';
import {
  NON_INJURY_EXCLUSION_FILTER,
  fetchActiveInjuryData,
  fetchAbsenceTransitionData,
} from '../data-access';

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

function isDisciplinary(reason: string): boolean {
  const r = reason.toLowerCase();
  return (_DISCIPLINARY_REASONS as readonly string[]).some(d => r === d || r.includes(d));
}

// Re-export from data-access (Prisma-specific constant).
export { NON_INJURY_EXCLUSION_FILTER } from '../data-access';

// ── Shared utilities ──────────────────────────────────────────────────────────

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

/** Flat version of buildLatestAppearanceMap for use with AppearanceEntry[] */
function buildLatestAppearanceDateMap(
  appearances: AppearanceEntry[],
  completedOnly: boolean,
): Map<number, Date> {
  const map = new Map<number, Date>();
  for (const entry of appearances) {
    if (completedOnly && !entry.fixtureCompleted) continue;
    const prev = map.get(entry.playerId);
    if (!prev || entry.fixtureDate > prev) map.set(entry.playerId, entry.fixtureDate);
  }
  return map;
}

// ── resolveActiveInjuriesPure ─────────────────────────────────────────────────

/**
 * Pure version: resolves active injuries from pre-fetched data.
 * No DB dependency — testable with mock data.
 *
 * Steps:
 * 1. Keep latest injury per player
 * 2. Remove already-served disciplinary absences
 * 3. Remove recovered players (appeared after injury anchor)
 * 4. Remove stale records (0 appearances + >90 days old)
 */
export function resolveActiveInjuriesPure(
  data: ActiveInjuryInput,
  injuryLeagueId?: number | null,
): Map<number, ActiveInjury> {
  const { injuries, fixtureInfoMap, appearances } = data;

  if (injuries.length === 0) return new Map();

  // Step 1: Latest injury per player (injuries already ordered by fixtureDate desc)
  const latestByPlayer = new Map<number, ActiveInjury>();
  for (const inj of injuries) {
    if (!latestByPlayer.has(inj.playerId)) {
      latestByPlayer.set(inj.playerId, inj);
    }
  }

  // Step 2: Remove already-served disciplinary absences
  const COMPLETED_STATUSES = new Set(['FT', 'AET', 'PEN']);
  const latestTeamInjuryDate = injuries[0].fixtureDate;

  for (const [playerId, inj] of latestByPlayer) {
    const fixtureInfo = fixtureInfoMap.get(inj.fixtureId);
    const isCompleted = fixtureInfo ? COMPLETED_STATUSES.has(fixtureInfo.status) : false;

    if (
      isDisciplinary(inj.reason) &&
      inj.fixtureDate < latestTeamInjuryDate &&
      isCompleted &&
      (!injuryLeagueId || inj.leagueId === injuryLeagueId)
    ) {
      latestByPlayer.delete(playerId);
    }
  }

  // Step 3: Remove recovered players
  const candidateIds = [...latestByPlayer.keys()];
  if (candidateIds.length > 0) {
    // Find most recent completed injury fixture per candidate (anchor)
    const candidateSet = new Set(candidateIds);
    const latestCompletedAnchor = new Map<number, Date>();

    // Build from injuries + fixtureInfoMap: filter injuries where fixture is completed
    for (const inj of injuries) {
      if (!candidateSet.has(inj.playerId)) continue;
      if (latestCompletedAnchor.has(inj.playerId)) continue; // already found latest (injuries ordered desc)
      const fixtureInfo = fixtureInfoMap.get(inj.fixtureId);
      if (fixtureInfo && COMPLETED_STATUSES.has(fixtureInfo.status)) {
        // Use fixture.date (authoritative) instead of injury.fixtureDate
        latestCompletedAnchor.set(inj.playerId, fixtureInfo.date);
      }
    }

    // Build latest appearance from completed-fixture appearances only
    const completedAppearances = appearances.filter(a => a.fixtureCompleted && candidateSet.has(a.playerId));
    const latestAppearance = buildLatestAppearanceDateMap(completedAppearances, false); // already filtered

    for (const [playerId, inj] of latestByPlayer) {
      const lastPlayed = latestAppearance.get(playerId);
      const anchor = latestCompletedAnchor.get(playerId)
        ?? fixtureInfoMap.get(inj.fixtureId)?.date
        ?? inj.fixtureDate;
      if (lastPlayed && lastPlayed.getTime() >= anchor.getTime()) {
        latestByPlayer.delete(playerId);
      }
    }
  }

  // Step 4: Stale injury filter (0 appearances + >90 days old)
  const ninetyDaysAgo = new Date(latestTeamInjuryDate.getTime() - 90 * 86_400_000);

  // Count ALL appearances per player (including non-completed fixtures)
  const appearanceCountMap = new Map<number, number>();
  for (const a of appearances) {
    if (latestByPlayer.has(a.playerId)) {
      appearanceCountMap.set(a.playerId, (appearanceCountMap.get(a.playerId) ?? 0) + 1);
    }
  }

  for (const [playerId, inj] of latestByPlayer) {
    const count = appearanceCountMap.get(playerId) ?? 0;
    if (count === 0 && inj.fixtureDate < ninetyDaysAgo) {
      latestByPlayer.delete(playerId);
    }
  }

  return latestByPlayer;
}

// ── resolveActiveInjuries (legacy wrapper) ────────────────────────────────────

/**
 * @deprecated Use resolveActiveInjuriesPure with fetchActiveInjuryData
 */
export async function resolveActiveInjuries(
  prisma: PrismaClient,
  teamId: number,
  season: number,
  injuryLeagueId?: number | null,
): Promise<Map<number, ActiveInjury>> {
  const data = await fetchActiveInjuryData(prisma, teamId, season);
  return resolveActiveInjuriesPure(data, injuryLeagueId);
}

// ── resolveAbsenceTransitionsPure ─────────────────────────────────────────────

/**
 * Pure version: detects recent injury-to-absence transitions from pre-fetched data.
 */
export function resolveAbsenceTransitionsPure(
  data: AbsenceTransitionInput,
  options: {
    cutoffDays?: number;
    minResults?: number;
    limit?: number;
  } = {},
): AbsenceRecord[] {
  const { cutoffDays = 45, minResults = 5, limit = 20 } = options;
  const ONE_DAY_MS = 86_400_000;
  const now = new Date();

  const {
    candidatePlayerIds,
    lineupAppearances,
    candidateInjuries,
    firstTeamPlayerIds,
    fullRecords,
  } = data;

  if (candidatePlayerIds.length === 0) return [];

  // Build lastPlayedMap and appearedFixtureIds from lineupAppearances
  const lastPlayedMap = new Map<number, Date>();
  const appearedFixtureIds = new Map<number, Set<number>>();
  for (const app of lineupAppearances) {
    // lastPlayed
    const prev = lastPlayedMap.get(app.playerId);
    if (!prev || app.fixtureDate > prev) lastPlayedMap.set(app.playerId, app.fixtureDate);
    // appeared fixture IDs
    const set = appearedFixtureIds.get(app.playerId) ?? new Set<number>();
    set.add(app.fixtureId);
    appearedFixtureIds.set(app.playerId, set);
  }

  // Group candidate injuries by player
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
      if (!lastPlayed) continue;

      const appeared = appearedFixtureIds.get(playerId);
      const firstMissed = entries.find(e => !appeared?.has(e.fixtureId));
      if (!firstMissed || firstMissed.fixtureDate < cutoff) continue;

      if (lastPlayed.getTime() >= firstMissed.fixtureDate.getTime()) continue;

      results.push({ playerId, lastPlayed, newAbsenceStart: firstMissed.fixtureDate });
    }
    return results;
  }

  const cutoff1 = new Date(Date.now() - cutoffDays * ONE_DAY_MS);
  const cutoff2 = new Date(Date.now() - 90 * ONE_DAY_MS);
  let absences = buildAbsences(cutoff1);
  if (absences.length < minResults) absences = buildAbsences(cutoff2);

  // Quality filter
  const qualifiedAbsences = absences.filter(a => firstTeamPlayerIds.has(a.playerId));
  if (qualifiedAbsences.length === 0) return [];

  // Build first record per player from fullRecords
  const firstRecordByPlayer = new Map<number, typeof fullRecords[0]>();
  for (const r of fullRecords) {
    if (!firstRecordByPlayer.has(r.playerId) && !appearedFixtureIds.get(r.playerId)?.has(r.fixtureId)) {
      firstRecordByPlayer.set(r.playerId, r);
    }
  }

  return qualifiedAbsences
    .filter(a => firstRecordByPlayer.has(a.playerId))
    .sort((a, b) => b.newAbsenceStart.getTime() - a.newAbsenceStart.getTime())
    .slice(0, limit)
    .map(a => ({
      ...firstRecordByPlayer.get(a.playerId)!,
      lastAppearanceFixtureDate: a.lastPlayed.toISOString(),
    }));
}

// ── resolveAbsenceTransitions (legacy wrapper) ────────────────────────────────

/**
 * @deprecated Use resolveAbsenceTransitionsPure with fetchAbsenceTransitionData
 */
export async function resolveAbsenceTransitions(
  prisma: PrismaClient,
  season: number,
  leagueApiIds: number[],
  options: {
    cutoffDays?: number;
    minResults?: number;
    limit?: number;
  } = {},
) {
  const data = await fetchAbsenceTransitionData(prisma, season, leagueApiIds, options);
  return resolveAbsenceTransitionsPure(data, options);
}
