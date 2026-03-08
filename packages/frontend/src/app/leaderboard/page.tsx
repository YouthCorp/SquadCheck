import { fetchApi } from '@/lib/api';
import Link from 'next/link';
import { getLocale } from '@/lib/locale';
import { LEAGUE_NAMES, CURRENT_SEASON } from '@/lib/constants';
import type { InjurySummaryEntry, InjuryImpact } from '@/lib/types';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Season Injury Leaderboard',
  description: `${CURRENT_SEASON}/${CURRENT_SEASON + 1} season injury leaderboard — most injured teams and highest Power Loss % across European football.`,
  openGraph: {
    title: 'Season Injury Leaderboard | SquadCheck',
    description: 'Which teams have been hit hardest by injuries this season?',
  },
  alternates: { canonical: '/leaderboard' },
};

export const revalidate = 600; // 10 minutes

const LEAGUE_IDS = [39, 140, 135, 78, 61] as const;

function powerLossColor(pct: number): string {
  if (pct >= 20) return '#fa4d56';
  if (pct >= 10) return '#f1c21b';
  return '#42be65';
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: { sort?: string; league?: string };
}) {
  const locale = getLocale();
  const sortBy = (searchParams.sort === 'power') ? 'power' : 'count';
  const leagueFilter = searchParams.league ? parseInt(searchParams.league) : null;

  // 1. Fetch injury summaries for all leagues (or filtered)
  const leaguesToFetch = leagueFilter ? [leagueFilter as (typeof LEAGUE_IDS)[number]] : [...LEAGUE_IDS];
  const summaryResults = await Promise.all(
    leaguesToFetch.map((id) =>
      fetchApi<InjurySummaryEntry[]>(`/api/injuries/summary?league=${id}&season=${CURRENT_SEASON}`)
        .then((data) => data.map((e) => ({ ...e, leagueId: id })))
        .catch(() => [] as (InjurySummaryEntry & { leagueId: number })[])
    )
  );

  // 2. Combine + filter teams with injuries
  const allEntries = summaryResults.flat().filter(
    (e) => e.team != null && e.injuryCount > 0
  ) as ((InjurySummaryEntry & { leagueId: number }) & { team: NonNullable<InjurySummaryEntry['team']> })[];

  // Deduplicate by team id (team may appear in multiple leagues)
  const uniqueByTeam = new Map<number, typeof allEntries[0]>();
  for (const e of allEntries) {
    const existing = uniqueByTeam.get(e.team.id);
    if (!existing || e.injuryCount > existing.injuryCount) {
      uniqueByTeam.set(e.team.id, e);
    }
  }

  // 3. Fetch injury impact for top 20 teams by count
  const sortedByCount = Array.from(uniqueByTeam.values())
    .sort((a, b) => b.injuryCount - a.injuryCount)
    .slice(0, 20);

  const impactResults = await Promise.all(
    sortedByCount.map((e) =>
      fetchApi<InjuryImpact>(`/api/analysis/injury-impact/${e.team.id}?season=${CURRENT_SEASON}`)
        .catch(() => null)
    )
  );

  // 4. Build combined records
  // currentOut = impact.injuredPlayers.length (현재 결장 선수 수, injury-impact 기준)
  // seasonAbsences = injuryCount from summary (시즌 누적 결장 기록 수 — 선수×경기 단위)
  const records = sortedByCount.map((e, i) => ({
    team: e.team,
    leagueId: e.leagueId,
    seasonAbsences: e.injuryCount,   // injuries 테이블 행 수 (누적)
    currentOut: impactResults[i]?.injuredPlayers.length ?? 0,  // 현재 결장 선수 수
    impact: impactResults[i],
    powerLossPct: impactResults[i]?.powerLossPct ?? 0,
    severitySummary: impactResults[i]?.severitySummary ?? null,
    topPlayers: impactResults[i]?.injuredPlayers
      .filter((p) => p.severity === 'critical' || p.severity === 'high')
      .slice(0, 2)
      .map((p) => p.player.name) ?? [],
  }));

  // 5. Sort: 'count' = 현재 결장자 수, 'power' = 전력 손실 %
  const sorted = [...records].sort((a, b) =>
    sortBy === 'power' ? b.powerLossPct - a.powerLossPct : b.currentOut - a.currentOut
  );

  const tile: React.CSSProperties = {
    background: 'var(--cds-layer-01, #262626)',
    border: '1px solid var(--cds-border-subtle-01, #393939)',
  };

  const tabBase: React.CSSProperties = {
    padding: '0.375rem 0.875rem',
    fontSize: '0.8125rem',
    border: '1px solid var(--cds-border-subtle-01, #393939)',
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-block',
  };
  const tabActive: React.CSSProperties = {
    ...tabBase,
    background: 'var(--cds-layer-selected-01, #393939)',
    color: 'var(--cds-text-primary, #f4f4f4)',
  };
  const tabInactive: React.CSSProperties = {
    ...tabBase,
    background: 'transparent',
    color: 'var(--cds-text-secondary, #c6c6c6)',
  };

  return (
    <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '0 1rem' }}>
      {/* Header */}
      <div style={{ padding: '1.5rem 0 1rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 300, color: 'var(--cds-text-primary, #f4f4f4)', margin: '0 0 0.25rem' }}>
          {locale === 'ko' ? '시즌 부상 리더보드' : 'Season Injury Leaderboard'}
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--cds-text-helper, #8d8d8d)', margin: '0 0 1rem' }}>
          {CURRENT_SEASON}/{CURRENT_SEASON + 1} · {locale === 'ko' ? '이번 시즌 부상 타격 순위' : 'Teams hit hardest by injuries this season'}
        </p>

        {/* Sort + league filter */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Sort tabs */}
          <div style={{ display: 'flex' }}>
            <Link
              href={`/leaderboard?sort=count${leagueFilter ? `&league=${leagueFilter}` : ''}`}
              style={sortBy === 'count' ? tabActive : tabInactive}
            >
              {locale === 'ko' ? '결장 선수 수' : 'Players Out'}
            </Link>
            <Link
              href={`/leaderboard?sort=power${leagueFilter ? `&league=${leagueFilter}` : ''}`}
              style={sortBy === 'power' ? tabActive : tabInactive}
            >
              {locale === 'ko' ? '전력 손실 %' : 'Power Loss %'}
            </Link>
          </div>

          {/* League filter */}
          <div style={{ display: 'flex', gap: '0px', flexWrap: 'wrap' }}>
            <Link
              href={`/leaderboard?sort=${sortBy}`}
              style={!leagueFilter ? tabActive : tabInactive}
            >
              {locale === 'ko' ? '전체' : 'All Leagues'}
            </Link>
            {LEAGUE_IDS.map((id) => (
              <Link
                key={id}
                href={`/leaderboard?sort=${sortBy}&league=${id}`}
                style={leagueFilter === id ? tabActive : { ...tabInactive, fontSize: '0.75rem' }}
              >
                {LEAGUE_NAMES[id]}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <div style={{ ...tile, padding: '3rem', textAlign: 'center', color: 'var(--cds-text-helper, #8d8d8d)' }}>
          {locale === 'ko' ? '데이터 없음' : 'No data available'}
        </div>
      ) : (
        <div style={{ ...tile }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2.5rem 1fr 5rem 6rem 1fr',
            gap: '0.5rem',
            padding: '0.625rem 1rem',
            borderBottom: '1px solid var(--cds-border-subtle-01, #393939)',
            alignItems: 'center',
          }}>
            <span className="sc-label">#</span>
            <span className="sc-label">{locale === 'ko' ? '팀' : 'Team'}</span>
            <span className="sc-label" style={{ textAlign: 'center' }}>{locale === 'ko' ? '결장' : 'Out'}</span>
            <span className="sc-label" style={{ textAlign: 'right' }}>{locale === 'ko' ? '전력 손실' : 'Power Loss'}</span>
            <span className="sc-label">{locale === 'ko' ? '주요 결장자' : 'Key Absentees'}</span>
          </div>

          {/* Rows */}
          {sorted.map((r, idx) => (
            <Link
              key={r.team.id}
              href={`/team/${r.team.id}`}
              className="sc-tile-hover"
              style={{ textDecoration: 'none', display: 'block' }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2.5rem 1fr 5rem 6rem 1fr',
                  gap: '0.5rem',
                  padding: '0.75rem 1rem',
                  borderBottom: idx < sorted.length - 1 ? '1px solid var(--cds-border-subtle-01, #393939)' : 'none',
                  alignItems: 'center',
                }}
              >
                {/* Rank */}
                <span style={{
                  fontSize: '0.875rem', fontWeight: 300,
                  color: idx < 3 ? 'var(--cds-text-primary, #f4f4f4)' : 'var(--cds-text-helper, #8d8d8d)',
                  fontFamily: 'var(--font-plex-mono, monospace)',
                }}>
                  {idx + 1}
                </span>

                {/* Team */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  {r.team.logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.team.logo} alt="" width={24} height={24} style={{ objectFit: 'contain', flexShrink: 0 }} />
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                    <span style={{ fontSize: '0.9375rem', color: 'var(--cds-text-primary, #f4f4f4)' }}>{r.team.name}</span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--cds-text-helper, #8d8d8d)' }}>
                      {LEAGUE_NAMES[r.leagueId as keyof typeof LEAGUE_NAMES]}
                    </span>
                  </div>
                </div>

                {/* Out count — 현재 결장 선수 수 */}
                <div style={{ textAlign: 'center' }}>
                  <span style={{
                    fontSize: '1.25rem', fontWeight: 300,
                    color: r.currentOut >= 5 ? '#fa4d56' : r.currentOut >= 3 ? '#f1c21b' : 'var(--cds-text-primary, #f4f4f4)',
                    fontFamily: 'var(--font-plex-mono, monospace)',
                  }}>
                    {r.currentOut}
                  </span>
                </div>

                {/* Power Loss */}
                <div style={{ textAlign: 'right' }}>
                  {r.powerLossPct > 0 ? (
                    <span style={{
                      fontSize: '1rem', fontWeight: 300,
                      color: powerLossColor(r.powerLossPct),
                      fontFamily: 'var(--font-plex-mono, monospace)',
                    }}>
                      −{r.powerLossPct.toFixed(1)}%
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.875rem', color: 'var(--cds-text-helper, #8d8d8d)' }}>—</span>
                  )}
                </div>

                {/* Key absentees */}
                <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-helper, #8d8d8d)' }}>
                  {r.topPlayers.length > 0
                    ? r.topPlayers.join(', ')
                    : r.impact?.injuredPlayers.slice(0, 2).map((p) => p.player.name).join(', ') ?? '—'}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Season note */}
      <div style={{ padding: '1rem 0', fontSize: '0.6875rem', color: 'var(--cds-text-helper, #8d8d8d)' }}>
        {locale === 'ko'
          ? `* ${CURRENT_SEASON}/${CURRENT_SEASON + 1} 시즌 5대 리그 기준. 5분마다 업데이트.`
          : `* ${CURRENT_SEASON}/${CURRENT_SEASON + 1} season, 5 major leagues. Updates every 5 minutes.`}
      </div>
    </div>
  );
}
