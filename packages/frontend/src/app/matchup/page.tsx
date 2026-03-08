import { fetchApi } from '@/lib/api';
import Link from 'next/link';
import { getLocale } from '@/lib/locale';
import { t } from '@/lib/i18n';
import { LEAGUE_NAMES, CURRENT_SEASON } from '@/lib/constants';
import type { InjuryImpact, Standing } from '@/lib/types';
import type { Metadata } from 'next';
import { MatchupSelector } from './matchup-selector';

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

function FormPip({ result }: { result: 'W' | 'D' | 'L' }) {
  const colors = { W: '#42be65', D: '#8d8d8d', L: '#fa4d56' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: '1.5rem', height: '1.5rem',
      background: colors[result],
      borderRadius: 1,
      fontSize: '0.6875rem', fontWeight: 600, color: '#fff',
    }}>
      {result}
    </span>
  );
}

function powerLossColor(pct: number): string {
  if (pct >= 20) return '#fa4d56';
  if (pct >= 10) return '#f1c21b';
  return '#42be65';
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

  // Always fetch standings for team selector
  const LEAGUE_IDS = [39, 140, 135, 78, 61] as const;
  const standingResults = await Promise.all(
    LEAGUE_IDS.map((id) =>
      fetchApi<Standing>(`/api/standings?league=${id}&season=${CURRENT_SEASON}`).catch(() => null)
    )
  );

  // Build team list grouped by league
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

  // If both teams selected, fetch matchup + injury data
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

  const tile: React.CSSProperties = {
    background: 'var(--cds-layer-01, #262626)',
    border: '1px solid var(--cds-border-subtle-01, #393939)',
    padding: '1.25rem 1rem',
  };

  return (
    <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '0 1rem' }}>
      {/* Page header */}
      <div style={{ padding: '1.5rem 0 1rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 300, color: 'var(--cds-text-primary, #f4f4f4)', margin: '0 0 0.25rem' }}>
          {t(locale, 'nav_matchup')}
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--cds-text-helper, #8d8d8d)', margin: 0 }}>
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
        <div style={{ marginTop: '1.5rem' }}>
          {/* VS header */}
          <div style={{ ...tile, marginBottom: '1px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '1rem', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 300, color: 'var(--cds-text-primary, #f4f4f4)' }}>
                {matchup.homeTeam.name}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--cds-text-helper, #8d8d8d)' }}>
                VS
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 300, color: 'var(--cds-text-primary, #f4f4f4)' }}>
                {matchup.awayTeam.name}
              </div>
            </div>
          </div>

          {/* Injury Impact row */}
          <div style={{ ...tile, marginBottom: '1px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '1rem', alignItems: 'start' }}>
            {/* Home injury */}
            <InjuryColumn impact={homeImpact} align="left" locale={locale} teamId={homeId} />

            {/* Center label */}
            <div style={{ paddingTop: '0.125rem', textAlign: 'center', minWidth: '7rem' }}>
              <div className="sc-label">{locale === 'ko' ? '부상 현황' : 'Injury Status'}</div>
            </div>

            {/* Away injury */}
            <InjuryColumn impact={awayImpact} align="right" locale={locale} teamId={awayId} />
          </div>

          {/* Season stats row */}
          {(matchup.homeTeam.seasonStats || matchup.awayTeam.seasonStats) && (
            <div style={{ ...tile, marginBottom: '1px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '1rem', alignItems: 'start' }}>
              <StatsColumn stats={matchup.homeTeam.seasonStats} align="left" locale={locale} />
              <div style={{ paddingTop: '0.125rem', textAlign: 'center', minWidth: '7rem' }}>
                <div className="sc-label">{locale === 'ko' ? '시즌 기록' : 'Season Record'}</div>
              </div>
              <StatsColumn stats={matchup.awayTeam.seasonStats} align="right" locale={locale} />
            </div>
          )}

          {/* Form row */}
          <div style={{ ...tile, marginBottom: '1px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '1rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              {matchup.homeForm.map((f, i) => (
                <FormPip key={i} result={getFormResult(f, homeId)} />
              ))}
            </div>
            <div style={{ textAlign: 'center', minWidth: '7rem' }}>
              <div className="sc-label">{locale === 'ko' ? '최근 폼 (5경기)' : 'Form (last 5)'}</div>
            </div>
            <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
              {matchup.awayForm.map((f, i) => (
                <FormPip key={i} result={getFormResult(f, awayId)} />
              ))}
            </div>
          </div>

          {/* H2H row */}
          {matchup.h2h.length > 0 && (
            <div style={{ ...tile, marginBottom: '1px' }}>
              <div className="sc-label" style={{ marginBottom: '0.75rem' }}>
                {locale === 'ko' ? '맞대결 기록 (최근 10경기)' : 'Head to Head (last 10)'}
              </div>
              <H2HTable h2h={matchup.h2h} homeId={homeId} awayId={awayId} />
            </div>
          )}

          {/* Quick links */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <Link href={`/team/${homeId}`} style={{
              padding: '0.5rem 1rem', background: 'var(--cds-layer-01, #262626)',
              border: '1px solid var(--cds-border-subtle-01, #393939)',
              color: 'var(--cds-text-secondary, #c6c6c6)', fontSize: '0.8125rem', textDecoration: 'none',
            }}>
              {matchup.homeTeam.name} {locale === 'ko' ? '부상 리포트 →' : 'Injury Report →'}
            </Link>
            <Link href={`/team/${awayId}`} style={{
              padding: '0.5rem 1rem', background: 'var(--cds-layer-01, #262626)',
              border: '1px solid var(--cds-border-subtle-01, #393939)',
              color: 'var(--cds-text-secondary, #c6c6c6)', fontSize: '0.8125rem', textDecoration: 'none',
            }}>
              {matchup.awayTeam.name} {locale === 'ko' ? '부상 리포트 →' : 'Injury Report →'}
            </Link>
          </div>
        </div>
      )}

      {/* Prompt to select teams */}
      {(!homeId || !awayId) && (
        <div style={{
          marginTop: '1.5rem',
          padding: '3rem 1.5rem', textAlign: 'center',
          background: 'var(--cds-layer-01, #262626)',
          border: '1px solid var(--cds-border-subtle-01, #393939)',
          color: 'var(--cds-text-helper, #8d8d8d)',
          fontSize: '0.875rem',
        }}>
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
  if (!impact) return <div style={{ color: 'var(--cds-text-helper, #8d8d8d)', fontSize: '0.8125rem', textAlign: isRight ? 'right' : 'left' }}>—</div>;

  const out = impact.injuredPlayers.length;
  const pl = impact.powerLossPct;
  const ss = impact.severitySummary;

  return (
    <div style={{ textAlign: isRight ? 'right' : 'left', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      <div style={{ fontSize: '1.75rem', fontWeight: 300, color: powerLossColor(pl), fontFamily: 'var(--font-plex-mono, monospace)' }}>
        {pl.toFixed(1)}%
      </div>
      <div style={{ fontSize: '0.8125rem', color: 'var(--cds-text-helper, #8d8d8d)' }}>
        {locale === 'ko' ? '전력 손실' : 'Power Loss'}
      </div>
      <div style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary, #c6c6c6)' }}>
        {out} {locale === 'ko' ? '명 결장' : out === 1 ? 'player out' : 'players out'}
      </div>
      {ss && (ss.critical + ss.high > 0) && (
        <div style={{ fontSize: '0.75rem', color: '#fa4d56' }}>
          {ss.critical + ss.high} {locale === 'ko' ? '명 중요/심각' : 'critical/high'}
        </div>
      )}
      <Link href={`/team/${teamId}`} style={{ fontSize: '0.75rem', color: 'var(--cds-interactive, #4589ff)', textDecoration: 'none', marginTop: '0.25rem' }}>
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
  if (!stats) return <div style={{ color: 'var(--cds-text-helper, #8d8d8d)', fontSize: '0.8125rem', textAlign: isRight ? 'right' : 'left' }}>—</div>;

  const { wins, draws, losses, goalsFor, goalsAgainst, played } = stats;
  const pts = ((wins ?? 0) * 3) + (draws ?? 0);

  return (
    <div style={{ textAlign: isRight ? 'right' : 'left', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 300, color: 'var(--cds-text-primary, #f4f4f4)', fontFamily: 'var(--font-plex-mono, monospace)' }}>
        {pts} {locale === 'ko' ? '점' : 'pts'}
      </div>
      <div style={{ fontSize: '0.8125rem', color: 'var(--cds-text-secondary, #c6c6c6)' }}>
        {played ?? 0}{locale === 'ko' ? '경기' : 'P'} &nbsp;
        {wins ?? 0}{locale === 'ko' ? '승' : 'W'} &nbsp;
        {draws ?? 0}{locale === 'ko' ? '무' : 'D'} &nbsp;
        {losses ?? 0}{locale === 'ko' ? '패' : 'L'}
      </div>
      <div style={{ fontSize: '0.8125rem', color: 'var(--cds-text-helper, #8d8d8d)' }}>
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
      {/* H2H summary */}
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary, #c6c6c6)' }}>{homeName}: <strong>{homeWins}W</strong></span>
        <span style={{ fontSize: '0.875rem', color: 'var(--cds-text-helper, #8d8d8d)' }}>D: <strong>{draws}</strong></span>
        <span style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary, #c6c6c6)' }}>{awayName}: <strong>{awayWins}W</strong></span>
      </div>

      {/* Recent results */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        {h2h.slice(0, 5).map((f) => {
          const d = new Date(f.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
          return (
            <div key={f.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.8125rem' }}>
              <span style={{ color: 'var(--cds-text-helper, #8d8d8d)', minWidth: '5rem' }}>{d}</span>
              <span style={{ color: 'var(--cds-text-secondary, #c6c6c6)', flex: 1 }}>
                {f.homeTeam.name} {f.goalsHome ?? '?'} – {f.goalsAway ?? '?'} {f.awayTeam.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
