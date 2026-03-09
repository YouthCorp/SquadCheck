import { fetchApi } from '@/lib/api';
import Link from 'next/link';
import { getLocale } from '@/lib/locale';
import { t } from '@/lib/i18n';
import { LEAGUE_NAMES, CUP_IDS_NO_STANDINGS } from '@/lib/constants';
import type { Metadata } from 'next';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { TeamLogo } from '@/components/team-logo';

export async function generateMetadata({
  params,
}: {
  params: { leagueId: string };
}): Promise<Metadata> {
  const leagueId = parseInt(params.leagueId);
  const leagueName = LEAGUE_NAMES[leagueId] ?? `League ${leagueId}`;
  const isCup = CUP_IDS_NO_STANDINGS.has(leagueId);
  const title = isCup ? leagueName : `${leagueName} Standings`;
  const description = isCup
    ? `${leagueName} fixtures and results with injury impact analysis.`
    : `${leagueName} standings with injury-aware team power analysis. See Power Loss % for every club this season.`;
  return {
    title,
    description,
    openGraph: { title: `${title} | SquadCheck`, description },
    alternates: { canonical: `/league/${leagueId}` },
  };
}

interface StandingEntry {
  rank: number; points: number; played: number; wins: number; draws: number; losses: number;
  goalsFor: number; goalsAgainst: number; goalsDiff: number; form: string | null;
  team: { id: number; name: string; logo: string | null; code: string | null };
}
interface Standing { id: number; entries: StandingEntry[]; }

/** EPL zone rows: top 4 = CL, 5 = UEL, 6 = UECL, bottom 3 = relegation */
function getZone(rank: number, total: number): 'cl' | 'uel' | 'uecl' | 'relegation' | null {
  if (rank <= 4) return 'cl';
  if (rank === 5) return 'uel';
  if (rank === 6) return 'uecl';
  if (rank > total - 3) return 'relegation';
  return null;
}

export default async function LeaguePage({ params }: { params: { leagueId: string } }) {
  const leagueId = parseInt(params.leagueId);
  const locale = getLocale();

  let standing: Standing | null = null;
  try { standing = await fetchApi<Standing>(`/api/standings?league=${leagueId}`); } catch {}

  const total = standing?.entries.length ?? 0;

  return (
    <div className="max-w-[72rem] mx-auto">
      {/* Page header */}
      <div className="mb-6 pb-4 border-b border-border">
        <p className="text-[0.6875rem] font-semibold tracking-wider uppercase text-muted-foreground mb-1">
          {t(locale, 'nav_leagues')}
        </p>
        <h1 className="text-3xl font-light text-foreground m-0">
          {LEAGUE_NAMES[leagueId] ?? `League ${leagueId}`}
        </h1>
      </div>

      {CUP_IDS_NO_STANDINGS.has(leagueId) ? (
        /* Knockout cup — no standings by design */
        <Card className="items-center text-center py-10 px-6">
          <span className="text-4xl">🏆</span>
          <p className="text-[0.9375rem] text-foreground/70 m-0">
            {t(locale, 'cup_knockout_notice')}
          </p>
          <Link
            href={`/league/${leagueId}/fixtures`}
            className="text-[0.9375rem] font-medium text-primary no-underline hover:underline"
          >
            {t(locale, 'cup_view_fixtures')}
          </Link>
        </Card>
      ) : standing?.entries ? (
        <Card className="p-0 gap-0">
          <Table className="text-[0.8125rem]">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {[
                  { label: '#', align: 'center' as const },
                  { label: t(locale, 'team'), align: 'left' as const, minW: true },
                  { label: t(locale, 'played'), align: 'center' as const },
                  { label: t(locale, 'wins'), align: 'center' as const },
                  { label: t(locale, 'draws'), align: 'center' as const },
                  { label: t(locale, 'losses'), align: 'center' as const },
                  { label: t(locale, 'goals_for'), align: 'center' as const },
                  { label: t(locale, 'goals_against'), align: 'center' as const },
                  { label: t(locale, 'goal_diff'), align: 'center' as const },
                  { label: t(locale, 'points'), align: 'center' as const },
                  { label: t(locale, 'form'), align: 'center' as const },
                ].map((h) => (
                  <TableHead
                    key={h.label}
                    className={cn(
                      'py-2.5 text-[0.6875rem] font-semibold tracking-wider uppercase text-muted-foreground border-b border-border',
                      h.align === 'center' ? 'px-3 text-center' : 'px-4 text-left',
                      h.minW ? 'min-w-[10rem]' : ''
                    )}
                  >
                    {h.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {standing.entries.map((entry, idx) => {
                const zone = getZone(entry.rank, total);
                return (
                  <TableRow
                    key={entry.team.id}
                    className={cn(
                      'border-border hover:bg-accent/50',
                      idx % 2 === 1 ? 'bg-muted/20' : ''
                    )}
                  >
                    <TableCell className={cn(
                      'px-3 py-2.5 text-center font-mono font-semibold text-[0.8125rem] relative',
                      zone === 'cl' ? 'text-[var(--sc-blue)]' :
                      zone === 'uel' ? 'text-[var(--sc-orange)]' :
                      zone === 'uecl' ? 'text-[var(--sc-green)]' :
                      zone === 'relegation' ? 'text-[var(--sc-red)]' :
                      'text-muted-foreground'
                    )}>
                      {zone && (
                        <span
                          className={cn(
                            'absolute left-0 top-0 bottom-0 w-0.5',
                            zone === 'cl' ? 'bg-[var(--sc-blue)]' :
                            zone === 'uel' ? 'bg-[var(--sc-orange)]' :
                            zone === 'uecl' ? 'bg-[var(--sc-green)]' :
                            'bg-[var(--sc-red)]'
                          )}
                        />
                      )}
                      {entry.rank}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <Link
                        href={`/team/${entry.team.id}?league=${leagueId}`}
                        className="no-underline flex items-center gap-2.5"
                      >
                        <TeamLogo logo={entry.team.logo} size="sm" />
                        <span className="text-sm font-medium text-foreground">
                          {entry.team.name}
                        </span>
                      </Link>
                    </TableCell>
                    {[entry.played, entry.wins, entry.draws, entry.losses, entry.goalsFor, entry.goalsAgainst].map((v, i) => (
                      <TableCell key={i} className="px-3 py-2.5 text-center text-foreground/80 font-mono">
                        {v}
                      </TableCell>
                    ))}
                    <TableCell className="px-3 py-2.5 text-center font-mono font-semibold">
                      <span className={
                        entry.goalsDiff > 0 ? 'text-[var(--sc-green)]' :
                        entry.goalsDiff < 0 ? 'text-[var(--sc-red)]' : 'text-foreground/80'
                      }>
                        {entry.goalsDiff > 0 ? '+' : ''}{entry.goalsDiff}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-center font-mono font-bold text-foreground">
                      {entry.points}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-center">
                      {entry.form && (
                        <div className="flex gap-0.5 justify-center">
                          {entry.form.split('').map((c, i) => (
                            <Badge
                              key={i}
                              variant={c === 'W' ? 'win' : c === 'D' ? 'draw' : 'loss'}
                              className="w-[1.125rem] h-[1.125rem] p-0 text-[0.5rem] flex items-center justify-center rounded-sm"
                            >
                              {c}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="p-8 text-center text-sm text-muted-foreground items-center justify-center">
          {t(locale, 'no_standings')}
        </Card>
      )}
    </div>
  );
}
