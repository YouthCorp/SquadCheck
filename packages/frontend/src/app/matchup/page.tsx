import { fetchApi } from '@/lib/api';
import Link from 'next/link';
import { getLocale } from '@/lib/locale';
import { t } from '@/lib/i18n';
import { LEAGUE_NAMES, CURRENT_SEASON } from '@/lib/constants';
import type { InjuryImpact, Standing } from '@/lib/types';
import type { Metadata } from 'next';
import { MatchupSelector } from './matchup-selector';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Matchup Analysis',
  description: 'Compare any two European football teams head-to-head. Injury impact, Power Loss %, form, and H2H record.',
  openGraph: {
    title: 'Matchup Analysis | SquadCheck',
    description: 'Compare any two teams: injury impact, Power Loss %, form, and H2H record.',
  },
  alternates: { canonical: '/matchup' },
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface MatchupData {
  homeTeam: TeamWithStats;
  awayTeam: TeamWithStats;
  h2h: H2HFixture[];
  homeForm: FormFixture[];
  awayForm: FormFixture[];
}

interface TeamWithStats {
  id: number; name: string; logo: string | null;
  seasonStats: {
    wins: number | null; draws: number | null; losses: number | null;
    goalsFor: number | null; goalsAgainst: number | null;
    played: number | null;
  } | null;
}

interface H2HFixture {
  id: number; date: string;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  goalsHome: number | null; goalsAway: number | null;
}

