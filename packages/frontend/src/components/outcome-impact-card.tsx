import { t, type Locale } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TeamOutcomeImpact } from '@/lib/types';

interface OutcomeImpactCardProps {
  outcome: TeamOutcomeImpact;
  locale: Locale;
  size?: 'lg' | 'sm';
}

const CONF_VARIANT: Record<string, 'success' | 'moderate' | 'low'> = {
  high: 'success',
  medium: 'moderate',
  low: 'low',
};
const CONF_KEY: Record<string, string> = {
  high: 'outcome_confidence_high',
  medium: 'outcome_confidence_medium',
  low: 'outcome_confidence_low',
};

function fmtDelta(val: number | null, suffix = '', forceSign = true): string {
  if (val === null) return '—';
  const sign = forceSign && val > 0 ? '+' : '';
  return `${sign}${val.toFixed(2)}${suffix}`;
}

function fmtPctDelta(val: number, forceSign = true): string {
  const sign = forceSign && val > 0 ? '+' : '';
  return `${sign}${val.toFixed(1)}%`;
}

function deltaColor(val: number | null, invertSign = false): string {
  if (val === null || Math.abs(val) < 0.05) return 'text-muted-foreground';
  const effective = invertSign ? -val : val;
  if (effective <= -0.3 || effective <= -5) return 'text-[var(--sc-red)]';
  if (effective <= -0.1 || effective <= -2) return 'text-[var(--sc-orange)]';
  return 'text-muted-foreground';
}

export function OutcomeImpactCard({ outcome, locale, size = 'lg' }: OutcomeImpactCardProps) {
  const isLg = size === 'lg';
  const { baseline, depleted, impact, confidence, injuredStarterCount } = outcome;

  const metrics = [
    {
      label: t(locale, 'outcome_xg'),
      delta: impact.xgDelta,
      baseline: baseline.xgPerMatch,
      depleted: depleted.estimatedXg,
      format: (v: number) => v.toFixed(2),
      colorClass: deltaColor(impact.xgDelta),
      deltaStr: fmtDelta(impact.xgDelta),
    },
    {
      label: t(locale, 'outcome_xga'),
      delta: impact.xgaDelta,
      baseline: baseline.xgaPerMatch,
      depleted: depleted.estimatedXga,
      format: (v: number) => v.toFixed(2),
      // xGA: positive delta = MORE goals conceded = bad (invertSign for color threshold)
      colorClass: deltaColor(impact.xgaDelta, true),
      deltaStr: fmtDelta(impact.xgaDelta),
    },
    {
      label: t(locale, 'outcome_win_rate'),
      delta: impact.winRateDelta,
      baseline: baseline.winRate,
      depleted: depleted.estimatedWinRate,
      format: (v: number) => `${v.toFixed(1)}%`,
      colorClass: deltaColor(impact.winRateDelta),
      deltaStr: fmtPctDelta(impact.winRateDelta),
    },
  ];

  return (
    <div className={cn(
      'rounded-lg border border-border bg-card',
      isLg ? 'p-4' : 'p-3',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className={cn('font-semibold text-foreground', isLg ? 'text-sm' : 'text-xs')}>
          {t(locale, 'outcome_impact')}
        </h3>
        <Badge variant={CONF_VARIANT[confidence] ?? 'low'}>
          {t(locale, CONF_KEY[confidence] as any)}
        </Badge>
      </div>

      {/* 3-column metrics */}
      <div className="grid grid-cols-3 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="text-center">
            <div className={cn('text-muted-foreground', isLg ? 'text-xs' : 'text-[0.625rem]')}>
              {m.label}
            </div>
            <div className={cn('font-bold', m.colorClass, isLg ? 'text-xl' : 'text-base')}>
              {m.deltaStr}
            </div>
            <div className={cn('text-muted-foreground font-mono', isLg ? 'text-[0.6875rem]' : 'text-[0.625rem]')}>
              {m.format(m.baseline)}
              <span className="mx-1">→</span>
              {m.format(m.depleted)}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      {injuredStarterCount > 0 && (
        <div className={cn('text-muted-foreground mt-2', isLg ? 'text-xs' : 'text-[0.625rem]')}>
          {t(locale, 'outcome_injured_starters', { n: injuredStarterCount })}
        </div>
      )}
    </div>
  );
}
