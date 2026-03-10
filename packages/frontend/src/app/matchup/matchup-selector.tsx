'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface TeamGroup {
  leagueId: number;
  leagueName: string;
  teams: { id: number; name: string }[];
}

interface MatchupSelectorProps {
  teamsByLeague: TeamGroup[];
  currentHomeId: number | null;
  currentAwayId: number | null;
  locale: string;
}

export function MatchupSelector({
  teamsByLeague,
  currentHomeId,
  currentAwayId,
  locale,
}: MatchupSelectorProps) {
  const router = useRouter();
  const [homeId, setHomeId] = useState<string>(currentHomeId?.toString() ?? '');
  const [awayId, setAwayId] = useState<string>(currentAwayId?.toString() ?? '');

  function handleCompare() {
    if (homeId && awayId) {
      router.push(`/matchup?home=${homeId}&away=${awayId}`);
    }
  }

  function swapTeams() {
    const tmp = homeId;
    setHomeId(awayId);
    setAwayId(tmp);
  }

  const canCompare = !!(homeId && awayId && homeId !== awayId);

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="grid grid-cols-[1fr_auto_1fr] sm:grid-cols-[1fr_auto_1fr_auto] gap-3 items-end">
        {/* Home team */}
        <div>
          <label className="text-[0.6875rem] font-semibold tracking-widest uppercase text-muted-foreground mb-1.5 block">
            {locale === 'ko' ? '홈 팀' : 'Home Team'}
          </label>
          <div className="relative">
            <select
              value={homeId}
              onChange={(e) => setHomeId(e.target.value)}
              className="w-full px-3 py-2.5 bg-background border border-border rounded text-sm text-foreground appearance-none cursor-pointer outline-none focus:border-primary transition-colors pr-8"
            >
              <option value="">{locale === 'ko' ? '팀 선택…' : 'Select a team…'}</option>
              {teamsByLeague.map((group) => (
                <optgroup key={group.leagueId} label={group.leagueName}>
                  {group.teams.map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground text-xs">▾</div>
          </div>
        </div>

        {/* Swap button */}
        <button
          onClick={swapTeams}
          title={locale === 'ko' ? '팀 교체' : 'Swap teams'}
          className="px-3 py-2.5 bg-muted border border-border rounded text-foreground/70 hover:text-foreground hover:bg-accent transition-colors cursor-pointer text-base"
        >
          ⇄
        </button>

        {/* Away team */}
        <div>
          <label className="text-[0.6875rem] font-semibold tracking-widest uppercase text-muted-foreground mb-1.5 block">
            {locale === 'ko' ? '원정 팀' : 'Away Team'}
          </label>
          <div className="relative">
            <select
              value={awayId}
              onChange={(e) => setAwayId(e.target.value)}
              className="w-full px-3 py-2.5 bg-background border border-border rounded text-sm text-foreground appearance-none cursor-pointer outline-none focus:border-primary transition-colors pr-8"
            >
              <option value="">{locale === 'ko' ? '팀 선택…' : 'Select a team…'}</option>
              {teamsByLeague.map((group) => (
                <optgroup key={group.leagueId} label={group.leagueName}>
                  {group.teams.map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground text-xs">▾</div>
          </div>
        </div>

        {/* Compare button — full width on mobile, auto on sm+ */}
        <button
          onClick={handleCompare}
          disabled={!canCompare}
          className={cn(
            'col-span-3 sm:col-span-1 px-5 py-2.5 text-sm font-semibold rounded transition-colors whitespace-nowrap',
            canCompare
              ? 'bg-primary text-white cursor-pointer hover:bg-primary/90'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
        >
          {locale === 'ko' ? '비교하기' : 'Compare'}
        </button>
      </div>

      {homeId && awayId && homeId === awayId && (
        <div className="mt-2 text-xs text-[var(--sc-yellow)]">
          {locale === 'ko' ? '같은 팀을 선택했습니다' : 'Please select two different teams'}
        </div>
      )}
    </div>
  );
}
