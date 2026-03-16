import type { TranslationKey } from './i18n';

/** Maps severity key → shadcn Badge variant */
export const SEV_TAG: Record<string, 'critical' | 'high' | 'moderate' | 'low'> = {
  critical: 'critical',
  high: 'high',
  moderate: 'moderate',
  low: 'low',
};

export const SEV_KEY: Record<string, TranslationKey> = {
  critical: 'severity_critical',
  high: 'severity_high',
  moderate: 'severity_moderate',
  low: 'severity_low',
};

export const ROLE_KEY: Record<string, TranslationKey> = {
  regular_starter: 'role_starter',
  rotation: 'role_rotation',
  bench: 'role_bench',
};

export const CTX_KEY: Record<string, TranslationKey> = {
  mid_season_loss: 'ctx_mid_season_loss',
  extended_absence: 'ctx_extended_absence',
  recent_injury: 'ctx_recent_injury',
  early_season_loss: 'ctx_early_season_loss',
  pre_season_absence: 'ctx_pre_season_absence',
};

/** Current active season year (start year of the season, e.g. 2025 = 2025/26). Update when new season is seeded. */
export const CURRENT_SEASON = 2025;

export const LEAGUE_NAMES: Record<number, string> = {
  39: 'Premier League',
  140: 'La Liga',
  135: 'Serie A',
  78: 'Bundesliga',
  61: 'Ligue 1',
  // European cups
  2: 'Champions League',
  3: 'Europa League',
  848: 'Conference League',
  // Domestic cups
  45: 'FA Cup',
  48: 'EFL Cup',
  143: 'Copa del Rey',
  137: 'Coppa Italia',
  81: 'DFB-Pokal',
};

/** Short competition labels used in disciplinary absence badges. */
export const LEAGUE_SHORT_NAMES: Record<number, string> = {
  39: 'PL', 140: 'La Liga', 135: 'Serie A', 78: 'Bundesliga', 61: 'Ligue 1',
  2: 'UCL', 3: 'UEL', 848: 'UECL',
  45: 'FA Cup', 48: 'EFL Cup', 143: 'Copa del Rey', 137: 'Coppa Italia', 81: 'DFB-Pokal',
};

/** All league names → apiFootballId (covers all seeded leagues including cups). */
export const LEAGUE_API_ID_BY_NAME: Record<string, number> = Object.fromEntries(
  Object.entries(LEAGUE_NAMES).map(([id, name]) => [name, parseInt(id)])
);

/** Cup competitions that have a league-phase standings table (UCL/UEL/Conference new format). */
export const CUP_HAS_STANDINGS = new Set([2, 3, 848]);

/** All cup competition IDs (no standings = knockout-only). */
export const CUP_IDS_NO_STANDINGS = new Set([45, 48, 143, 137, 81]);


export const POS_GROUP_ORDER: Array<'GK' | 'DEF' | 'MID' | 'FWD'> = ['GK', 'DEF', 'MID', 'FWD'];
export const POS_GROUP_LABEL: Record<string, string> = { GK: 'GK', DEF: 'DEF', MID: 'MID', FWD: 'FWD' };
