// ── Pure data interfaces (Prisma-free) ──────────────────────
export type {
  InjuryRecord,
  FixtureInfo,
  AppearanceEntry,
  PlayerStatRecord,
  FixtureWithStats,
  LineupEntry,
  AvailabilityRecord,
  DeploymentEntry,
  RecentFormationEntry,
  PlayerWeightInput,
  PerformanceDeltaInput,
  TeamPerformanceDeltasInput,
  ActiveInjuryInput,
  AbsenceTransitionInput,
  InjuryImpactInput,
} from './ports';

// ── Data access (Prisma queries) ────────────────────────────
export {
  NON_INJURY_EXCLUSION_FILTER,
  fetchPlayerWeightData,
  fetchPerformanceDeltaData,
  fetchTeamPerformanceDeltasData,
  fetchActiveInjuryData,
  fetchAbsenceTransitionData,
  fetchInjuryImpactData,
  fetchRecoverySignalData,
  fetchUpcomingFixtureId,
  fetchTeamPowerLossData,
  fetchPredictedLineupData,
  fetchPlayerPhotos,
  fetchSeasonChainData,
  fetchTeamLeagueId,
  fetchOutcomeImpactData,
} from './data-access';

// ── Player weights ──────────────────────────────────────────
export {
  computePlayerWeightsPure,
  computePlayerWeights,
  computePlayerWeightsLegacy,
  classifyPosition,
  type PlayerWeight,
  type PositionGroup,
} from './player-weight';

// ── Team power loss ─────────────────────────────────────────
export {
  computeTeamPowerLossPure,
  computeTeamPowerLoss,
  type TeamPowerLoss,
  type EnrichedTeamPowerLoss,
  type InjuredPlayer,
  type EnrichedInjuredPlayer,
  type StarterProfile,
  type StarterRole,
  type InjuryContext,
  type InjuryContextType,
  type Severity,
} from './team-power-loss';

// ── Injury impact ───────────────────────────────────────────
export {
  computeInjuryImpactPure,
  computeRichInjuryImpactPure,
  computeInjuryImpact,
  computeRichInjuryImpact,
  type InjuryImpactSummary,
  type RichInjuryImpact,
} from './injury-impact';

// ── Performance delta ───────────────────────────────────────
export {
  computePerformanceDeltaPure,
  computeTeamPerformanceDeltasPure,
  computePerformanceDelta,
  computeTeamPerformanceDeltas,
  type PerformanceDelta,
  type PerformanceDeltaSummary,
  type MatchAggregates,
} from './performance-delta';

// ── Predicted lineup ────────────────────────────────────────
export {
  computePredictedLineupPure,
  computePredictedLineup,
  type PredictedLineup,
  type PredictedPlayer,
  type UnavailablePlayer,
  type PositionSlots,
} from './predicted-lineup';

// ── Formation templates ─────────────────────────────────────
export {
  getFormationTemplate,
  resolveGridPosition,
  positionAffinityForSlot,
  type FormationSlot,
  type SpecificPosition,
} from './formation-templates';

// ── Team outcome impact ─────────────────────────────────────
export {
  computeTeamOutcomeImpact,
  type TeamOutcomeImpact,
  type OutcomeBaseline,
  type PlayerOutcomeRecord,
  type TeamSeasonStatsInput,
  type StandingEntryInput,
} from './team-outcome-impact';

// ── Recovery signals ────────────────────────────────────────
export {
  applyRecoverySignalsPure,
  applyRecoverySignals,
  findUpcomingFixtureId,
  type RecoverySignalResult,
  type SignalRecoveredInfo,
} from './recovery-signal-integration';

// ── Injury resolver ─────────────────────────────────────────
export {
  resolveActiveInjuriesPure,
  resolveAbsenceTransitionsPure,
  resolveActiveInjuries,
  resolveAbsenceTransitions,
  buildLatestAppearanceMap,
  type ActiveInjury,
  type AbsenceRecord,
} from './utils/injury-resolver';

// Re-export canonical domain constants for consumers that previously relied on
// the analysis package as a proxy. Prefer importing from @squadcheck/database directly.
export { buildExclusionFilter } from '@squadcheck/database';

// ── Season resolver ─────────────────────────────────────────
export {
  resolveSeasonChain,
  resolveTeamLeague,
} from './utils/season-resolver';

// ── Facades ─────────────────────────────────────────────────
export {
  analyzeTeamPower,
  analyzeInjuryImpact,
  analyzePredictedLineup,
  analyzePlayerImpact,
  analyzeTeamImpactReport,
  type SeasonChain,
  type TeamPowerResult,
  type InjuryImpactResult,
  type PredictedLineupResult,
  type PlayerImpactResult,
  type TeamImpactReportResult,
} from './facades';
