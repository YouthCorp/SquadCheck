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
  //
  // SIGNAL_WEIGHT for injured = 1.00 (changed from 0.80):
  //   With 0.80, even an 'available' stage RSS signal (recoveryScore=0.75)
  //   only reached predictedAvailability=0.60, below the 0.70 lineup threshold.
  //   With 1.00: available(0.75)→0.75 ✓, expected_to_start(0.90)→0.90 ✓,
  //   full_training(0.55)→0.55 ✗ (correct — training ≠ match availability).
  availability: {
    injured:   { BASE: 0.00, SIGNAL_WEIGHT: 1.00 },
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

/**
 * Injury reasons that indicate a disciplinary absence (red card / suspension / yellow cards).
 * These players are NOT real injury cases — they serve fixed match bans and return automatically.
 */
export const DISCIPLINARY_REASONS = [
  'red card',
  'suspended',
  'suspension',
  'yellow card',
  'yellow cards',
] as const;

/**
 * All non-physical absence reasons to exclude from the recovery signal pipeline.
 * Superset of DISCIPLINARY_REASONS — also excludes international duty, inactive,
 * coach absences, loan agreements, rest, and doping.
 *
 * NOTE: Intentionally mirrors NON_INJURY_EXCLUSION_FILTER in @squadcheck/analysis.
 * The ingestion package cannot import from @squadcheck/analysis (circular dep risk),
 * so the reason set must be duplicated here. If reasons change in injury-resolver.ts,
 * update this list in sync.
 * Used in buildInjuredPlayerIndex() so signal collection targets only real injuries.
 */
export const NON_SIGNAL_EXCLUSION_REASONS = [
  'red card',
  'suspended',
  'suspension',
  'yellow card',
  'yellow cards',
  'international duty',
  'inactive',
  'coach',
  'loan agreement',
  'rest',
  'doping',
] as const;

// ── Team aliases dictionary ──
// key = normalizeName(team.name) EXACTLY as stored in DB
// Verified against season=2025 fixture data across all 5 leagues.
// Alias length threshold is >=3 in entity-matcher (allows acronyms like 'psg', 'bvb').
export const TEAM_ALIASES: Record<string, string[]> = {
  // ── Premier League (EPL) ──
  // 2025/26: promoted Burnley, Leeds, Sunderland | relegated Ipswich, Leicester, Southampton
  'arsenal':           ['arsenal', 'gunners'],
  'aston villa':       ['aston villa', 'villa', 'villans'],
  'bournemouth':       ['bournemouth', 'cherries', 'afc bournemouth'],
  'brentford':         ['brentford', 'bees'],
  'brighton':          ['brighton', 'seagulls', 'albion'],
  'burnley':           ['burnley', 'clarets'],
  'chelsea':           ['chelsea', 'blues'],
  'crystal palace':    ['crystal palace', 'palace', 'eagles'],
  'everton':           ['everton', 'toffees'],
  'fulham':            ['fulham', 'cottagers'],
  'leeds':             ['leeds', 'whites', 'leeds united'],
  'liverpool':         ['liverpool', 'reds'],
  'manchester city':   ['manchester city', 'man city', 'citizens'],
  'manchester united': ['manchester united', 'man united', 'man utd', 'red devils'],
  'newcastle':         ['newcastle', 'magpies', 'toon'],
  'nottingham forest': ['nottingham forest', 'forest'],
  'sunderland':        ['sunderland', 'black cats'],
  'tottenham':         ['tottenham', 'spurs'],
  'west ham':          ['west ham', 'hammers', 'irons'],
  'wolves':            ['wolves', 'wolverhampton'],

  // ── La Liga ──
  'alaves':            ['alaves', 'deportivo alaves'],
  'athletic club':     ['athletic', 'athletic bilbao', 'bilbao'],
  'atletico madrid':   ['atletico', 'atleti', 'atletico de madrid'],
  'barcelona':         ['barcelona', 'barca', 'blaugrana'],
  'celta vigo':        ['celta'],
  'elche':             ['elche'],
  'espanyol':          ['espanyol', 'rcd espanyol'],
  'getafe':            ['getafe'],
  'girona':            ['girona'],
  'levante':           ['levante'],
  'mallorca':          ['mallorca', 'rcd mallorca'],
  'osasuna':           ['osasuna'],
  'oviedo':            ['oviedo', 'real oviedo'],
  'rayo vallecano':    ['rayo'],
  'real betis':        ['betis', 'real betis'],
  'real madrid':       ['real madrid', 'madrid', 'blancos', 'merengues'],
  'real sociedad':     ['sociedad', 'la real', 'real sociedad'],
  'sevilla':           ['sevilla'],
  'valencia':          ['valencia'],
  'villarreal':        ['villarreal', 'yellow submarine'],

  // ── Serie A ──
  'ac milan':          ['milan', 'rossoneri', 'ac milan'],       // press writes "Milan" not "AC Milan"
  'as roma':           ['roma', 'giallorossi', 'as roma'],
  'atalanta':          ['atalanta', 'la dea'],
  'bologna':           ['bologna'],
  'cagliari':          ['cagliari'],
  'como':              ['como'],
  'cremonese':         ['cremonese'],
  'fiorentina':        ['fiorentina', 'viola'],
  'genoa':             ['genoa'],
  'hellas verona':     ['verona', 'hellas verona', 'hellas'],
  'inter':             ['inter', 'inter milan', 'nerazzurri', 'internazionale'],
  'juventus':          ['juventus', 'juve', 'bianconeri'],
  'lazio':             ['lazio'],
  'lecce':             ['lecce'],
  'napoli':            ['napoli', 'partenopei'],
  'parma':             ['parma'],
  'pisa':              ['pisa'],
  'sassuolo':          ['sassuolo', 'neroverdi'],
  'torino':            ['torino', 'toro', 'granata'],
  'udinese':           ['udinese'],

  // ── Bundesliga ──
  '1  fc heidenheim':       ['heidenheim'],                      // "1. FC Heidenheim" → normalized
  '1  fc koln':             ['koln', 'cologne', 'fc koln'],      // "1. FC Köln" → normalized
  '1899 hoffenheim':        ['hoffenheim', 'tsg hoffenheim'],
  'bayer leverkusen':       ['leverkusen', 'bayer'],
  'bayern munchen':         ['bayern', 'fcb', 'fc bayern', 'bavarians'], // "Bayern München" → normalized
  'borussia dortmund':      ['dortmund', 'bvb'],
  'borussia monchengladbach': ['gladbach', 'bmg'],               // "Borussia Mönchengladbach" → normalized
  'eintracht frankfurt':    ['frankfurt', 'eintracht', 'sge'],
  'fc augsburg':            ['augsburg', 'fca'],
  'fc st  pauli':           ['st pauli', 'fc st pauli'],         // "FC St. Pauli" → normalized
  'fsv mainz 05':           ['mainz', 'mainz 05'],
  'hamburger sv':           ['hamburg', 'hsv'],
  'rb leipzig':             ['leipzig', 'rbl'],
  'sc freiburg':            ['freiburg'],
  'union berlin':           ['union', 'union berlin'],
  'vfb stuttgart':          ['stuttgart', 'vfb'],
  'vfl wolfsburg':          ['wolfsburg'],
  'werder bremen':          ['werder', 'bremen'],

  // ── Ligue 1 ──
  'angers':                 ['angers'],
  'auxerre':                ['auxerre', 'aja'],
  'le havre':               ['le havre', 'hac'],
  'lens':                   ['lens', 'rc lens'],
  'lille':                  ['lille', 'losc'],
  'lorient':                ['lorient'],
  'lyon':                   ['lyon', 'olympique lyonnais'],
  'marseille':              ['marseille', 'om'],
  'metz':                   ['metz'],
  'monaco':                 ['monaco', 'asm'],
  'nantes':                 ['nantes', 'fc nantes'],
  'nice':                   ['nice', 'ogcn'],
  'paris fc':               ['paris fc'],
  'paris saint germain':    ['psg', 'paris sg', 'paris saint germain'], // 'psg' needs >=3 threshold
  'rennes':                 ['rennes', 'stade rennais'],
  'stade brestois 29':      ['brest', 'stade brestois'],         // "Stade Brestois 29" in DB
  'strasbourg':             ['strasbourg', 'rcsa'],
  'toulouse':               ['toulouse', 'tfc'],
};

// ── Player nickname dictionary ──
// key = normalizeName(player.name) EXACTLY as stored in DB
// Verified against 2025/26 injury + lineup data across all 5 leagues.
// Only includes entries where press alias adds value over last-name auto-indexing.
// Auto-indexing rule: last token of name is indexed if ≥4 chars.
export const PLAYER_NICKNAMES: Record<string, string[]> = {
  // ════════════════════════════════════════
  // PREMIER LEAGUE
  // ════════════════════════════════════════

  // Last name <4 chars → NOT auto-indexed
  'm van de ven':      ['van de ven'],          // Tottenham — last='ven' (3 chars)

  // Multi-word compound names: press uses full compound
  'v van dijk':        ['van dijk'],            // Liverpool — last='dijk' indexed, 'van dijk' more natural
  'm gibbs white':     ['gibbs white'],         // Nottingham Forest — last='white' is ambiguous alone
  'j ward prowse':     ['ward prowse'],         // Burnley — compound form common in press

  // First name used in press (last name already auto-indexed)
  'bruno fernandes':   ['bruno'],               // Manchester United
  'bruno guimaraes':   ['bruno'],               // Newcastle (different team → no conflict)
  'lisandro martinez': ['lisandro', 'licha'],   // Manchester United
  'matheus cunha':     ['matheus'],             // Manchester United
  'bernardo silva':    ['bernardo'],            // Manchester City

  // East Asian name conventions: press uses first element
  'hwang hee chan':    ['hwang'],               // Wolves — press writes 'Hwang', last='chan' is indexed

  // Press nicknames
  'j maddison':        ['madders'],             // Tottenham
  'mohamed salah':     ['mo salah'],            // Liverpool — 'salah' indexed, 'mo salah' widely used
  'ruben dias':        ['ruben'],               // Manchester City

  // ════════════════════════════════════════
  // LA LIGA
  // ════════════════════════════════════════

  // First name used in press
  'lamine yamal':      ['yamal'],               // Barcelona — 'yamal' is last name (indexed), also standalone press use
  'alejandro balde':   ['balde'],               // Barcelona — 'balde' indexed
  'marcos llorente':   ['llorente'],            // Atletico Madrid — 'llorente' indexed

  // ════════════════════════════════════════
  // SERIE A
  // ════════════════════════════════════════

  // Last name <4 chars → NOT auto-indexed
  // (none found in current injury data)

  // First name / common press name
  'lautaro martinez':  ['lautaro', 'el toro'],  // Inter — 'martinez' indexed, 'lautaro' widely used
  'rafael leao':       ['rafa', 'rafa leao'],   // AC Milan — 'leao' indexed, 'rafa' common in press

  // ════════════════════════════════════════
  // LIGUE 1
  // ════════════════════════════════════════

  // Last name <4 chars → NOT auto-indexed
  'lee kang in':       ['kang in', 'lee kang in'], // PSG — last='in' (2 chars), press uses 'Lee Kang-In'

  // East Asian name conventions
  'hong hyun seok':    ['hong'],                // Nantes — last='seok' (4 chars) indexed, 'hong' also used
  'kwon hyeok kyu':    ['kwon'],                // Nantes — last='kyu' (3 chars) NOT indexed

  // First name used in press
  'fabien ruiz':       ['fabien'],              // PSG — 'ruiz' indexed

  // ════════════════════════════════════════
  // BUNDESLIGA
  // ════════════════════════════════════════

  // First name used in press
  'raphael guerreiro': ['guerreiro'],           // Bayern — 'guerreiro' indexed (accent stripped in normalization)
};
