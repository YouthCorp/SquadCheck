export {
  computePlayerWeights,
  computePlayerWeightsLegacy,
  classifyPosition,
  type PlayerWeight,
  type PositionGroup,
} from './player-weight';

export {
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

export {
  computeInjuryImpact,
  computeRichInjuryImpact,
  type InjuryImpactSummary,
  type RichInjuryImpact,
} from './injury-impact';

export {
  computePerformanceDelta,
  computeTeamPerformanceDeltas,
  type PerformanceDelta,
  type PerformanceDeltaSummary,
} from './performance-delta';

export {
  computePredictedLineup,
  type PredictedLineup,
  type PredictedPlayer,
  type UnavailablePlayer,
  type PositionSlots,
} from './predicted-lineup';

export {
  getFormationTemplate,
  resolveGridPosition,
  positionAffinityForSlot,
  type FormationSlot,
  type SpecificPosition,
} from './formation-templates';

export {
  computeTeamOutcomeImpact,
  type TeamOutcomeImpact,
  type OutcomeBaseline,
  type PlayerOutcomeRecord,
  type TeamSeasonStatsInput,
  type StandingEntryInput,
} from './team-outcome-impact';

export { type MatchAggregates } from './performance-delta';

export {
  resolveActiveInjuries,
  resolveAbsenceTransitions,
  NON_INJURY_EXCLUSION_FILTER,
  type ActiveInjury,
  type AbsenceRecord,
} from './utils/injury-resolver';
