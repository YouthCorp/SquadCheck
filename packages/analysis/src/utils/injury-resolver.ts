import { PrismaClient } from '@prisma/client';

export interface ActiveInjury {
  playerId:    number;
  teamId:      number;
  leagueId:    number;
  fixtureId:   number;
  fixtureDate: Date;
  type:        string;
  reason:      string;
}

const DISCIPLINARY_REASONS = ['red card', 'suspended', 'suspension', 'yellow card'];

function isDisciplinary(reason: string): boolean {
  const r = reason.toLowerCase();
  return DISCIPLINARY_REASONS.some(d => r === d || r.includes(d));
}

/**
 * Resolves the set of "currently active injuries" for a team.
 *
 * Steps:
 * 1. Query injuries (optionally filtered by leagueId for the injury record itself)
 * 2. Keep latest injury per player (ordered by fixtureDate desc)
 * 3. Remove already-served disciplinary absences
 * 4. Remove players who appeared in ANY fixture lineup after their injury start
 *    — NO competition filter here: cross-competition recovery counts
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
  const injuries = await prisma.injury.findMany({
    where: {
      teamId,
      season,
      ...(injuryLeagueId ? { leagueId: injuryLeagueId } : {}),
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
  const latestTeamInjuryDate = injuries[0].fixtureDate;
  const completedFixtureIds = new Set<number>();
  const fixtureStatuses = await prisma.fixture.findMany({
    where: {
      id: { in: [...latestByPlayer.values()].map(i => i.fixtureId) },
      status: { in: ['FT', 'AET', 'PEN'] },
    },
    select: { id: true },
  });
  for (const f of fixtureStatuses) completedFixtureIds.add(f.id);

  for (const [playerId, inj] of latestByPlayer) {
    if (
      isDisciplinary(inj.reason) &&
      inj.fixtureDate < latestTeamInjuryDate &&
      completedFixtureIds.has(inj.fixtureId)
    ) {
      latestByPlayer.delete(playerId);
    }
  }

  // Step 4: Remove recovered players.
  // Cross-competition: if a player appeared in ANY competition's lineup after
  // their injury date, they are physically recovered — no league filter applied.
  const candidateIds = [...latestByPlayer.keys()];
  if (candidateIds.length > 0) {
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

    const latestAppearance = new Map<number, Date>();
    for (const entry of postInjuryAppearances) {
      const d = entry.lineup.fixture.date;
      const prev = latestAppearance.get(entry.playerId);
      if (!prev || d > prev) latestAppearance.set(entry.playerId, d);
    }

    // 1일 버퍼: 경기 킥오프(UTC)와 부상 기록 날짜(UTC 자정) 사이의 타임존 불일치 보정
    const ONE_DAY_MS = 86_400_000;
    for (const [playerId, inj] of latestByPlayer) {
      const lastPlayed = latestAppearance.get(playerId);
      if (lastPlayed && lastPlayed.getTime() >= inj.fixtureDate.getTime() - ONE_DAY_MS) {
        latestByPlayer.delete(playerId);
      }
    }
  }

  // Step 5: Stale injury filter.
  // Players with 0 appearances and an injury record older than 90 days have
  // likely transferred away — their early-season records are residual.
  const ninetyDaysAgo = new Date(latestTeamInjuryDate.getTime() - 90 * 86_400_000);

  // We need appearance counts for this filter — reuse the cross-competition check
  // but now we need ALL appearances (not just post-injury), so run a separate count.
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
