import { fetchApi } from '@/lib/api';
import Link from 'next/link';
import { getLocale } from '@/lib/locale';
import { LEAGUE_NAMES, CURRENT_SEASON } from '@/lib/constants';
import type { InjurySummaryEntry, InjuryImpact } from '@/lib/types';
import type { Metadata } from 'next';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { LeaderboardSortTabs } from './leaderboard-sort-tabs';
import { TeamLogo } from '@/components/team-logo';

export const metadata: Metadata = {
  title: 'Season Injury Leaderboard',
  description: `${CURRENT_SEASON}/${CURRENT_SEASON + 1} season injury leaderboard — most injured teams and highest Power Loss % across European football.`,
  openGraph: {
    title: 'Season Injury Leaderboard | SquadCheck',
    description: 'Which teams have been hit hardest by injuries this season?',
  },
  alternates: { canonical: '/leaderboard' },
};

export const revalidate = 600;

const LEAGUE_IDS = [39, 140, 135, 78, 61] as const;

function powerLossColor(pct: number): string {
  if (pct >= 20) return 'text-[var(--sc-red)]';
  if (pct >= 10) return 'text-[var(--sc-yellow)]';
  return 'text-[var(--sc-green)]';
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: { sort?: string; league?: string };
}) {
  const locale = getLocale();
  const sortBy = (searchParams.sort === 'power') ? 'power' : 'count';
  const leagueFilter = searchParams.league ? parseInt(searchParams.league) : null;

  const leaguesToFetch = leagueFilter ? [leagueFilter as (typeof LEAGUE_IDS)[number]] : [...LEAGUE_IDS];
  const summaryResults = await Promise.all(
    leaguesToFetch.map((id) =>
      fetchApi<InjurySummaryEntry[]>(`/api/injuries/summary?league=${id}&season=${CURRENT_SEASON}`)
        .then((data) => data.map((e) => ({ ...e, leagueId: id })))
        .catch(() => [] as (InjurySummaryEntry & { leagueId: number })[])
    )
  );

  const allEntries = summaryResults.flat().filter(
    (e) => e.team != null && e.injuryCount > 0
  ) as ((InjurySummaryEntry & { leagueId: number }) & { team: NonNullable<InjurySummaryEntry['team']> })[];

  const uniqueByTeam = new Map<number, typeof allEntries[0]>();
  for (const e of allEntries) {
    const existing = uniqueByTeam.get(e.team.id);
    if (!existing || e.injuryCount > existing.injuryCount) {
      uniqueByTeam.set(e.team.id, e);
    }
  }

  const sortedByCount = Array.from(uniqueByTeam.values())
    .sort((a, b) => b.injuryCount - a.injuryCount)
    .slice(0, 20);

  const impactResults = await Promise.all(
    sortedByCount.map((e) =>
      fetchApi<InjuryImpact>(`/api/analysis/injury-impact/${e.team.id}?season=${CURRENT_SEASON}`)
        .catch(() => null)
    )
  );

  const records = sortedByCount.map((e, i) => ({
    team: e.team,
    leagueId: e.leagueId,
    seasonAbsences: e.injuryCount,
    currentOut: impactResults[i]?.injuredPlayers.length ?? 0,
    impact: impactResults[i],
    powerLossPct: impactResults[i]?.powerLossPct ?? 0,
    topPlayers: impactResults[i]?.injuredPlayers
      .filter((p) => p.severity === 'critical' || p.severity === 'high')
      .slice(0, 2)
      .map((p) => p.player.name) ?? [],
  }));

  const sorted = [...records].sort((a, b) =>
    sortBy === 'power' ? b.powerLossPct - a.powerLossPct : b.currentOut - a.currentOut
  );

  return (
    <div className="max-w-[72rem] mx-auto">
      {/* Header */}
      <div className="mb-6 pb-4 border-b border-border">
        <h1 className="text-3xl font-light text-foreground m-0 mb-1">
          {locale === 'ko' ? '시즌 부상 리더보드' : 'Season Injury Leaderboard'}
        </h1>
        <p className="text-sm text-muted-foreground m-0">
          {CURRENT_SEASON}/{CURRENT_SEASON + 1} · {locale === 'ko' ? '이번 시즌 부상 타격 순위' : 'Teams hit hardest by injuries this season'}
        </p>
      </div>

      {/* Sort + league filter */}
      <div className="flex gap-3 flex-wrap items-center mb-6">
        {/* Sort tabs (client component) */}
        <LeaderboardSortTabs
          sortBy={sortBy}
          leagueFilter={leagueFilter}
          countLabel={locale === 'ko' ? '결장 선수 수' : 'Players Out'}
          powerLabel={locale === 'ko' ? '전력 손실 %' : 'Power Loss %'}
        />

        {/* League filter */}
        <div className="flex flex-wrap gap-1">
          <Link
            href={`/leaderboard?sort=${sortBy}`}
            className={cn(
              'px-2.5 py-1 text-xs border rounded no-underline transition-colors',
              !leagueFilter
                ? 'border-primary bg-primary/15 text-primary font-semibold'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
          >
            {locale === 'ko' ? '전체' : 'All'}
          </Link>
          {LEAGUE_IDS.map((id) => (
            <Link
              key={id}
              href={`/leaderboard?sort=${sortBy}&league=${id}`}
              className={cn(
                'px-2.5 py-1 text-xs border rounded no-underline transition-colors',
                leagueFilter === id
                  ? 'border-primary bg-primary/15 text-primary font-semibold'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              {LEAGUE_NAMES[id]}
            </Link>
          ))}
        </div>
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground items-center justify-center">
          {locale === 'ko' ? '데이터 없음' : 'No data available'}
        </Card>
      ) : (
        <Card className="p-0 gap-0">
          {/* Table header */}
          <div className="grid grid-cols-[2rem_1fr_4rem_5rem] md:grid-cols-[2.5rem_1fr_5rem_6rem_1fr] gap-2 px-4 py-2.5 border-b border-border bg-muted/30 items-center">
            <span className="text-[0.6875rem] font-semibold tracking-wider uppercase text-muted-foreground">#</span>
            <span className="text-[0.6875rem] font-semibold tracking-wider uppercase text-muted-foreground">
              {locale === 'ko' ? '팀' : 'Team'}
            </span>
            <span className="text-[0.6875rem] font-semibold tracking-wider uppercase text-muted-foreground text-center">
              {locale === 'ko' ? '결장' : 'Out'}
            </span>
            <span className="text-[0.6875rem] font-semibold tracking-wider uppercase text-muted-foreground text-right">
              {locale === 'ko' ? '전력 손실' : 'Loss%'}
            </span>
            <span className="hidden md:block text-[0.6875rem] font-semibold tracking-wider uppercase text-muted-foreground">
              {locale === 'ko' ? '주요 결장자' : 'Key Absentees'}
            </span>
          </div>

          {sorted.map((r, idx) => (
            <Link
              key={r.team.id}
              href={`/team/${r.team.id}`}
              className="no-underline block hover:bg-accent transition-colors"
            >
              <div className={cn(
                'grid grid-cols-[2rem_1fr_4rem_5rem] md:grid-cols-[2.5rem_1fr_5rem_6rem_1fr] gap-2 px-4 py-3 items-center',
                idx < sorted.length - 1 ? 'border-b border-border' : ''
              )}>
                {/* Rank */}
                <span className={cn(
                  'text-sm font-light font-mono',
                  idx < 3 ? 'text-foreground font-bold' : 'text-muted-foreground'
                )}>
                  {idx + 1}
                </span>

                {/* Team */}
                <div className="flex items-center gap-2 min-w-0">
                  <TeamLogo logo={r.team.logo} size="sm" className="shrink-0 hidden sm:block" />
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[0.8125rem] md:text-[0.9375rem] text-foreground truncate">{r.team.name}</span>
                    <span className="text-[0.6875rem] text-muted-foreground truncate">
                      {LEAGUE_NAMES[r.leagueId as keyof typeof LEAGUE_NAMES]}
                    </span>
                  </div>
                </div>

                {/* Out count */}
                <div className="text-center">
                  <span className={cn(
                    'text-lg md:text-xl font-light font-mono',
                    r.currentOut >= 5 ? 'text-[var(--sc-red)]' :
                    r.currentOut >= 3 ? 'text-[var(--sc-yellow)]' : 'text-foreground'
                  )}>
                    {r.currentOut}
                  </span>
                </div>

                {/* Power Loss */}
                <div className="text-right">
                  {r.powerLossPct > 0 ? (
                    <span className={cn('text-sm md:text-base font-light font-mono', powerLossColor(r.powerLossPct))}>
                      −{r.powerLossPct.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>

                {/* Key absentees — desktop only */}
                <div className="hidden md:block text-xs text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                  {r.topPlayers.length > 0
                    ? r.topPlayers.join(', ')
                    : r.impact?.injuredPlayers.slice(0, 2).map((p) => p.player.name).join(', ') ?? '—'}
                </div>
              </div>
            </Link>
          ))}
        </Card>
      )}

      {/* Season note */}
      <div className="mt-4 text-[0.6875rem] text-muted-foreground">
        {locale === 'ko'
          ? `* ${CURRENT_SEASON}/${CURRENT_SEASON + 1} 시즌 5대 리그 기준. 5분마다 업데이트.`
          : `* ${CURRENT_SEASON}/${CURRENT_SEASON + 1} season, 5 major leagues. Updates every 5 minutes.`}
      </div>
    </div>
  );
}
