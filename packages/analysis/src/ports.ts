// packages/analysis/src/ports.ts
//
// Pure data interfaces for analysis functions.
// Prisma-free — no runtime dependency on @prisma/client.
// Only common record types and leaf-function input shapes live here.
// Composition functions define their own pure signatures inline.

// ── Common record types ──────────────────────────────────

/** Minimal injury record from DB */
export interface InjuryRecord {
  playerId: number;
  teamId: number;
  leagueId: number;
  fixtureId: number;
  fixtureDate: Date;
  type: string;
  reason: string;
}

/** Fixture metadata (id, date, status) */
export interface FixtureInfo {
  id: number;
  date: Date;
  status: string;
}

/** Lineup appearance with fixture completion status */
export interface AppearanceEntry {
  playerId: number;
  fixtureDate: Date;
  fixtureCompleted: boolean;
}

/** Player season stats row — all fields Prisma returns */
export interface PlayerStatRecord {
  playerId: number;
  seasonId: number;
  playerName: string;
  playerPosition: string | null;
  lineups: number;
  minutes: number | null;
  rating: number | null;
  appearances: number | null;
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
}

/** Fixture with team-specific statistics (for performance delta) */
export interface FixtureWithStats {
  id: number;
  homeTeamId: number;
  goalsHome: number | null;
  goalsAway: number | null;
  date: Date;
  statistics: Array<{ possession: number | null; expectedGoals: number | null }>;
}

/** Lineup entry (starter/sub) with fixture date */
export interface LineupEntry {
  playerId: number;
  isStarting: boolean;
  fixtureDate: Date;
}

/** Player availability (recovery signal) record */
export interface AvailabilityRecord {
  playerId: number;
  predictedAvailability: number;
  latestSignalStage: string | null;
  lastSignalAt: Date | null;
  confidenceLevel: number;
  fixtureId: number;
}

/** Deployment data entry for grid-based position profiling */
export interface DeploymentEntry {
  playerId: number;
  grid: string | null;
  formation: string | null;
  fixtureDate: Date;
}

/** Recent lineup formation record */
export interface RecentFormationEntry {
  formation: string | null;
  fixtureDate: Date;
}

// ── Leaf-function input types ────────────────────────────

/** Input for computePlayerWeightsPure */
export interface PlayerWeightInput {
  allStats: PlayerStatRecord[];
  seasonIds: number[];
}

/** Input for computePerformanceDeltaPure */
export interface PerformanceDeltaInput {
  teamId: number;
  teamName: string;
  season: number;
  playerId: number;
  playerName: string;
  fixtures: FixtureWithStats[];
  startedFixtureIds: Set<number>;
}

/** Input for computeTeamPerformanceDeltasPure */
export interface TeamPerformanceDeltasInput {
  teamId: number;
  fixtures: FixtureWithStats[];
  lineupEntries: Array<{ playerId: number; fixtureId: number }>;
  playerIds: number[];
}

/** Input for resolveActiveInjuriesPure */
export interface ActiveInjuryInput {
  injuries: InjuryRecord[];
  fixtureInfoMap: Map<number, FixtureInfo>;
  appearances: AppearanceEntry[];
}

/** Input for resolveAbsenceTransitionsPure */
export interface AbsenceTransitionInput {
  candidatePlayerIds: number[];
  lineupAppearances: Array<{
    playerId: number;
    fixtureId: number;
    fixtureDate: Date;
  }>;
  candidateInjuries: Array<{
    playerId: number;
    fixtureDate: Date;
    fixtureId: number;
  }>;
  firstTeamPlayerIds: Set<number>;
  fullRecords: Array<InjuryRecord & {
    id: number;
    season: number;
    player: { id: number; name: string; photo: string; position: string | null };
    team: { id: number; name: string; logo: string };
    league: { id: number; name: string; logo: string; apiFootballId: number };
  }>;
}

/** Input for computeInjuryImpactPure */
export interface InjuryImpactInput {
  teamId: number;
  teamName: string;
  season: number;
  injuries: Array<{
    playerId: number;
    playerName: string;
    type: string;
    reason: string;
    fixtureDate: Date;
  }>;
}
