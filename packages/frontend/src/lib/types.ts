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
  injuredPlayers: InjuredPlayer[];
}

export interface Fixture {
  id: number;
  date: string;
  round: string | null;
  status: string;
  venueName: string | null;
  venueCity: string | null;
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
