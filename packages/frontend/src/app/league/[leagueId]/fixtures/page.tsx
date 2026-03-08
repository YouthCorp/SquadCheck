import { fetchApi } from '@/lib/api';
import Link from 'next/link';
import { getLocale } from '@/lib/locale';
import { t } from '@/lib/i18n';
import { LEAGUE_NAMES, CURRENT_SEASON } from '@/lib/constants';
import type { Fixture, Standing } from '@/lib/types';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: { leagueId: string };
}): Promise<Metadata> {
  const leagueId = parseInt(params.leagueId);
  const leagueName = LEAGUE_NAMES[leagueId] ?? `League ${leagueId}`;
  const title = `${leagueName} Fixtures & Results`;
  const description = `${leagueName} upcoming fixtures and past results. Injury impact analysis and predicted lineups before every match.`;
  return {
    title,
    description,
    openGraph: { title: `${title} | SquadCheck`, description },
    alternates: { canonical: `/league/${leagueId}/fixtures` },
  };
}
import {
  parseRoundNumberForSort,
  formatRoundLabel,
  formatRoundPill,
  isKnockoutRound,
} from '@/lib/format';
import { ClientMatchDate } from '@/components/client-date';

/* ── Tie type (for knockout grouping) ───────────────────────────────────── */
interface Tie {
  key: string;
  team1: { id: number; name: string; logo: string | null };
  team2: { id: number; name: string; logo: string | null };
  legs: Fixture[]; // sorted by date
}

/** Group fixtures into ties by team pair (supports 1-leg and 2-leg formats). */
function groupIntoTies(fixtures: Fixture[]): Tie[] {
  const map = new Map<string, Tie>();
  const byDate = [...fixtures].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  for (const fix of byDate) {
    const ids = [fix.homeTeam.id, fix.awayTeam.id].sort((a, b) => a - b);
    const key = ids.join('-');
    if (!map.has(key)) {
      map.set(key, { key, team1: fix.homeTeam, team2: fix.awayTeam, legs: [] });
    }
    map.get(key)!.legs.push(fix);
  }
  return Array.from(map.values());
}

