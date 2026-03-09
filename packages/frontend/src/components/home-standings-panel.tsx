'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import type { Standing } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { TeamLogo } from '@/components/team-logo';

interface HomeStandingsPanelProps {
  standingsMap: Record<number, Standing | null>;
  locale: Locale;
}

const LEAGUES = [
  { id: 39,  name: 'EPL' },
  { id: 140, name: 'La Liga' },
  { id: 135, name: 'Serie A' },
  { id: 78,  name: 'BL' },
  { id: 61,  name: 'L1' },
];

export function HomeStandingsPanel({ standingsMap, locale }: HomeStandingsPanelProps) {
  const [activeLeague, setActiveLeague] = useState(39);
  const standing = standingsMap[activeLeague];
  const top8 = standing?.entries?.slice(0, 8) ?? [];

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden h-full flex flex-col">
      {/* Header + tabs */}
      <div className="px-4 py-3 border-b border-border flex justify-between items-center gap-2 flex-wrap">
        <span className="text-[0.6875rem] font-semibold tracking-wider uppercase text-muted-foreground">
          {t(locale, 'standings_preview')}
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

      {/* Table */}
      {top8.length === 0 ? (
        <div className="px-4 py-4 text-sm text-muted-foreground">{t(locale, 'no_standings')}</div>
      ) : (
        <div className="flex-1 overflow-auto">
          <Table className="text-[0.8125rem]">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="px-3 py-2 text-center text-muted-foreground font-normal w-8 text-[0.8125rem]">#</TableHead>
                <TableHead className="px-3 py-2 text-left text-muted-foreground font-normal text-[0.8125rem]">{t(locale, 'team')}</TableHead>
                <TableHead className="px-2 py-2 text-center text-muted-foreground font-normal w-8 text-[0.8125rem]">{t(locale, 'played')}</TableHead>
                <TableHead className="px-2 py-2 text-center text-muted-foreground font-normal w-10 text-[0.8125rem]">{t(locale, 'goal_diff')}</TableHead>
                <TableHead className="px-3 py-2 text-center text-muted-foreground font-normal w-10 text-[0.8125rem]">{t(locale, 'points')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {top8.map((entry, idx) => (
                <TableRow
                  key={entry.team.id}
                  className={cn(
                    'border-border hover:bg-accent/50',
                    idx % 2 === 1 ? 'bg-muted/20' : ''
                  )}
                >
                  <TableCell className="px-3 py-2 text-center text-muted-foreground font-mono">{entry.rank}</TableCell>
                  <TableCell className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <TeamLogo logo={entry.team.logo} size="xs" />
                      <span className="text-foreground whitespace-nowrap overflow-hidden text-ellipsis max-w-[9rem]">
                        {entry.team.code ?? entry.team.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-2 py-2 text-center text-foreground/80 font-mono">{entry.played}</TableCell>
                  <TableCell className={cn(
                    'px-2 py-2 text-center font-mono',
                    entry.goalsDiff > 0 ? 'text-[var(--sc-green)]' :
                    entry.goalsDiff < 0 ? 'text-[var(--sc-red)]' : 'text-foreground/80'
                  )}>
                    {entry.goalsDiff > 0 ? `+${entry.goalsDiff}` : entry.goalsDiff}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-center font-semibold text-foreground font-mono">{entry.points}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Footer link */}
      <div className="px-4 py-2.5 border-t border-border">
        <Link href={`/league/${activeLeague}`} className="text-xs text-primary no-underline hover:underline">
          {t(locale, 'view_full_standings')}
        </Link>
      </div>
    </div>
  );
}
