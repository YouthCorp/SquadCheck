import { cn } from '@/lib/utils';
import { InfoTooltip } from '@/components/ui/info-tooltip';

interface SectionHeaderProps {
  label: string;
  count?: number;
  accent?: 'default' | 'destructive' | 'success' | 'primary';
  className?: string;
  tooltip?: string;
}

const accentColor: Record<NonNullable<SectionHeaderProps['accent']>, string> = {
  default:     'border-border',
  destructive: 'border-[var(--sc-red)]',
  success:     'border-[var(--sc-green)]',
  primary:     'border-primary',
};

export function SectionHeader({ label, count, accent = 'default', className, tooltip }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center gap-3 mb-4', className)}>
      <div className={cn('w-0.5 h-5 rounded-full', accentColor[accent])} />
      <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">{label}</h2>
      {tooltip && <InfoTooltip content={tooltip} />}
      {count !== undefined && (
        <span className="text-xs font-mono text-muted-foreground ml-auto">{count}</span>
      )}
    </div>
  );
}
