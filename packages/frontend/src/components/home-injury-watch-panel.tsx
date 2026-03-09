'use client';

import { useState } from 'react';
import type { Locale } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import type { InjuryImpact } from '@/lib/types';
import { HomeInjuryCard } from './home-injury-card';
import { cn } from '@/lib/utils';

interface HomeInjuryWatchPanelProps {
  injuryMap: Record<number, InjuryImpact[]>;
  locale: Locale;
}

const LEAGUES = [
  { id: 39,  name: 'EPL' },
  { id: 140, name: 'La Liga' },
  { id: 135, name: 'Serie A' },
  { id: 78,  name: 'BL' },
  { id: 61,  name: 'L1' },
];

export function HomeInjuryWatchPanel({ injuryMap, locale }: HomeInjuryWatchPanelProps) {
  const [activeLeague, setActiveLeague] = useState(39);
  const impacts = injuryMap[activeLeague] ?? [];

  return (
    <div className="mb-8">
      {/* Section header */}
      <div className="mb-3 flex justify-between items-center flex-wrap gap-2">
        <span className="text-[0.6875rem] font-semibold tracking-wider uppercase text-muted-foreground">
          {t(locale, 'injury_watch')}
        </span>
        <div className="flex gap-1">
          {LEAGUES.map((lg) => (
            <button
              key={lg.id}
              onClick={() => setActiveLeague(lg.id)}
              className={cn(
                'px-2 py-1 text-[0.6875rem] rounded border cursor-pointer transition-all duration-100',
                activeLeague === lg.id
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              {lg.name}
            </button>
          ))}
        </div>
      </div>

      {impacts.length === 0 ? (
        <div className="p-6 bg-card border border-border rounded-lg text-sm text-muted-foreground">
          {t(locale, 'no_injuries')}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {impacts.slice(0, 4).map((impact) => (
            <HomeInjuryCard key={impact.team.id} impact={impact} locale={locale} leagueId={activeLeague} />
          ))}
        </div>
      )}
    </div>
  );
}