export default async function FixturesPage({
  params,
  searchParams,
}: {
  params: { leagueId: string };
  searchParams: { round?: string; tab?: string };
}) {
  const leagueId = parseInt(params.leagueId);
  const locale = getLocale();
  const isResults = searchParams.tab === 'results';

  let fixtures: Fixture[] = [];
  let rankMap: Record<number, number> = {};
  try {
    const endpoint = isResults
      ? `/api/fixtures/results?league=${leagueId}&season=${CURRENT_SEASON}`
      : `/api/fixtures/upcoming?league=${leagueId}&all=true`;

    const [fixtureData, standing] = await Promise.all([
      fetchApi<Fixture[]>(endpoint),
      fetchApi<Standing>(`/api/standings?league=${leagueId}&season=${CURRENT_SEASON}`).catch(() => null),
    ]);
    fixtures = fixtureData;
    if (standing) {
      for (const e of standing.entries) rankMap[e.team.id] = e.rank;
    }
  } catch {}

  // Group by round, sort ascending for upcoming / descending for results
  const roundMap = new Map<string, Fixture[]>();
  for (const fix of fixtures) {
    const key = fix.round ?? 'Unknown';
    if (!roundMap.has(key)) roundMap.set(key, []);
    roundMap.get(key)!.push(fix);
  }
  const sortedRounds = Array.from(roundMap.entries()).sort(([a], [b]) => {
    const diff = parseRoundNumberForSort(a) - parseRoundNumberForSort(b);
    return isResults ? -diff : diff;
  });

  const leagueName = LEAGUE_NAMES[leagueId] ?? `League ${leagueId}`;
  const baseUrl = `/league/${leagueId}/fixtures`;
  const tabBase = isResults ? `${baseUrl}?tab=results` : baseUrl;

  // Find current round by exact round string match — avoids 999-collision bug.
  const requestedRound = searchParams.round ?? null;
  const currentIdx = requestedRound !== null
    ? Math.max(0, sortedRounds.findIndex(([r]) => r === requestedRound))
    : 0;

  const currentEntry = sortedRounds[currentIdx] ?? null;
  const prevRound = currentIdx > 0 ? sortedRounds[currentIdx - 1] : null;
  const nextRound = currentIdx < sortedRounds.length - 1 ? sortedRounds[currentIdx + 1] : null;

  const navBtnBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.5rem 1rem',
    fontSize: '0.8125rem',
    fontWeight: 500,
    border: '1px solid var(--cds-border-subtle-01, #393939)',
    background: 'var(--cds-layer-01, #262626)',
    color: 'var(--cds-text-primary, #f4f4f4)',
    textDecoration: 'none',
    transition: 'background 0.1s',
    cursor: 'pointer',
  };
  const navBtnDisabled: React.CSSProperties = {
    ...navBtnBase,
    color: 'var(--cds-text-disabled, #525252)',
    cursor: 'default',
    pointerEvents: 'none',
  };

  const noDataMsg = isResults ? t(locale, 'no_results') : t(locale, 'no_fixtures');

  function roundHref(round: string) {
    const sep = tabBase.includes('?') ? '&' : '?';
    return `${tabBase}${sep}round=${encodeURIComponent(round)}`;
  }

  return (
    <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
      {/* Page header */}
      <div
        style={{
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--cds-border-subtle-01, #393939)',
        }}
      >
        <p className="sc-label">
          <Link
            href={`/league/${leagueId}`}
            style={{ color: 'var(--cds-text-helper, #8d8d8d)', textDecoration: 'none' }}
          >
            {leagueName}
          </Link>
          {' / '}
          {t(locale, 'fixtures_title')}
        </p>
        <h1
          style={{
            fontSize: '1.75rem',
            fontWeight: 300,
            color: 'var(--cds-text-primary, #f4f4f4)',
            margin: 0,
          }}
        >
          {t(locale, 'fixtures_title')}
        </h1>
      </div>

      {/* Tab switcher */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          marginBottom: '1.5rem',
          borderBottom: '1px solid var(--cds-border-subtle-01, #393939)',
        }}
      >
        {[
          { key: 'upcoming', label: t(locale, 'tab_upcoming'), href: baseUrl },
          { key: 'results', label: t(locale, 'tab_results'), href: `${baseUrl}?tab=results` },
        ].map(({ key, label, href }) => {
          const isActive = key === (isResults ? 'results' : 'upcoming');
          return (
            <Link
              key={key}
              href={href}
              style={{
                padding: '0.625rem 1.25rem',
                fontSize: '0.875rem',
                fontWeight: isActive ? 600 : 400,
                color: isActive
                  ? 'var(--cds-text-primary, #f4f4f4)'
                  : 'var(--cds-text-helper, #8d8d8d)',
                textDecoration: 'none',
                borderBottom: isActive
                  ? '2px solid var(--cds-interactive, #4589ff)'
                  : '2px solid transparent',
                marginBottom: '-1px',
                transition: 'color 0.1s',
              }}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {sortedRounds.length === 0 || !currentEntry ? (
        <div
          style={{
            background: 'var(--cds-layer-01, #262626)',
            border: '1px solid var(--cds-border-subtle-01, #393939)',
            padding: '2rem',
            color: 'var(--cds-text-helper, #8d8d8d)',
            fontSize: '0.875rem',
          }}
        >
          {noDataMsg}
        </div>
      ) : (
        <>
          {/* Round navigation bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              background: 'var(--cds-layer-02, #393939)',
              marginBottom: '1rem',
            }}
          >
            {prevRound ? (
              <Link href={roundHref(prevRound[0])} style={navBtnBase}>
                ← {formatRoundLabel(prevRound[0], locale)}
              </Link>
            ) : (
              <span style={navBtnDisabled}>← {locale === 'ko' ? '이전' : 'Prev'}</span>
            )}

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--cds-interactive, #4589ff)' }}>
                {formatRoundLabel(currentEntry[0], locale)}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--cds-text-helper, #8d8d8d)', marginTop: '0.125rem' }}>
                {currentEntry[1].length} {locale === 'ko' ? '경기' : 'matches'}
                {' · '}
                {locale === 'ko'
                  ? `${currentIdx + 1} / ${sortedRounds.length}`
                  : `${currentIdx + 1} of ${sortedRounds.length}`}
              </div>
            </div>

            {nextRound ? (
              <Link href={roundHref(nextRound[0])} style={navBtnBase}>
                {formatRoundLabel(nextRound[0], locale)} →
              </Link>
            ) : (
              <span style={navBtnDisabled}>{locale === 'ko' ? '다음' : 'Next'} →</span>
            )}
          </div>

          {/* Knockout tie view or regular card grid */}
          {isKnockoutRound(currentEntry[0]) ? (
            <TiesView
              ties={groupIntoTies(currentEntry[1])}
              leagueId={leagueId}
              locale={locale}
            />
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '1px',
                background: 'var(--cds-border-subtle-01, #393939)',
              }}
            >
              {currentEntry[1].map((fix: Fixture) => (
                <Link
                  key={fix.id}
                  href={`/league/${leagueId}/fixtures/${fix.id}`}
                  style={{ textDecoration: 'none', display: 'block' }}
                >
                  {isResults
                    ? <ResultCard fix={fix} rankMap={rankMap} locale={locale} />
                    : <UpcomingCard fix={fix} rankMap={rankMap} locale={locale} />
                  }
                </Link>
              ))}
            </div>
          )}

          {/* Round pills */}
          {sortedRounds.length > 1 && (
            <div
              style={{
                display: 'flex',
                gap: '0.375rem',
                flexWrap: 'wrap',
                justifyContent: 'center',
                marginTop: '1.5rem',
              }}
            >
              {sortedRounds.map(([round], idx) => {
                const pill = formatRoundPill(round);
                const isActive = idx === currentIdx;
                return (
                  <Link
                    key={round}
                    href={roundHref(round)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '2rem',
                      height: '2rem',
                      padding: '0 0.375rem',
                      fontSize: '0.6875rem',
                      fontWeight: isActive ? 700 : 400,
                      fontFamily: 'var(--font-plex-mono, monospace)',
                      color: isActive
                        ? 'var(--cds-text-inverse, #ffffff)'
                        : 'var(--cds-text-secondary, #c6c6c6)',
                      background: isActive
                        ? 'var(--cds-interactive, #4589ff)'
                        : 'var(--cds-layer-01, #262626)',
                      border: '1px solid',
                      borderColor: isActive
                        ? 'var(--cds-interactive, #4589ff)'
                        : 'var(--cds-border-subtle-01, #393939)',
                      textDecoration: 'none',
                      transition: 'background 0.1s, color 0.1s',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {pill}
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Knockout ties view ─────────────────────────────────────────────────── */
function TiesView({ ties, leagueId, locale }: { ties: Tie[]; leagueId: number; locale: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--cds-border-subtle-01, #393939)' }}>
      {ties.map((tie) => (
        <TieCard key={tie.key} tie={tie} leagueId={leagueId} locale={locale} />
      ))}
    </div>
  );
}

function TieCard({ tie, leagueId, locale }: { tie: Tie; leagueId: number; locale: string }) {
  const isTwoLegs = tie.legs.length >= 2;
  const [leg1, leg2] = tie.legs;
  const ko = locale === 'ko';

  // Aggregate calculation for two-legged ties
  let t1Agg: number | null = null;
  let t2Agg: number | null = null;
  if (
    isTwoLegs &&
    leg1.goalsHome !== null && leg1.goalsAway !== null &&
    leg2.goalsHome !== null && leg2.goalsAway !== null
  ) {
    const leg1T1 = leg1.homeTeam.id === tie.team1.id ? leg1.goalsHome : leg1.goalsAway;
    const leg1T2 = leg1.homeTeam.id === tie.team2.id ? leg1.goalsHome : leg1.goalsAway;
    const leg2T1 = leg2.homeTeam.id === tie.team1.id ? leg2.goalsHome : leg2.goalsAway;
    const leg2T2 = leg2.homeTeam.id === tie.team2.id ? leg2.goalsHome : leg2.goalsAway;
    t1Agg = leg1T1 + leg2T1;
    t2Agg = leg1T2 + leg2T2;
  } else if (!isTwoLegs && leg1.goalsHome !== null && leg1.goalsAway !== null) {
    t1Agg = leg1.homeTeam.id === tie.team1.id ? leg1.goalsHome : leg1.goalsAway;
    t2Agg = leg1.homeTeam.id === tie.team2.id ? leg1.goalsHome : leg1.goalsAway;
  }

  const t1Wins = t1Agg !== null && t2Agg !== null && t1Agg > t2Agg;
  const t2Wins = t1Agg !== null && t2Agg !== null && t2Agg > t1Agg;

  return (
    <div style={{ background: 'var(--cds-layer-01, #262626)' }}>
      {/* Tie header: logos + score */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '1rem', gap: '0.75rem' }}>
        {/* Team 1 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem', minWidth: 0 }}>
          {tie.team1.logo && (
            <img src={tie.team1.logo} alt="" style={{ width: '2.5rem', height: '2.5rem', objectFit: 'contain', opacity: t2Wins ? 0.4 : 1 }} />
          )}
          <span style={{
            fontSize: '0.8125rem', fontWeight: 600, textAlign: 'center', lineHeight: 1.3,
            color: t2Wins ? 'var(--cds-text-helper, #8d8d8d)' : 'var(--cds-text-primary, #f4f4f4)',
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {tie.team1.name}
          </span>
        </div>

        {/* Aggregate / "vs" */}
        <div style={{ flexShrink: 0, textAlign: 'center', padding: '0 0.5rem', minWidth: '5rem' }}>
          {t1Agg !== null && t2Agg !== null ? (
            <>
              <div style={{
                fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-plex-mono, monospace)',
                color: 'var(--cds-text-primary, #f4f4f4)', letterSpacing: '0.05em',
              }}>
                {t1Agg} — {t2Agg}
              </div>
              {isTwoLegs && (
                <div style={{ fontSize: '0.5625rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--cds-text-helper, #8d8d8d)', marginTop: '0.125rem' }}>
                  {ko ? '합산' : 'AGG'}
                </div>
              )}
            </>
          ) : (
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--cds-text-helper, #8d8d8d)' }}>vs</span>
          )}
        </div>

        {/* Team 2 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem', minWidth: 0 }}>
          {tie.team2.logo && (
            <img src={tie.team2.logo} alt="" style={{ width: '2.5rem', height: '2.5rem', objectFit: 'contain', opacity: t1Wins ? 0.4 : 1 }} />
          )}
          <span style={{
            fontSize: '0.8125rem', fontWeight: 600, textAlign: 'center', lineHeight: 1.3,
            color: t1Wins ? 'var(--cds-text-helper, #8d8d8d)' : 'var(--cds-text-primary, #f4f4f4)',
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {tie.team2.name}
          </span>
        </div>
      </div>

      {/* Leg rows */}
      <div style={{ display: 'flex', borderTop: '1px solid var(--cds-border-subtle-01, #393939)' }}>
        {tie.legs.map((leg, i) => {
          const legScore = leg.goalsHome !== null && leg.goalsAway !== null
            ? `${leg.goalsHome} — ${leg.goalsAway}` : null;
          const statusBadge =
            leg.status === 'AET' ? 'AET' :
            leg.status === 'PEN' ? 'PEN' :
            leg.status !== 'NS' ? 'FT' : null;

          return (
            <Link
              key={leg.id}
              href={`/league/${leagueId}/fixtures/${leg.id}`}
              style={{
                flex: 1, textDecoration: 'none', padding: '0.625rem 0.75rem',
                borderRight: i < tie.legs.length - 1 ? '1px solid var(--cds-border-subtle-01, #393939)' : 'none',
                display: 'flex', flexDirection: 'column', gap: '0.25rem', transition: 'background 0.1s',
              }}
              className="sc-tile-hover"
            >
              <div style={{ fontSize: '0.625rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--cds-text-helper, #8d8d8d)' }}>
                {isTwoLegs ? (ko ? `${i + 1}차전` : `Leg ${i + 1}`) : (ko ? '경기' : 'Match')}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--cds-text-secondary, #c6c6c6)' }}>
                {leg.homeTeam.name} {ko ? '홈' : '(H)'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                {legScore ? (
                  <span style={{ fontSize: '0.9375rem', fontWeight: 700, fontFamily: 'var(--font-plex-mono, monospace)', color: 'var(--cds-text-primary, #f4f4f4)' }}>
                    {legScore}
                  </span>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary, #c6c6c6)', fontFamily: 'var(--font-plex-mono, monospace)' }}>
                    <ClientMatchDate dateStr={leg.date} locale={locale} />
                  </span>
                )}
                {statusBadge && (
                  <span style={{ fontSize: '0.5rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--cds-text-helper, #8d8d8d)' }}>
                    {statusBadge}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ── Upcoming fixture card ───────────────────────────────────────────────── */
function UpcomingCard({
  fix,
  rankMap,
  locale,
}: {
  fix: Fixture;
  rankMap: Record<number, number>;
  locale: string;
}) {
  return (
    <div
      className="sc-tile-hover"
      style={{
        background: 'var(--cds-layer-01, #262626)',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        height: '100%',
        cursor: 'pointer',
        transition: 'background 0.1s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <TeamBlock name={fix.homeTeam.name} logo={fix.homeTeam.logo} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', flexShrink: 0, padding: '0 0.25rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--cds-text-helper, #8d8d8d)', letterSpacing: '0.5px' }}>vs</span>
          {rankMap[fix.homeTeam.id] && rankMap[fix.awayTeam.id] && (
            <span style={{ fontSize: '0.625rem', color: 'var(--cds-text-helper, #8d8d8d)', fontFamily: 'var(--font-plex-mono, monospace)', whiteSpace: 'nowrap' }}>
              #{rankMap[fix.homeTeam.id]} · #{rankMap[fix.awayTeam.id]}
            </span>
          )}
        </div>
        <TeamBlock name={fix.awayTeam.name} logo={fix.awayTeam.logo} />
      </div>
      <div style={{ borderTop: '1px solid var(--cds-border-subtle-01, #393939)', paddingTop: '0.625rem' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary, #c6c6c6)', fontFamily: 'var(--font-plex-mono, monospace)' }}>
          <ClientMatchDate dateStr={fix.date} locale={locale} />
        </div>
        {fix.venueName && (
          <div style={{ fontSize: '0.6875rem', color: 'var(--cds-text-helper, #8d8d8d)', marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {fix.venueName}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Result card ─────────────────────────────────────────────────────────── */
function ResultCard({
  fix,
  rankMap,
  locale,
}: {
  fix: Fixture;
  rankMap: Record<number, number>;
  locale: string;
}) {
  const homeGoals = fix.goalsHome ?? 0;
  const awayGoals = fix.goalsAway ?? 0;
  const homeWon = homeGoals > awayGoals;
  const awayWon = awayGoals > homeGoals;
  const statusLabel = fix.status === 'AET' ? 'AET' : fix.status === 'PEN' ? 'PEN' : 'FT';

  return (
    <div
      className="sc-tile-hover"
      style={{
        background: 'var(--cds-layer-01, #262626)',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        height: '100%',
        cursor: 'pointer',
        transition: 'background 0.1s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <TeamBlock name={fix.homeTeam.name} logo={fix.homeTeam.logo} dimmed={awayWon} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', flexShrink: 0, padding: '0 0.25rem' }}>
          <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--cds-text-primary, #f4f4f4)', fontFamily: 'var(--font-plex-mono, monospace)', letterSpacing: '0.05em' }}>
            {homeGoals} — {awayGoals}
          </span>
          <span style={{ fontSize: '0.5625rem', fontWeight: 600, color: 'var(--cds-text-helper, #8d8d8d)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {statusLabel}
          </span>
          {rankMap[fix.homeTeam.id] && rankMap[fix.awayTeam.id] && (
            <span style={{ fontSize: '0.625rem', color: 'var(--cds-text-helper, #8d8d8d)', fontFamily: 'var(--font-plex-mono, monospace)', whiteSpace: 'nowrap' }}>
              #{rankMap[fix.homeTeam.id]} · #{rankMap[fix.awayTeam.id]}
            </span>
          )}
        </div>
        <TeamBlock name={fix.awayTeam.name} logo={fix.awayTeam.logo} dimmed={homeWon} />
      </div>
      <div style={{ borderTop: '1px solid var(--cds-border-subtle-01, #393939)', paddingTop: '0.625rem' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary, #c6c6c6)', fontFamily: 'var(--font-plex-mono, monospace)' }}>
          <ClientMatchDate dateStr={fix.date} locale={locale} />
        </div>
        {fix.venueName && (
          <div style={{ fontSize: '0.6875rem', color: 'var(--cds-text-helper, #8d8d8d)', marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {fix.venueName}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Shared team block ───────────────────────────────────────────────────── */
function TeamBlock({ name, logo, dimmed = false }: { name: string; logo: string | null; dimmed?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem', flex: 1, minWidth: 0 }}>
      {logo && (
        <img src={logo} alt="" style={{ width: '2.25rem', height: '2.25rem', objectFit: 'contain', opacity: dimmed ? 0.45 : 1 }} />
      )}
      <span style={{
        fontSize: '0.8125rem', fontWeight: 600,
        color: dimmed ? 'var(--cds-text-helper, #8d8d8d)' : 'var(--cds-text-primary, #f4f4f4)',
        textAlign: 'center', lineHeight: 1.3,
        overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>
        {name}
      </span>
    </div>
  );
}
