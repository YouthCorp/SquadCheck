import { PrismaClient } from '@prisma/client';

// ── Position classification ─────────────────────────────────
export type PositionGroup = 'GK' | 'DEF' | 'MID' | 'FWD';

export function classifyPosition(pos: string | null): PositionGroup {
  if (!pos) return 'MID'; // default fallback
  const p = pos.toUpperCase();
  if (p.includes('GOAL') || p === 'GK' || p === 'G') return 'GK';
  if (p.includes('DEFEND') || p.includes('BACK') || p === 'DEF' || p === 'D') return 'DEF';
  if (p.includes('FORWARD') || p.includes('ATTACK') || p === 'FWD' || p === 'F') return 'FWD';
  return 'MID';
}

// ── Interfaces ──────────────────────────────────────────────
export interface PlayerWeight {
  playerId: number;
  playerName: string;
  position: string | null;
  positionGroup: PositionGroup;
  weight: number;
  rawWeight: number;
  decayFactor: number;
  dataSource: 'current' | 'prior-1' | 'prior-2' | 'blended';
  components: {
    minutesPct: number;
    ratingNorm: number;
    skillScore: number;
  };
  skillBreakdown: Record<string, number>;
  stats: {
    minutes: number | null;
    rating: number | null;
    goals: number | null;
    assists: number | null;
    appearances: number | null;
  };
}

// ── Position-specific weight profiles ───────────────────────
//  Each profile: [minutesPct, ratingNorm, skillScore] — must sum to 1.0
const POSITION_WEIGHTS: Record<PositionGroup, [number, number, number]> = {
  GK:  [0.30, 0.25, 0.45],
  DEF: [0.30, 0.25, 0.45],
  MID: [0.30, 0.20, 0.50],
  FWD: [0.30, 0.20, 0.50],
};

// ── Skill score calculators (per-90 based, 0–1 normalised) ──
type StatsRow = {
  minutes: number | null;
  goalsTotal: number | null;
  assists: number | null;
  passesKey: number | null;
  tacklesTotal: number | null;
  interceptions: number | null;
  duelsTotal: number | null;
  duelsWon: number | null;
  dribblesAttempts: number | null;
  dribblesSuccess: number | null;
  shotsTotal: number | null;
};

function per90(stat: number | null, minutes: number | null): number {
  const m = Math.max(minutes || 1, 1);
  return ((stat || 0) / m) * 90;
}

function duelWinRate(duelsTotal: number | null, duelsWon: number | null): number {
  const total = duelsTotal || 0;
  if (total === 0) return 0;
  return (duelsWon || 0) / total;
}

function computeSkillScore(
  posGroup: PositionGroup,
  s: StatsRow,
): { score: number; breakdown: Record<string, number> } {
  const mins = s.minutes;

  switch (posGroup) {
    case 'GK': {
      // defensive_actions_per90 = (tackles + interceptions) per 90
      const defActions = clamp(per90((s.tacklesTotal || 0) + (s.interceptions || 0), mins) / 6, 0, 1);
      const duelRate = clamp(duelWinRate(s.duelsTotal, s.duelsWon), 0, 1);
      const score = defActions * 0.60 + duelRate * 0.40;
      return { score, breakdown: { defensiveActionsPer90: round(defActions), duelWinRate: round(duelRate) } };
    }
    case 'DEF': {
      const tackles = clamp(per90(s.tacklesTotal, mins) / 4, 0, 1);
      const intercepts = clamp(per90(s.interceptions, mins) / 3, 0, 1);
      const duelRate = clamp(duelWinRate(s.duelsTotal, s.duelsWon), 0, 1);
      const score = tackles * 0.35 + intercepts * 0.35 + duelRate * 0.30;
      return { score, breakdown: { tacklesPer90: round(tackles), interceptionsPer90: round(intercepts), duelWinRate: round(duelRate) } };
    }
    case 'MID': {
      const keyPasses = clamp(per90(s.passesKey, mins) / 3, 0, 1);
      const goalContrib = clamp(per90((s.goalsTotal || 0) + (s.assists || 0), mins) / 1.5, 0, 1);
      const dribbles = clamp(per90(s.dribblesSuccess, mins) / 3, 0, 1);
      const duelRate = clamp(duelWinRate(s.duelsTotal, s.duelsWon), 0, 1);
      const score = keyPasses * 0.40 + goalContrib * 0.30 + dribbles * 0.15 + duelRate * 0.15;
      return { score, breakdown: { keyPassesPer90: round(keyPasses), goalContribPer90: round(goalContrib), dribblesPer90: round(dribbles), duelWinRate: round(duelRate) } };
    }
    case 'FWD': {
      const goalContrib = clamp(per90((s.goalsTotal || 0) + (s.assists || 0), mins) / 1.5, 0, 1);
      const shots = clamp(per90(s.shotsTotal, mins) / 4, 0, 1);
      const dribbles = clamp(per90(s.dribblesSuccess, mins) / 3, 0, 1);
      const score = goalContrib * 0.55 + shots * 0.25 + dribbles * 0.20;
      return { score, breakdown: { goalContribPer90: round(goalContrib), shotsPer90: round(shots), dribblesPer90: round(dribbles) } };
    }
  }
}

