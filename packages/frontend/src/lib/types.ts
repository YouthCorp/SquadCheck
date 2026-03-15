// Team — superset of all page versions.
// founded/venueName/venueCapacity: optional (team page only)
export interface Team {
  id: number;
  name: string;
  logo: string | null;
  country: string | null;
  founded?: number | null;
  venueName?: string | null;
  venueCapacity?: number | null;
}

export interface InjuredPlayer {
  player: { id: number; name: string; photo: string | null; position: string | null };
  injury: { type: string; reason: string; date: string };
  injuryContext: { type: string; timingMultiplier: number; description: string };
  starterProfile: {
    starterCount: number;
    substituteCount: number;
    totalTeamFixtures: number;
    starterFrequency: number;
    role: string;
    lastStartFixtureDate: string | null;
    lastAppearanceFixtureDate: string | null;
  };
  performanceDelta: { winRateDelta: number; avgGoalsDelta: number; avgConcededDelta: number } | null;
  hasSignificantSample: boolean;
  winRateBoost: number;
  compositeImpactScore: number;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  weight: number;
  weightPct: number;
  positionGroup: string;
  dataSource: string;
  stats?: { goals: number | null; assists: number | null; minutes: number | null; appearances: number | null };
  /** Present when at least one recovery signal exists for the player */
  recoverySignal?: {
    predictedAvailability: number;
    confidenceLevel: number;
    latestSignalStage: string | null;
    lastSignalAt: string | null;
  };
}

export interface PlayerOutcomeRecord {
  playerId: number;
  playerName: string;
  position: string | null;
  severity: string;
  withPlayer: { W: number; D: number; L: number; matches: number; xgAvg: number | null };
  withoutPlayer: { W: number; D: number; L: number; matches: number; xgAvg: number | null };
  xgDelta: number | null;
  winRateDelta: number;
  hasSignificantSample: boolean;
}

export interface TeamOutcomeImpact {
  baseline: {
    xgPerMatch: number;
    xgaPerMatch: number;
    goalsPerMatch: number;
    concededPerMatch: number;
    winRate: number;
    matches: number;
  };
  depleted: {
    estimatedXg: number;
    estimatedXga: number;
    estimatedWinRate: number;
  };
  impact: {
    xgDelta: number | null;
    xgaDelta: number | null;
    winRateDelta: number;
  };
  playerRecords: PlayerOutcomeRecord[];
  confidence: 'high' | 'medium' | 'low';
  injuredStarterCount: number;
}

export interface InjuryImpact {
  team: Team;
  season: number;
  totalWeight: number;
  injuredWeight: number;
  powerLossPct: number;
  compositeImpactTotal: number;
  totalInjuries: number;
  uniquePlayers: number;
  severitySummary: { critical: number; high: number; moderate: number; low: number };
  outcomeImpact?: TeamOutcomeImpact | null;
  injuredPlayers: InjuredPlayer[];
}

export interface Fixture {
  id: number;
  date: string;
  round: string | null;
  status: string;
  venueName: string | null;
  venueCity: string | null;
  goalsHome: number | null;
  goalsAway: number | null;
  homeTeam: Team;
  awayTeam: Team;
}

export interface PredictedPlayer {
  playerId: number;
  playerName: string;
  photo: string | null;
  position: string | null;
  positionGroup: 'GK' | 'DEF' | 'MID' | 'FWD';
  weight: number;
  starterFrequency: number;
  compositeScore: number;
  role: 'regular_starter' | 'rotation' | 'bench';
  recentReturn: boolean;
  slotPosition: string;
  slotLabel: string;
  pitchX: number;
  pitchY: number;
  positionAffinity: number;
  recentStarterFrequency: number;
  /** Only present for players moved from injured → available via recovery signal */
  signalRecovered?: {
    predictedAvailability: number;
    latestSignalStage: string | null;
    lastSignalAt: string | null;
    confidenceLevel: number;
  };
}

