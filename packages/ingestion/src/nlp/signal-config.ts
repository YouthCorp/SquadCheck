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

  // ── Final confidence scoring thresholds ──
  confidence: {
    HIGH: 0.85,       // >= HIGH → DB 저장 + availability 즉시 반영
    MEDIUM: 0.60,     // >= MEDIUM → DB 저장 + availability 반영
    LOW_CUTOFF: 0.40, // < LOW_CUTOFF → discard (저장 안 함)
  },
} as const;

export type SignalStage = keyof typeof SIGNAL_CONFIG.stageScores;
export const SIGNAL_STAGES = Object.keys(SIGNAL_CONFIG.stageScores) as SignalStage[];

// ── Team aliases dictionary ──
// key = normalizeName(team.name) EXACTLY as stored in DB
// Verified against EPL 2025/26 fixture data (season=2025)
// Promoted: Burnley, Leeds, Sunderland | Relegated: Ipswich Town, Leicester City, Southampton
export const TEAM_ALIASES: Record<string, string[]> = {
  'arsenal':           ['arsenal', 'gunners'],
  'aston villa':       ['aston villa', 'villa', 'villans'],
  'bournemouth':       ['bournemouth', 'cherries', 'afc bournemouth'],
  'brentford':         ['brentford', 'bees'],
  'brighton':          ['brighton', 'seagulls', 'albion'],     // DB = "Brighton" (not full form)
  'burnley':           ['burnley', 'clarets'],                  // promoted
  'chelsea':           ['chelsea', 'blues'],
  'crystal palace':    ['crystal palace', 'palace', 'eagles'],
  'everton':           ['everton', 'toffees'],
  'fulham':            ['fulham', 'cottagers'],
  'leeds':             ['leeds', 'whites', 'leeds united'],     // promoted; DB = "Leeds"
  'liverpool':         ['liverpool', 'reds'],
  'manchester city':   ['manchester city', 'man city', 'citizens'],
  'manchester united': ['manchester united', 'man united', 'man utd', 'red devils'],
  'newcastle':         ['newcastle', 'magpies', 'toon'],        // DB = "Newcastle"
  'nottingham forest': ['nottingham forest', 'forest'],
  'sunderland':        ['sunderland', 'black cats'],            // promoted
  'tottenham':         ['tottenham', 'spurs'],                  // DB = "Tottenham"
  'west ham':          ['west ham', 'hammers', 'irons'],
  'wolves':            ['wolves', 'wolverhampton'],             // DB = "Wolves"
};

// ── Player nickname dictionary ──
// key = normalizeName(player.name) EXACTLY as stored in DB
// Verified against EPL 2025/26 injury + lineup data.
// Only includes entries where press alias differs from what last-name auto-indexing already handles.
// Auto-indexing rule: last token of name is indexed if ≥4 chars.
export const PLAYER_NICKNAMES: Record<string, string[]> = {
  // ── Last name <4 chars → NOT auto-indexed ──
  'm van de ven':      ['van de ven'],          // Tottenham — last='ven' (3 chars)

  // ── Multi-word compound last names: press uses full compound ──
  'v van dijk':        ['van dijk'],            // Liverpool — last='dijk' indexed, 'van dijk' is press-natural
  'm gibbs white':     ['gibbs white'],         // Nottingham Forest — last='white' indexed but ambiguous
  'j ward prowse':     ['ward prowse'],         // Burnley — last='prowse' indexed, compound form common

  // ── First name used in press (last name already auto-indexed) ──
  'bruno fernandes':   ['bruno'],               // Manchester United — 'fernandes' indexed
  'bruno guimaraes':   ['bruno'],               // Newcastle — 'guimaraes' indexed (different team, no conflict)
  'lisandro martinez': ['lisandro', 'licha'],   // Manchester United — 'martinez' indexed
  'matheus cunha':     ['matheus'],             // Manchester United — 'cunha' indexed
  'bernardo silva':    ['bernardo'],            // Manchester City — 'silva' indexed

  // ── East Asian name conventions: press uses first element ──
  'hwang hee chan':    ['hwang'],               // Wolves — press uses 'Hwang', last='chan' indexed

  // ── Press nicknames distinct from full/last name ──
  'j maddison':        ['madders'],             // Tottenham — 'maddison' indexed
  'mohamed salah':     ['mo salah'],            // Liverpool — 'salah' indexed, 'mo salah' widely used in press
  'ruben dias':        ['ruben'],               // Manchester City — 'dias' indexed
};
