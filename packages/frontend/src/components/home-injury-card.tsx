import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import type { InjuryImpact } from '@/lib/types';
import { SEV_TAG, SEV_KEY } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { PowerLossGauge } from '@/components/power-loss-gauge';
import { TeamLogo } from '@/components/team-logo';

interface HomeInjuryCardProps {
  impact: InjuryImpact;
  locale: Locale;
  leagueId: number;
}

export function HomeInjuryCard({ impact, locale, leagueId }: HomeInjuryCardProps) {
  const top2 = impact.injuredPlayers.slice(0, 2);

  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20">
      {/* Team header */}
      <div className="flex items-center gap-2 min-w-0">
        <TeamLogo logo={impact.team.logo} size="md" className="shrink-0" />
        <span className="text-[0.8125rem] font-semibold text-foreground overflow-hidden text-ellipsis whitespace-nowrap min-w-0">
          {impact.team.name}
        </span>
      </div>

      {/* Power loss gauge */}
      <PowerLossGauge value={impact.powerLossPct} size="sm" className="py-1" locale={locale} />

      {/* Top 2 injured players */}
      {top2.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {top2.map((ip) => (
            <div key={ip.player.id} className="flex items-center justify-between gap-1.5">
              <span className="text-xs text-foreground/80 overflow-hidden text-ellipsis whitespace-nowrap flex-1">
                {ip.player.name}
              </span>
              <Badge variant={SEV_TAG[ip.severity] ?? 'low'} className="text-[0.625rem] shrink-0">
                {t(locale, SEV_KEY[ip.severity] ?? 'severity_low')}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* View team link */}
      <Link
        href={`/team/${impact.team.id}?league=${leagueId}`}
        className="text-xs text-primary no-underline hover:underline mt-auto"
      >
        {t(locale, 'view_team')}
      </Link>
    </div>
  );
}
