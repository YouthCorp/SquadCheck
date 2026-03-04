import type { TranslationKey } from './i18n';

export const SEV_TAG: Record<string, string> = {
  critical: 'sc-tag--red',
  high: 'sc-tag--orange',
  moderate: 'sc-tag--yellow',
  low: 'sc-tag--gray',
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

export const LEAGUE_NAMES: Record<number, string> = {
  39: 'Premier League',
  140: 'La Liga',
  135: 'Serie A',
  78: 'Bundesliga',
  61: 'Ligue 1',
};

export const LEAGUE_API_ID_BY_NAME: Record<string, number> = {
  'Premier League': 39, 'La Liga': 140, 'Serie A': 135,
  'Bundesliga': 78,     'Ligue 1': 61,
};


export const POS_GROUP_ORDER: Array<'GK' | 'DEF' | 'MID' | 'FWD'> = ['GK', 'DEF', 'MID', 'FWD'];
export const POS_GROUP_LABEL: Record<string, string> = { GK: 'GK', DEF: 'DEF', MID: 'MID', FWD: 'FWD' };
