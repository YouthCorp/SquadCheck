import { cn } from '@/lib/utils';

type Severity = 'critical' | 'high' | 'moderate' | 'low' | 'neutral';

const severityColor: Record<Severity, string> = {
  critical: 'text-[var(--sc-red)]',
  high:     'text-[var(--sc-red)]',
  moderate: 'text-[var(--sc-yellow)]',
  low:      'text-muted-foreground',
  neutral:  'text-foreground',
};

interface StatCardProps {
  label: string;
  value: string | number;
  severity?: Severity;
  subtext?: string;
  className?: string;
}

export function StatCard({ label, value, severity = 'neutral', subtext, className }: StatCardProps) {
  return (
    <div className={cn('bg-card border border-border rounded-lg p-4', className)}>
      <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </div>
      <div className={cn('text-2xl font-mono font-semibold tabular-nums', severityColor[severity])}>
        {value}
      </div>
      {subtext && (
        <div className="text-xs text-muted-foreground mt-0.5">{subtext}</div>
      )}
    </div>
  );
}
