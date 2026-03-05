/**
 * Centralized configuration for the recovery signal intelligence layer.
 * All thresholds and weights are defined here — never hardcoded elsewhere.
 */
export const SIGNAL_CONFIG = {
  // ── Keyword classification thresholds ──
  keyword: {
    /** Above this → use keyword result directly, no Claude needed */
    CONFIDENT_THRESHOLD: 0.8,
    /** Below this → discard the article (too weak / negative only) */
    AMBIGUOUS_LOWER: 0.3,
    // Between AMBIGUOUS_LOWER and CONFIDENT_THRESHOLD → send to Claude
  },

  // ── Claude API call control ──
  claude: {
    MAX_CALLS_PER_CYCLE: 50,
    TIMEOUT_MS: 10_000,
    MODEL: 'claude-haiku-4-5-20251001' as const,
  },

  // ── Signal aggregation ──
  aggregation: {
    /** Only signals published within this window are included */
    SIGNAL_WINDOW_DAYS: 7,
    /** Exponential decay half-life in days */
    RECENCY_HALF_LIFE_DAYS: 3.5,
  },

  // ── Official-status → predictedAvailability conversion ──
  // predictedAvailability = BASE + recoverySignalScore × SIGNAL_WEIGHT
  availability: {
    injured:   { BASE: 0.00, SIGNAL_WEIGHT: 0.80 },
    doubtful:  { BASE: 0.30, SIGNAL_WEIGHT: 0.50 },
    available: { BASE: 1.00, SIGNAL_WEIGHT: 0.00 }, // API-confirmed: always 1.0
  } as Record<string, { BASE: number; SIGNAL_WEIGHT: number }>,

  // ── Lineup integration thresholds ──
  lineup: {
    /** predictedAvailability must be >= this to move player from injured → available */
    AVAILABILITY_THRESHOLD: 0.7,
    /** confidenceLevel must be >= this to be trusted */
    CONFIDENCE_THRESHOLD: 0.5,
  },

  // ── Default recovery_score per signal stage ──
  stageScores: {
    partial_training:   0.30,
    full_training:      0.55,
    available:          0.75,
    expected_to_start:  0.90,
  } as Record<string, number>,
} as const;

export type SignalStage = keyof typeof SIGNAL_CONFIG.stageScores;
export const SIGNAL_STAGES = Object.keys(SIGNAL_CONFIG.stageScores) as SignalStage[];