// ── Multi-season decay ──────────────────────────────────────
interface SeasonStatsRow {
  seasonIndex: number;        // 0 = current, 1 = prior-1, 2 = prior-2
  lineups: number;
  stats: StatsRow & { rating: number | null; appearances: number | null };
  playerName: string;
  playerPosition: string | null;
}

function resolveDecay(seasons: SeasonStatsRow[]): {
  effective: SeasonStatsRow;
  decayFactor: number;
  dataSource: PlayerWeight['dataSource'];
} {
  const current = seasons.find(s => s.seasonIndex === 0);
  const prior1 = seasons.find(s => s.seasonIndex === 1);
  const prior2 = seasons.find(s => s.seasonIndex === 2);

  // Current season with >= 5 lineups: use it directly
  if (current && current.lineups >= 5) {
    return { effective: current, decayFactor: 1.0, dataSource: 'current' };
  }

  // Current season with 1-4 lineups: blend with prior
  if (current && current.lineups >= 1 && prior1) {
    return { effective: blendStats(current, prior1, 0.5, 0.5 * 0.75), decayFactor: 0.875, dataSource: 'blended' };
  }

  // Current season with 1-4 lineups but no prior: use current
  if (current && current.lineups >= 1) {
    return { effective: current, decayFactor: 1.0, dataSource: 'current' };
  }

  // No current season lineups: fall back to prior
  if (prior1 && prior1.lineups > 0) {
    return { effective: prior1, decayFactor: 0.75, dataSource: 'prior-1' };
  }

  // Fall back to 2 seasons ago
  if (prior2 && prior2.lineups > 0) {
    return { effective: prior2, decayFactor: 0.5625, dataSource: 'prior-2' };
  }

  // No data at all — return current (or first available) with zero decay
  const fallback = current || prior1 || prior2 || seasons[0];
  return { effective: fallback, decayFactor: 0.5, dataSource: 'prior-2' };
}

function blendStats(a: SeasonStatsRow, b: SeasonStatsRow, wA: number, wB: number): SeasonStatsRow {
  const total = wA + wB;
  const blend = (va: number | null, vb: number | null): number | null => {
    const aVal = va ?? 0;
    const bVal = vb ?? 0;
    if (va === null && vb === null) return null;
    return Math.round((aVal * wA + bVal * wB) / total);
  };
  const blendFloat = (va: number | null, vb: number | null): number | null => {
    const aVal = va ?? 0;
    const bVal = vb ?? 0;
    if (va === null && vb === null) return null;
    return (aVal * wA + bVal * wB) / total;
  };

  return {
    seasonIndex: 0,
    lineups: Math.max(a.lineups, 1),
    playerName: a.playerName,
    playerPosition: a.playerPosition,
    stats: {
      minutes: blend(a.stats.minutes, b.stats.minutes),
      goalsTotal: blend(a.stats.goalsTotal, b.stats.goalsTotal),
      assists: blend(a.stats.assists, b.stats.assists),
      passesKey: blend(a.stats.passesKey, b.stats.passesKey),
      tacklesTotal: blend(a.stats.tacklesTotal, b.stats.tacklesTotal),
      interceptions: blend(a.stats.interceptions, b.stats.interceptions),
      duelsTotal: blend(a.stats.duelsTotal, b.stats.duelsTotal),
      duelsWon: blend(a.stats.duelsWon, b.stats.duelsWon),
      dribblesAttempts: blend(a.stats.dribblesAttempts, b.stats.dribblesAttempts),
      dribblesSuccess: blend(a.stats.dribblesSuccess, b.stats.dribblesSuccess),
      shotsTotal: blend(a.stats.shotsTotal, b.stats.shotsTotal),
      rating: blendFloat(a.stats.rating, b.stats.rating),
      appearances: blend(a.stats.appearances, b.stats.appearances),
    },
  };
}

