'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import type { FixtureWithLeague } from '@/lib/types';
import { LEAGUE_API_ID_BY_NAME } from '@/lib/constants';
import { TeamLogo } from '@/components/team-logo';

interface HomeFixturesListProps {
  fixtures: FixtureWithLeague[];
  locale: Locale;
}

function formatDate(dateStr: string, locale: Locale): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-GB', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function HomeFixturesList({ fixtures, locale }: HomeFixturesListProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex justify-between items-center">
        <span className="text-[0.6875rem] font-semibold tracking-wider uppercase text-muted-foreground">
          {t(locale, 'upcoming_fixtures')}
        </span>
        <Link href="/league/39/fixtures" className="text-xs text-primary no-underline hover:underline">
          {t(locale, 'view_all_fixtures')}
        </Link>
      </div>

      {fixtures.length === 0 ? (
        <div className="px-4 py-6 text-sm text-muted-foreground">{t(locale, 'no_fixtures')}</div>
      ) : (
        <div className="flex-1 overflow-auto">
          {fixtures.map((fix) => {
            const leagueName = fix.league?.name ?? '';
            const apiId = LEAGUE_API_ID_BY_NAME[leagueName];
            const href = apiId ? `/league/${apiId}/fixtures/${fix.id}` : '#';

            return (
              <Link key={fix.id} href={href} className="no-underline block">
                <div className="px-4 py-2.5 border-b border-border grid grid-cols-[1fr_auto] gap-2 items-center transition-all duration-200 hover:-translate-y-0 hover:bg-accent cursor-pointer">
                  {/* Teams */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <TeamLogo logo={fix.homeTeam.logo} size="xs" />
                    <span className="text-[0.8125rem] text-foreground whitespace-nowrap overflow-hidden text-ellipsis max-w-[7rem]">
                      {fix.homeTeam.name}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">vs</span>
                    <TeamLogo logo={fix.awayTeam.logo} size="xs" />
                    <span className="text-[0.8125rem] text-foreground whitespace-nowrap overflow-hidden text-ellipsis max-w-[7rem]">
                      {fix.awayTeam.name}
                    </span>
                  </div>

                  {/* Date — client-side for local timezone */}
                  <span
                    suppressHydrationWarning
                    className="text-xs text-muted-foreground whitespace-nowrap shrink-0 font-mono"
                  >
                    {mounted ? formatDate(fix.date, locale) : ''}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