interface FormFixture {
  homeTeamId: number; awayTeamId?: number;
  goalsHome: number | null; goalsAway: number | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getFormResult(f: FormFixture, teamId: number): 'W' | 'D' | 'L' {
  const scored = f.homeTeamId === teamId ? f.goalsHome : f.goalsAway;
  const conceded = f.homeTeamId === teamId ? f.goalsAway : f.goalsHome;
  if (scored == null || conceded == null) return 'D';
  if (scored > conceded) return 'W';
  if (scored < conceded) return 'L';
  return 'D';
}

function powerLossColorClass(pct: number): string {
  if (pct >= 20) return 'text-[var(--sc-red)]';
  if (pct >= 10) return 'text-[var(--sc-yellow)]';
  return 'text-[var(--sc-green)]';
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default async function MatchupPage({
  searchParams,
}: {
  searchParams: { home?: string; away?: string };
}) {
  const locale = getLocale();
  const homeId = searchParams.home ? parseInt(searchParams.home) : null;
  const awayId = searchParams.away ? parseInt(searchParams.away) : null;

  const LEAGUE_IDS = [39, 140, 135, 78, 61] as const;
  const standingResults = await Promise.all(
    LEAGUE_IDS.map((id) =>
      fetchApi<Standing>(`/api/standings?league=${id}&season=${CURRENT_SEASON}`).catch(() => null)
    )
  );

  const teamsByLeague: { leagueId: number; leagueName: string; teams: { id: number; name: string }[] }[] = [];
  LEAGUE_IDS.forEach((id, i) => {
    const standing = standingResults[i];
    if (standing?.entries?.length) {
      teamsByLeague.push({
        leagueId: id,
        leagueName: LEAGUE_NAMES[id],
        teams: standing.entries.map((e) => ({ id: e.team.id, name: e.team.name })),
      });
    }
  });

  let matchup: MatchupData | null = null;
  let homeImpact: InjuryImpact | null = null;
  let awayImpact: InjuryImpact | null = null;

  if (homeId && awayId) {
    const [mu, hi, ai] = await Promise.all([
      fetchApi<MatchupData>(`/api/analysis/matchup?home=${homeId}&away=${awayId}&season=${CURRENT_SEASON}`).catch(() => null),
      fetchApi<InjuryImpact>(`/api/analysis/injury-impact/${homeId}?season=${CURRENT_SEASON}`).catch(() => null),
      fetchApi<InjuryImpact>(`/api/analysis/injury-impact/${awayId}?season=${CURRENT_SEASON}`).catch(() => null),
    ]);
    matchup = mu;
    homeImpact = hi;
    awayImpact = ai;
  }

  return (
    <div className="max-w-[72rem] mx-auto">
      {/* Page header */}
      <div className="mb-6 pb-4 border-b border-border">
        <h1 className="text-3xl font-light text-foreground m-0 mb-1">
          {t(locale, 'nav_matchup')}
        </h1>
        <p className="text-sm text-muted-foreground m-0">
          {locale === 'ko'
            ? '두 팀의 부상 현황, 전력 손실, 폼, 맞대결 기록을 비교합니다'
            : 'Compare injury impact, Power Loss %, form and H2H record for any two teams'}
        </p>
      </div>

      {/* Team selector */}
      <MatchupSelector
        teamsByLeague={teamsByLeague}
        currentHomeId={homeId}
        currentAwayId={awayId}
        locale={locale}
      />

      {/* Comparison results */}
      {matchup && homeId && awayId && (
        <div className="mt-6 flex flex-col gap-3">
          {/* VS header */}
          <div className="bg-card border border-border rounded-lg p-4 grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
            <div className="text-2xl font-light text-foreground">{matchup.homeTeam.name}</div>
            <div className="text-xs font-semibold tracking-widest uppercase text-muted-foreground text-center">VS</div>
            <div className="text-2xl font-light text-foreground text-right">{matchup.awayTeam.name}</div>
          </div>

          {/* Injury Impact row */}
          <div className="bg-card border border-border rounded-lg p-4 grid grid-cols-[1fr_auto_1fr] gap-4 items-start">
            <InjuryColumn impact={homeImpact} align="left" locale={locale} teamId={homeId} />
            <div className="pt-0.5 text-center min-w-28">
              <div className="text-[0.6875rem] font-semibold tracking-widest uppercase text-muted-foreground">
                {locale === 'ko' ? '부상 현황' : 'Injury Status'}
              </div>
            </div>
            <InjuryColumn impact={awayImpact} align="right" locale={locale} teamId={awayId} />
          </div>

          {/* Season stats row */}
          {(matchup.homeTeam.seasonStats || matchup.awayTeam.seasonStats) && (
            <div className="bg-card border border-border rounded-lg p-4 grid grid-cols-[1fr_auto_1fr] gap-4 items-start">
              <StatsColumn stats={matchup.homeTeam.seasonStats} align="left" locale={locale} />
              <div className="pt-0.5 text-center min-w-28">
                <div className="text-[0.6875rem] font-semibold tracking-widest uppercase text-muted-foreground">
                  {locale === 'ko' ? '시즌 기록' : 'Season Record'}
                </div>
              </div>
              <StatsColumn stats={matchup.awayTeam.seasonStats} align="right" locale={locale} />
            </div>
          )}

          {/* Form row */}
          <div className="bg-card border border-border rounded-lg p-4 grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
            <div className="flex gap-1">
              {matchup.homeForm.map((f, i) => {
                const r = getFormResult(f, homeId);
                return <Badge key={i} variant={r === 'W' ? 'win' : r === 'D' ? 'draw' : 'loss'} className="w-6 h-6 p-0 text-[0.625rem] flex items-center justify-center">{r}</Badge>;
              })}
            </div>
            <div className="text-center min-w-28">
              <div className="text-[0.6875rem] font-semibold tracking-widest uppercase text-muted-foreground">
                {locale === 'ko' ? '최근 폼 (5경기)' : 'Form (last 5)'}
              </div>
            </div>
            <div className="flex gap-1 justify-end">
              {matchup.awayForm.map((f, i) => {
                const r = getFormResult(f, awayId);
                return <Badge key={i} variant={r === 'W' ? 'win' : r === 'D' ? 'draw' : 'loss'} className="w-6 h-6 p-0 text-[0.625rem] flex items-center justify-center">{r}</Badge>;
              })}
            </div>
          </div>

          {/* H2H row */}
          {matchup.h2h.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-[0.6875rem] font-semibold tracking-widest uppercase text-muted-foreground mb-3">
                {locale === 'ko' ? '맞대결 기록 (최근 10경기)' : 'Head to Head (last 10)'}
              </div>
              <H2HTable h2h={matchup.h2h} homeId={homeId} awayId={awayId} />
            </div>
          )}

          {/* Quick links */}
          <div className="flex gap-2 flex-wrap">
            <Link
              href={`/team/${homeId}`}
              className="px-4 py-2 bg-card border border-border rounded text-sm text-foreground/70 no-underline hover:text-foreground hover:bg-accent transition-colors"
            >
              {matchup.homeTeam.name} {locale === 'ko' ? '부상 리포트 →' : 'Injury Report →'}
            </Link>
            <Link
              href={`/team/${awayId}`}
              className="px-4 py-2 bg-card border border-border rounded text-sm text-foreground/70 no-underline hover:text-foreground hover:bg-accent transition-colors"
            >
              {matchup.awayTeam.name} {locale === 'ko' ? '부상 리포트 →' : 'Injury Report →'}
            </Link>
          </div>
        </div>
      )}

      {/* Prompt to select teams */}
      {(!homeId || !awayId) && (
        <div className="mt-6 bg-card border border-border rounded-lg px-6 py-12 text-center text-sm text-muted-foreground">
          {locale === 'ko'
            ? '위에서 두 팀을 선택하면 비교 분석이 표시됩니다'
            : 'Select two teams above to see the full comparison'}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function InjuryColumn({
  impact, align, locale, teamId,
}: {
  impact: InjuryImpact | null;
  align: 'left' | 'right';
  locale: string;
  teamId: number;
}) {
  const isRight = align === 'right';
  if (!impact) return <div className={cn('text-sm text-muted-foreground', isRight ? 'text-right' : 'text-left')}>—</div>;

  const out = impact.injuredPlayers.length;
  const pl = impact.powerLossPct;
  const ss = impact.severitySummary;

  return (
    <div className={cn('flex flex-col gap-1.5', isRight ? 'text-right items-end' : 'text-left items-start')}>
      <div className={cn('text-3xl font-light font-mono', powerLossColorClass(pl))}>
        {pl.toFixed(1)}%
      </div>
      <div className="text-xs text-muted-foreground">
        {locale === 'ko' ? '전력 손실' : 'Power Loss'}
      </div>
      <div className="text-sm text-foreground/70">
        {out} {locale === 'ko' ? '명 결장' : out === 1 ? 'player out' : 'players out'}
      </div>
      {ss && (ss.critical + ss.high > 0) && (
        <div className="text-xs text-[var(--sc-red)]">
          {ss.critical + ss.high} {locale === 'ko' ? '명 중요/심각' : 'critical/high'}
        </div>
      )}
      <Link
        href={`/team/${teamId}`}
        className="text-xs text-primary no-underline hover:underline mt-1"
      >
        {locale === 'ko' ? '상세 보기 →' : 'See details →'}
      </Link>
    </div>
  );
}

function StatsColumn({
  stats, align, locale,
}: {
  stats: TeamWithStats['seasonStats'];
  align: 'left' | 'right';
  locale: string;
}) {
  const isRight = align === 'right';
  if (!stats) return <div className={cn('text-sm text-muted-foreground', isRight ? 'text-right' : 'text-left')}>—</div>;

  const { wins, draws, losses, goalsFor, goalsAgainst, played } = stats;
  const pts = ((wins ?? 0) * 3) + (draws ?? 0);

  return (
    <div className={cn('flex flex-col gap-1', isRight ? 'text-right items-end' : 'text-left items-start')}>
      <div className="text-2xl font-light font-mono text-foreground">
        {pts} {locale === 'ko' ? '점' : 'pts'}
      </div>
      <div className="text-[0.8125rem] text-foreground/70">
        {played ?? 0}{locale === 'ko' ? '경기' : 'P'} &nbsp;
        {wins ?? 0}{locale === 'ko' ? '승' : 'W'} &nbsp;
        {draws ?? 0}{locale === 'ko' ? '무' : 'D'} &nbsp;
        {losses ?? 0}{locale === 'ko' ? '패' : 'L'}
      </div>
      <div className="text-[0.8125rem] text-muted-foreground">
        {goalsFor ?? 0}{locale === 'ko' ? '득' : 'GF'} / {goalsAgainst ?? 0}{locale === 'ko' ? '실' : 'GA'}
      </div>
    </div>
  );
}

function H2HTable({ h2h, homeId, awayId }: { h2h: H2HFixture[]; homeId: number; awayId: number }) {
  let homeWins = 0, draws = 0, awayWins = 0;
  for (const f of h2h) {
    const h = f.goalsHome ?? 0;
    const a = f.goalsAway ?? 0;
    const homeIsHome = f.homeTeam.id === homeId;
    if (h === a) { draws++; continue; }
    if ((homeIsHome && h > a) || (!homeIsHome && a > h)) homeWins++;
    else awayWins++;
  }

  const homeName = h2h[0]?.homeTeam.id === homeId ? h2h[0].homeTeam.name : h2h[0]?.awayTeam.name;
  const awayName = h2h[0]?.homeTeam.id === awayId ? h2h[0].homeTeam.name : h2h[0]?.awayTeam.name;

  return (
    <div>
      <div className="flex gap-6 mb-3">
        <span className="text-sm text-foreground/70">{homeName}: <strong className="text-foreground">{homeWins}W</strong></span>
        <span className="text-sm text-muted-foreground">D: <strong className="text-foreground">{draws}</strong></span>
        <span className="text-sm text-foreground/70">{awayName}: <strong className="text-foreground">{awayWins}W</strong></span>
      </div>

      <div className="flex flex-col gap-1.5">
        {h2h.slice(0, 5).map((f) => {
          const d = new Date(f.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
          return (
            <div key={f.id} className="flex gap-2 items-center text-[0.8125rem]">
              <span className="text-muted-foreground min-w-20">{d}</span>
              <span className="text-foreground/70 flex-1">
                {f.homeTeam.name} {f.goalsHome ?? '?'} – {f.goalsAway ?? '?'} {f.awayTeam.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