export interface UnavailablePlayer {
  playerId: number;
  playerName: string;
  photo: string | null;
  position: string | null;
  positionGroup: 'GK' | 'DEF' | 'MID' | 'FWD';
  weight: number;
  injuryReason: string;
  wouldHaveStarted: boolean;
}

export interface FormationSlotInfo {
  specificPosition: string;
  displayLabel: string;
  positionGroup: 'GK' | 'DEF' | 'MID' | 'FWD';
  pitchX: number;
  pitchY: number;
}

export interface RecentInjuryEntry {
  id: number;
  type: string;
  reason: string;
  fixtureDate: string;
  lastStartFixtureDate: string | null;
  player: { id: number; name: string; photo: string | null; position: string | null };
  team: { id: number; name: string; logo: string | null };
  league: { id: number; name: string; logo: string | null; apiFootballId: number };
}

export interface RecentSignalEntry {
  playerId: number;
  player: { id: number; name: string; photo: string | null; position: string | null };
  team: { id: number; name: string; logo: string | null } | null;
  predictedAvailability: number;
  confidenceLevel: number;
  latestSignalStage: string | null;
  lastSignalAt: string | null;
  signalCount: number;
  officialStatus: string;
  upcomingFixture: {
    id: number;
    date: string;
    homeTeam: { id: number; name: string; logo: string | null };
    awayTeam: { id: number; name: string; logo: string | null };
  } | null;
}

export interface LiveUpdatesData {
  recentInjuries: RecentInjuryEntry[];
  recentSignals: RecentSignalEntry[];
}

export interface InjurySummaryEntry {
  team: { id: number; name: string; logo: string | null } | undefined;
  injuryCount: number;
}

export interface StandingEntry {
  rank: number; points: number; played: number;
  wins: number; draws: number; losses: number;
  goalsFor: number; goalsAgainst: number; goalsDiff: number;
  form: string | null;
  team: { id: number; name: string; logo: string | null; code: string | null };
}

export interface Standing {
  id: number;
  entries: StandingEntry[];
}

export interface FixtureWithLeague extends Fixture {
  league: { id: number; name: string; logo: string | null } | null;
}

export interface FixtureTeamStats {
  team: { id: number; name: string };
  shotsOnGoal: number | null;
  shotsOffGoal: number | null;
  totalShots: number | null;
  blockedShots: number | null;
  shotsInsideBox: number | null;
  shotsOutsideBox: number | null;
  fouls: number | null;
  cornerKicks: number | null;
  offsides: number | null;
  possession: number | null;
  yellowCards: number | null;
  redCards: number | null;
  goalkeeperSaves: number | null;
  totalPasses: number | null;
  passesAccurate: number | null;
  passPercent: number | null;
  expectedGoals: number | null;
  goalsPrevented: number | null;
}

export interface FixtureLineupPlayer {
  player: { id: number; name: string; photo: string | null };
  playerName: string;
  number: number | null;
  position: string | null;
  grid: string | null;
  isStarting: boolean;
}

export interface FixtureTeamLineup {
  team: { id: number; name: string; logo: string | null };
  formation: string | null;
  coachName: string | null;
  players: FixtureLineupPlayer[];
}

export interface FixtureEvent {
  id: number;
  timeElapsed: number;
  timeExtra: number | null;
  type: string;
  detail: string | null;
  teamId: number | null;
  player: { id: number; name: string } | null;
  assist: { id: number; name: string } | null;
}

export interface FixtureDetail extends Fixture {
  homeTeam: Team & { logo: string | null; code: string | null };
  awayTeam: Team & { logo: string | null; code: string | null };
  statistics: FixtureTeamStats[];
  lineups: FixtureTeamLineup[];
  events: FixtureEvent[];
}

export interface PredictedLineup {
  teamId: number;
  teamName: string;
  teamLogo: string | null;
  season: number;
  formation: string;
  formationSource: 'historical' | 'default';
  positionSlots: { GK: number; DEF: number; MID: number; FWD: number };
  formationSlots: FormationSlotInfo[];
  starters: PredictedPlayer[];
  unavailable: UnavailablePlayer[];
}
