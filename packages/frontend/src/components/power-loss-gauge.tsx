'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { t, type Locale } from '@/lib/i18n';

type Severity = 'low' | 'moderate' | 'high' | 'critical';
type Size = 'sm' | 'md' | 'lg';

function getSeverity(pct: number): Severity {
  if (pct < 8) return 'low';
  if (pct < 15) return 'moderate';
  if (pct < 25) return 'high';
  return 'critical';
}

const severityColor: Record<Severity, string> = {
  low:      'var(--sc-green)',
  moderate: 'var(--sc-yellow)',
  high:     'var(--sc-red)',
  critical: 'var(--sc-red)',
};

const sizeClasses: Record<Size, { num: string; label: string; wrap: string }> = {
  sm: { num: 'text-xl',   label: 'text-[0.625rem]', wrap: 'gap-0.5' },
  md: { num: 'text-3xl',  label: 'text-xs',         wrap: 'gap-1' },
  lg: { num: 'text-5xl',  label: 'text-sm',         wrap: 'gap-1.5' },
};

interface PowerLossGaugeProps {
  value: number;       // percentage, e.g. 23.4
  size?: Size;
  className?: string;
  label?: string;
  locale?: Locale;
}

export function PowerLossGauge({
  value,
  size = 'md',
  className,
  label = 'Power Loss',
  locale = 'en',
}: PowerLossGaugeProps) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const duration = 700;
    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutQuart
      const ease = 1 - Math.pow(1 - progress, 4);
      setDisplayed(value * ease);
      if (progress >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [value]);

  const severity = getSeverity(value);
  const color = severityColor[severity];
  const { num, label: labelCls, wrap } = sizeClasses[size];

  return (
    <div className={cn('flex flex-col items-center justify-center relative rounded-lg', wrap, className)}>
      <span
        className={cn('font-mono font-semibold tabular-nums leading-none', num)}
        style={{ color }}
      >
        {displayed.toFixed(1)}%
      </span>
      <span className={cn('inline-flex items-center gap-1 uppercase tracking-wider font-semibold text-muted-foreground', labelCls)}>
        {label}
        <InfoTooltip content={t(locale, 'tooltip_power_loss')} />
      </span>
    </div>
  );
}
