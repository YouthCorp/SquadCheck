import { SIGNAL_CONFIG, SignalStage } from './signal-config';

// ── Negation patterns (checked first — any match → skip article) ──
const NEGATION_PATTERNS: RegExp[] = [
  // English
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
  // Spanish
  /\bno\s+(?:está|estará)\s+disponible\b/i,
  /\bdescartado\s+para\b/i,
  /\bsigue\s+(lesionado|de\s+baja)\b/i,
  /\bno\s+podrá\s+(?:jugar|participar)\b/i,
  /\bse\s+perderá\s+(?:el\s+partido|los\s+próximos)\b/i,
  // Italian
  /\bnon\s+(?:è|sarà)\s+disponibile\b/i,
  /\bsalterà\s+(?:la\s+partita|le\s+prossime)\b/i,
  /\bancora\s+(?:infortunato|fermo)\b/i,
  /\bouté\s+per\b/i,
  // German
  /\bsteht\s+nicht\s+zur\s+Verfügung\b/i,
  /\bfällt\s+(?:aus|weiterhin)\b/i,
  /\bnoch\s+nicht\s+(?:fit|einsatzbereit)\b/i,
  /\bwird\s+(?:das\s+Spiel\s+)?verpassen\b/i,
  // French
  /\bn(?:'|e)\s*(?:est|sera)\s+pas\s+disponible\b/i,
  /\btoujours\s+(?:blessé|indisponible)\b/i,
  /\bne\s+jouera\s+pas\b/i,
  /\babsent\s+pour\b/i,
];

// ── Positive signal patterns per stage ──
const STAGE_PATTERNS: Record<SignalStage, RegExp[]> = {
  partial_training: [
    // English
    /\blight\s+training\b/i,
    /\bindividual(?:\s+training)?\s+session\b/i,
    /\bjogging\s+(?:on|around)\s+(?:the\s+)?pitch\b/i,
    /\btraining\s+individually\b/i,
    /\bpool\s+(?:work|session|running)\b/i,
    /\brehabilitation\s+(?:work|session|programme)\b/i,
    /\bseparate\s+session\b/i,
    /\blight\s+work\b/i,
    // Spanish
    /\bentrenamiento\s+individual\b/i,
    /\btrabajo\s+de\s+rehabilitación\b/i,
    /\bsesión\s+al\s+margen\b/i,
    /\btrabaja\s+al\s+margen\b/i,
    // Italian
    /\blavoro\s+individuale\b/i,
    /\bseduta\s+individuale\b/i,
    /\bterapie\s+e\s+lavoro\s+in\s+palestra\b/i,
    // German
    /\bindividuelles\s+Training\b/i,
    /\bRehabilitationstraining\b/i,
    /\bLeistungsdiagnostik\b/i,
    /\bgesonderte\s+Einheit\b/i,
    // French
    /\btravail\s+individuel\b/i,
    /\bséance\s+individuelle\b/i,
    /\bréathlétisation\b/i,
  ],

  full_training: [
    // English
    /\bfull\s+(?:team\s+)?training(?:\s+session)?\b/i,
    /\btrained\s+with\s+(?:the\s+)?(?:squad|team|group)\b/i,
    /\bback\s+in\s+(?:team|squad|group|full)\s+training\b/i,
    /\bjoined\s+(?:the\s+)?(?:squad|team|group)\s+(?:in\s+)?training\b/i,
    /\bteam\s+session\b/i,
    /\breturned\s+to\s+(?:full\s+)?training\b/i,
    /\bback\s+(?:on\s+)?the\s+training\s+ground\b/i,
    /\bpart\s+of\s+(?:the\s+)?(?:full\s+)?training\b/i,
    // Spanish
    /\bha\s+(?:vuelto|regresado)\s+a\s+(?:los\s+)?entrenamientos\b/i,
    /\bentrenam?iento\s+(?:con\s+el\s+grupo|colectivo)\b/i,
    /\bse\s+ha\s+reincorporado\s+al\s+grupo\b/i,
    /\btrabaja\s+con\s+el\s+equipo\b/i,
    // Italian
    /\bha\s+(?:ripreso|tornato)\s+ad\s+allenarsi\s+(?:con\s+il\s+gruppo|in\s+gruppo)\b/i,
    /\ballenamento\s+(?:con\s+il\s+gruppo|collettivo)\b/i,
    /\btorna\s+in\s+gruppo\b/i,
    /\blavora\s+con\s+i\s+compagni\b/i,
    // German
    /\btrainiert\s+wieder\s+mit\s+(?:der\s+)?(?:Mannschaft|Gruppe|dem\s+Team)\b/i,
    /\bist\s+ins\s+Mannschaftstraining\s+zurückgekehrt\b/i,
    /\bMannschaftstraining\s+aufgenommen\b/i,
    /\bwieder\s+auf\s+dem\s+Trainingsplatz\b/i,
    // French
    /\bde\s+retour\s+à\s+l['']entraînement\s+(?:collectif|avec\s+le\s+groupe)\b/i,
    /\bs['']est\s+réentraîné\s+avec\s+le\s+groupe\b/i,
    /\ba\s+repris\s+l['']entraînement\s+collectif\b/i,
  ],

  available: [
    // English
    /\bfit\s+(?:to\s+play|enough\s+to\s+play|and\s+available)\b/i,
    /\bavailable\s+for\s+(?:selection|the\s+(?:match|game|squad|fixture))\b/i,
    /\bin\s+contention\b/i,
    /\bpassed\s+(?:a\s+)?fitness\s+test\b/i,
    /\bfit\s+for\s+(?:the\s+)?(?:weekend|match|game|fixture|squad)\b/i,
    /\bback\s+in\s+(?:the\s+)?squad\b/i,
    /\bincluded\s+in\s+(?:the\s+)?squad\b/i,
    /\bnamed\s+in\s+(?:the\s+)?(?:squad|matchday)\b/i,
    /\bready\s+to\s+(?:play|return|feature)\b/i,
    // Spanish
    /\bdisponible\s+para\s+(?:el\s+partido|la\s+convocatoria)\b/i,
    /\bconvocado\s+para\b/i,
    /\bestá\s+en\s+condiciones\b/i,
    /\bha\s+superado\s+(?:la\s+lesión|el\s+test\s+médico)\b/i,
    // Italian
    /\bdisponibile\s+per\s+(?:la\s+partita|la\s+convocazione)\b/i,
    /\bconvocato\s+per\b/i,
    /\bsuperate\s+le\s+visite\s+mediche\b/i,
    /\bha\s+recuperato\b/i,
    // German
    /\bsteht\s+zur\s+Verfügung\b/i,
    /\bim\s+Kader\s+(?:nominiert|berufen)\b/i,
    /\bist\s+wieder\s+einsatzbereit\b/i,
    /\bhat\s+(?:den\s+)?Fitnesstest\s+bestanden\b/i,
    // French
    /\bdisponible\s+pour\s+(?:le\s+match|la\s+rencontre|la\s+sélection)\b/i,
    /\bconvoqué\s+pour\b/i,
    /\bde\s+retour\s+dans\s+le\s+groupe\b/i,
    /\ba\s+passé\s+(?:avec\s+succès\s+)?la\s+visite\s+médicale\b/i,
  ],

  expected_to_start: [
    // English
    /\bexpected\s+to\s+start\b/i,
    /\bset\s+to\s+start\b/i,
    /\bwill\s+(?:likely\s+)?start\b/i,
    /\bin\s+(?:the\s+)?(?:starting\s+)?(?:XI|eleven|lineup|line-?up)\b/i,
    /\blead\s+(?:the\s+)?(?:attack|line|forward\s+line)\b/i,
    /\bconfirmed\s+(?:to\s+)?start\b/i,
    /\bset\s+to\s+(?:lead|play|feature)\b/i,
    // Spanish
    /\bse\s+espera\s+que\s+(?:sea\s+)?titular\b/i,
    /\bentrará\s+en\s+el\s+once\b/i,
    /\btitular\s+(?:indiscutible|previsto|confirmado)\b/i,
    // Italian
    /\batteso\s+(?:dal\s+primo\s+minuto|in\s+campo\s+dal\s+via)\b/i,
    /\bpartirà\s+titolare\b/i,
    /\bnell['']undici\s+(?:titolare|di\s+partenza)\b/i,
    // German
    /\bwird\s+(?:voraussichtlich\s+)?in\s+der\s+Startelf\s+stehen\b/i,
    /\bStartelf\s+(?:gesetzt|erwartet|bestätigt)\b/i,
    /\bvon\s+Anfang\s+an\s+spielen\b/i,
    // French
    /\bdevrait\s+(?:être\s+)?titulaire\b/i,
    /\bpartira\s+(?:dans\s+le\s+)?onze\s+de\s+départ\b/i,
    /\bconfirmé\s+titulaire\b/i,
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
