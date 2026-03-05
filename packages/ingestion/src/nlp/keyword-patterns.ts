import { SIGNAL_CONFIG, SignalStage } from './signal-config';

// ── Negation patterns (checked first — any match → skip article) ──
const NEGATION_PATTERNS: RegExp[] = [
  /\bnot\s+(fit|ready|available|training|returning)\b/i,
  /\bruled?\s+out\b/i,
  /\bunlikely\s+to\s+(feature|play|start|return)\b/i,
  /\bstill\s+(sidelined|injured|out|recovering)\b/i,
  /\bout\s+(for|until)\b/i,
  /\bno\s+(return|comeback|chance)\b/i,
  /\bwon'?t\s+(be|play|feature|return)\b/i,
  /\bcannot\s+(play|return|feature)\b/i,
  /\bmiss(?:es|ing|ed)?\s+(?:the\s+)?(?:match|game|fixture|trip)\b/i,
  /\bdoubt(?:ful)?\s+for\b/i,
];

// ── Positive signal patterns per stage ──
const STAGE_PATTERNS: Record<SignalStage, RegExp[]> = {
  partial_training: [
    /\blight\s+training\b/i,
    /\bindividual(?:\s+training)?\s+session\b/i,
    /\bjogging\s+(?:on|around)\s+(?:the\s+)?pitch\b/i,
    /\btraining\s+individually\b/i,
    /\bpool\s+(?:work|session|running)\b/i,
    /\brehabilitation\s+(?:work|session|programme)\b/i,
    /\bseparate\s+session\b/i,
    /\blight\s+work\b/i,
  ],

  full_training: [
    /\bfull\s+(?:team\s+)?training(?:\s+session)?\b/i,
    /\btrained\s+with\s+(?:the\s+)?(?:squad|team|group)\b/i,
    /\bback\s+in\s+(?:team|squad|group|full)\s+training\b/i,
    /\bjoined\s+(?:the\s+)?(?:squad|team|group)\s+(?:in\s+)?training\b/i,
    /\bteam\s+session\b/i,
    /\breturned\s+to\s+(?:full\s+)?training\b/i,
    /\bback\s+(?:on\s+)?the\s+training\s+ground\b/i,
    /\bpart\s+of\s+(?:the\s+)?(?:full\s+)?training\b/i,
  ],

  available: [
    /\bfit\s+(?:to\s+play|enough\s+to\s+play|and\s+available)\b/i,
    /\bavailable\s+for\s+(?:selection|the\s+(?:match|game|squad|fixture))\b/i,
    /\bin\s+contention\b/i,
    /\bpassed\s+(?:a\s+)?fitness\s+test\b/i,
    /\bfit\s+for\s+(?:the\s+)?(?:weekend|match|game|fixture|squad)\b/i,
    /\bback\s+in\s+(?:the\s+)?squad\b/i,
    /\bincluded\s+in\s+(?:the\s+)?squad\b/i,
    /\bnamed\s+in\s+(?:the\s+)?(?:squad|matchday)\b/i,
    /\bready\s+to\s+(?:play|return|feature)\b/i,
  ],

  expected_to_start: [
    /\bexpected\s+to\s+start\b/i,
    /\bset\s+to\s+start\b/i,
    /\bwill\s+(?:likely\s+)?start\b/i,
    /\bin\s+(?:the\s+)?(?:starting\s+)?(?:XI|eleven|lineup|line-?up)\b/i,
    /\blead\s+(?:the\s+)?(?:attack|line|forward\s+line)\b/i,
    /\bconfirmed\s+(?:to\s+)?start\b/i,
    /\bset\s+to\s+(?:lead|play|feature)\b/i,
  ],
};

export interface KeywordResult {
  stage: SignalStage;
  score: number;
  confidence: number;
  hasConflict: boolean;
  matchedStages: SignalStage[];
  negationDetected: boolean;
}

/**
 * Pass 1 keyword classification.
 * Returns null if the article is irrelevant or only negation was found.
 */
export function classifyByKeyword(text: string): KeywordResult | null {
  const normalized = text.toLowerCase();

  // Negation check — highest priority
  if (NEGATION_PATTERNS.some(p => p.test(normalized))) {
    return {
      stage: 'partial_training',
      score: 0,
      confidence: 0,
      hasConflict: false,
      matchedStages: [],
      negationDetected: true,
    };
  }

  const matchedStages: SignalStage[] = [];

  for (const [stage, patterns] of Object.entries(STAGE_PATTERNS) as [SignalStage, RegExp[]][]) {
    const hitCount = patterns.filter(p => p.test(normalized)).length;
    if (hitCount > 0) {
      matchedStages.push(stage);
    }
  }

  if (matchedStages.length === 0) return null;

  const hasConflict = matchedStages.length > 1;

  // Pick highest-stage match as the primary result
  const stageOrder: SignalStage[] = [
    'expected_to_start',
    'available',
    'full_training',
    'partial_training',
  ];
  const primaryStage = stageOrder.find(s => matchedStages.includes(s))!;
  const baseScore = SIGNAL_CONFIG.stageScores[primaryStage];

  // Confidence: penalised if multiple stages matched (conflicting)
  const confidence = hasConflict ? 0.5 : 0.9;

  return {
    stage: primaryStage,
    score: baseScore,
    confidence,
    hasConflict,
    matchedStages,
    negationDetected: false,
  };
}

/**
 * Determines whether this keyword result should be escalated to Claude.
 */
export function needsClaudeClassification(
  result: KeywordResult | null,
  claudeCallsThisCycle: number,
  maxCallsPerCycle: number,
): boolean {
  // Hard cap — never exceed budget
  if (claudeCallsThisCycle >= maxCallsPerCycle) return false;

  // Entity matched but no keyword signal → let Claude decide
  if (result === null) return true;

  // Negation detected → article is skip-worthy, no need for Claude
  if (result.negationDetected) return false;

  // Keyword is clearly confident → trust it
  if (
    !result.hasConflict &&
    result.matchedStages.length === 1 &&
    result.confidence >= SIGNAL_CONFIG.keyword.CONFIDENT_THRESHOLD
  ) {
    return false;
  }

  // Conflict, weak confidence, or multi-stage → escalate
  return true;
}
