/**
 * Canonical domain constants shared across packages.
 *
 * Single source of truth for DB `reason` column semantics.
 * Both `@squadcheck/analysis` and `@squadcheck/ingestion` depend on
 * `@squadcheck/database`, so this is the safe location to avoid circular deps.
 */
import { Prisma } from '@prisma/client';

// ── Disciplinary reasons ───────────────────────────────────────────────────────

/**
 * Narrow list: disciplinary absences only.
 * Used to identify served match bans that auto-clear.
 */
export const DISCIPLINARY_REASONS = [
  'red card',
  'suspended',
  'suspension',
  'yellow card',
  'yellow cards', // ingestion uses this variant; analysis 'contains: yellow card' already matches it
] as const;

// ── Non-injury exclusion ──────────────────────────────────────────────────────

/**
 * All non-physical absence reasons to exclude from injury panels and signal pipeline.
 * Superset of DISCIPLINARY_REASONS.
 */
export const NON_INJURY_EXCLUSION_REASONS = [
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

/**
 * Per-reason matching strategy — preserves the exact mixed contains/equals
 * pattern from the original injury-resolver.ts Prisma filter.
 */
export const NON_INJURY_EXCLUSION_MATCHER: Record<string, 'contains' | 'equals'> = {
  'red card':           'contains',
  'suspended':          'equals',
  'suspension':         'equals',
  'yellow card':        'contains',
  'yellow cards':       'contains',
  'international duty': 'equals',
  'inactive':           'equals',
  'coach':              'contains',
  'loan agreement':     'equals',
  'rest':               'equals',
  'doping':             'equals',
};

/**
 * Builds the Prisma where filter that excludes non-injury absences.
 * Exact equivalent of the inlined NON_INJURY_EXCLUSION_FILTER in injury-resolver.ts.
 */
export function buildExclusionFilter(): Prisma.InjuryWhereInput {
  return {
    NOT: {
      OR: Object.entries(NON_INJURY_EXCLUSION_MATCHER).map(([reason, mode]) => ({
        reason: { [mode]: reason, mode: 'insensitive' as const },
      })),
    },
  };
}

// ── Recovery signal thresholds ────────────────────────────────────────────────

/** predictedAvailability must be >= this to move injured player → available pool */
export const AVAILABILITY_THRESHOLD = 0.7;

/** confidenceLevel must be >= this to be trusted */
export const CONFIDENCE_THRESHOLD = 0.5;
