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

function fmtDelta(val: number | null, forceSign = true): string {
  if (val === null) return '—';
  const sign = forceSign && val > 0 ? '+' : '';
  return `${sign}${val.toFixed(2)}`;
}

// xG: positive = good (green), negative = bad (red)
function xgColor(val: number | null): string {
  if (val === null || Math.abs(val) < 0.05) return 'text-muted-foreground';
  return val > 0 ? 'text-[var(--sc-green)]' : 'text-[var(--sc-red)]';
}

// xGA: positive = bad (red), negative = good (green)
function xgaColor(val: number | null): string {
  if (val === null || Math.abs(val) < 0.05) return 'text-muted-foreground';
  return val > 0 ? 'text-[var(--sc-red)]' : 'text-[var(--sc-green)]';
}

export function OutcomeImpactCard({ outcome, locale, size = 'lg' }: OutcomeImpactCardProps) {
  const isLg = size === 'lg';
  const { baseline, depleted, impact, confidence, injuredStarterCount } = outcome;

  const metrics = [
    {
      label: t(locale, 'outcome_xg'),
      baseline: baseline.xgPerMatch,
      depleted: depleted.estimatedXg,
      deltaStr: fmtDelta(impact.xgDelta),
      colorClass: xgColor(impact.xgDelta),
    },
    {
      label: t(locale, 'outcome_xga'),
      baseline: baseline.xgaPerMatch,
      depleted: depleted.estimatedXga,
      deltaStr: fmtDelta(impact.xgaDelta),
      colorClass: xgaColor(impact.xgaDelta),
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

      {/* 2-column metrics */}
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="text-center">
            <div className={cn('text-muted-foreground mb-1', isLg ? 'text-xs' : 'text-[0.625rem]')}>
              {m.label}
            </div>
            {/* Values: baseline → depleted */}
            <div className={cn('font-bold tabular-nums', isLg ? 'text-base' : 'text-sm')}>
              {m.baseline.toFixed(2)}
              <span className="mx-1 text-muted-foreground/50 font-normal">→</span>
              {m.depleted.toFixed(2)}
            </div>
            {/* Delta below, smaller */}
            <div className={cn('font-medium tabular-nums', m.colorClass, isLg ? 'text-sm' : 'text-xs')}>
              {m.deltaStr}
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