// ── Main entry point ────────────────────────────────────────
/**
 * Compute position-aware, multi-season player weights for a team.
 *
 * @param seasonIds  - ordered [currentSeasonId, priorSeasonId, ...] (max 3)
 * @param seasonYears - corresponding years [2024, 2023, ...] (unused for now, reserved)
 */
export async function computePlayerWeights(
  prisma: PrismaClient,
  teamId: number,
  seasonIds: number[],
  seasonYears: number[],
): Promise<PlayerWeight[]> {
  if (seasonIds.length === 0) return [];

  // Fetch all season stats for this team across all requested seasons
  const allStats = await prisma.playerSeasonStats.findMany({
    where: { teamId, seasonId: { in: seasonIds } },
    include: { player: { select: { id: true, name: true, position: true } } },
  });

  if (allStats.length === 0) return [];

  // Group by playerId
  const playerMap = new Map<number, SeasonStatsRow[]>();
  for (const ps of allStats) {
    const seasonIndex = seasonIds.indexOf(ps.seasonId);
    if (seasonIndex === -1) continue;

    const row: SeasonStatsRow = {
      seasonIndex,
      lineups: ps.lineups || 0,
      playerName: ps.player.name,
      playerPosition: ps.player.position,
      stats: {
        minutes: ps.minutes,
        goalsTotal: ps.goalsTotal,
        assists: ps.assists,
        passesKey: ps.passesKey,
        tacklesTotal: ps.tacklesTotal,
        interceptions: ps.interceptions,
        duelsTotal: ps.duelsTotal,
        duelsWon: ps.duelsWon,
        dribblesAttempts: ps.dribblesAttempts,
        dribblesSuccess: ps.dribblesSuccess,
        shotsTotal: ps.shotsTotal,
        rating: ps.rating,
        appearances: ps.appearances,
      },
    };

    if (!playerMap.has(ps.playerId)) {
      playerMap.set(ps.playerId, []);
    }
    playerMap.get(ps.playerId)!.push(row);
  }

  // Compute max minutes across the effective dataset (for normalization)
  let maxMinutes = 1;
  const resolved = new Map<number, { effective: SeasonStatsRow; decayFactor: number; dataSource: PlayerWeight['dataSource'] }>();
  for (const [pid, seasons] of playerMap) {
    const res = resolveDecay(seasons);
    resolved.set(pid, res);
    maxMinutes = Math.max(maxMinutes, res.effective.stats.minutes || 0);
  }

  // Build results
  const results: PlayerWeight[] = [];
  for (const [playerId, { effective, decayFactor, dataSource }] of resolved) {
    const s = effective.stats;
    const posGroup = classifyPosition(effective.playerPosition);
    const [wMin, wRat, wSkill] = POSITION_WEIGHTS[posGroup];

    const minutesPct = (s.minutes || 0) / maxMinutes;
    const ratingNorm = clamp(((s.rating || 6.0) - 5.0) / 5.0, 0, 1);
    const { score: skillScore, breakdown: skillBreakdown } = computeSkillScore(posGroup, s);

    const rawWeight = minutesPct * wMin + ratingNorm * wRat + skillScore * wSkill;
    const weight = rawWeight * decayFactor;

    results.push({
      playerId,
      playerName: effective.playerName,
      position: effective.playerPosition,
      positionGroup: posGroup,
      weight: round(weight),
      rawWeight: round(rawWeight),
      decayFactor,
      dataSource,
      components: {
        minutesPct: round(minutesPct),
        ratingNorm: round(ratingNorm),
        skillScore: round(skillScore),
      },
      skillBreakdown,
      stats: {
        minutes: s.minutes,
        rating: s.rating,
        goals: s.goalsTotal,
        assists: s.assists,
        appearances: s.appearances,
      },
    });
  }

  return results.sort((a, b) => b.weight - a.weight);
}

// ── Legacy wrapper (backward-compatible) ────────────────────
/** @deprecated Use computePlayerWeights with seasonIds array */
export async function computePlayerWeightsLegacy(
  prisma: PrismaClient,
  teamId: number,
  seasonId: number,
): Promise<PlayerWeight[]> {
  return computePlayerWeights(prisma, teamId, [seasonId], [0]);
}

// ── Utilities ───────────────────────────────────────────────
function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

function round(val: number, decimals = 3): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}
