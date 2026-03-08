import { fetchApi } from '@/lib/api';
import Link from 'next/link';
import { getLocale } from '@/lib/locale';
import { t } from '@/lib/i18n';
import { LEAGUE_NAMES, CURRENT_SEASON } from '@/lib/constants';
import type { Fixture, Standing } from '@/lib/types';
import { parseRoundNumberForSort, formatRoundLabel } from '@/lib/format';
import { ClientMatchDate } from '@/components/client-date';

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

  // Determine current round index (default: first for upcoming, last for results)
  const requestedRoundNum = searchParams.round ? parseInt(searchParams.round) : null;
  const currentIdx = requestedRoundNum !== null
    ? Math.max(0, sortedRounds.findIndex(([r]) => parseRoundNumberForSort(r) === requestedRoundNum))
    : isResults ? 0 : 0; // both default to first in sortedRounds (which is already correct order)

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
            {/* Prev button */}
            {prevRound ? (
              <Link
                href={`${tabBase}${tabBase.includes('?') ? '&' : '?'}round=${parseRoundNumberForSort(prevRound[0])}`}
                style={navBtnBase}
              >
                ← {formatRoundLabel(prevRound[0], locale)}
              </Link>
            ) : (
              <span style={navBtnDisabled}>← {locale === 'ko' ? '이전' : 'Prev'}</span>
            )}

            {/* Current round label */}
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'var(--cds-interactive, #4589ff)',
                }}
              >
                {formatRoundLabel(currentEntry[0], locale)}
              </div>
              <div
                style={{
                  fontSize: '0.6875rem',
                  color: 'var(--cds-text-helper, #8d8d8d)',
                  marginTop: '0.125rem',
                }}
              >
                {currentEntry[1].length} {locale === 'ko' ? '경기' : 'matches'}
                {' · '}
                {locale === 'ko'
                  ? `${currentIdx + 1} / ${sortedRounds.length}`
                  : `${currentIdx + 1} of ${sortedRounds.length}`}
              </div>
            </div>

            {/* Next button */}
            {nextRound ? (
              <Link
                href={`${tabBase}${tabBase.includes('?') ? '&' : '?'}round=${parseRoundNumberForSort(nextRound[0])}`}
                style={navBtnBase}
              >
                {formatRoundLabel(nextRound[0], locale)} →
              </Link>
            ) : (
              <span style={navBtnDisabled}>{locale === 'ko' ? '다음' : 'Next'} →</span>
            )}
          </div>

          {/* Match cards grid */}
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

          {/* Round index pills */}
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
                const roundNum = parseRoundNumberForSort(round);
                const isActive = idx === currentIdx;
                return (
                  <Link
                    key={round}
                    href={`${tabBase}${tabBase.includes('?') ? '&' : '?'}round=${roundNum}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '2rem',
                      height: '2rem',
                      fontSize: '0.75rem',
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
                    }}
                  >
                    {roundNum}
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
      {/* Teams */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
        }}
      >
        <TeamBlock name={fix.homeTeam.name} logo={fix.homeTeam.logo} />

        {/* VS + rank */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.25rem',
            flexShrink: 0,
            padding: '0 0.25rem',
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--cds-text-helper, #8d8d8d)', letterSpacing: '0.5px' }}>vs</span>
          {rankMap[fix.homeTeam.id] && rankMap[fix.awayTeam.id] && (
            <span style={{ fontSize: '0.625rem', color: 'var(--cds-text-helper, #8d8d8d)', fontFamily: 'var(--font-plex-mono, monospace)', whiteSpace: 'nowrap' }}>
              #{rankMap[fix.homeTeam.id]} · #{rankMap[fix.awayTeam.id]}
            </span>
          )}
        </div>

        <TeamBlock name={fix.awayTeam.name} logo={fix.awayTeam.logo} />
      </div>

      {/* Date & venue */}
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

  const statusLabel =
    fix.status === 'AET' ? 'AET' :
    fix.status === 'PEN' ? 'PEN' :
    'FT';

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
      {/* Teams + score */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <TeamBlock
          name={fix.homeTeam.name}
          logo={fix.homeTeam.logo}
          dimmed={awayWon}
        />

        {/* Score block */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.25rem',
            flexShrink: 0,
            padding: '0 0.25rem',
          }}
        >
          <span
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--cds-text-primary, #f4f4f4)',
              fontFamily: 'var(--font-plex-mono, monospace)',
              letterSpacing: '0.05em',
            }}
          >
            {homeGoals} — {awayGoals}
          </span>
          <span
            style={{
              fontSize: '0.5625rem',
              fontWeight: 600,
              color: 'var(--cds-text-helper, #8d8d8d)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {statusLabel}
          </span>
          {rankMap[fix.homeTeam.id] && rankMap[fix.awayTeam.id] && (
            <span style={{ fontSize: '0.625rem', color: 'var(--cds-text-helper, #8d8d8d)', fontFamily: 'var(--font-plex-mono, monospace)', whiteSpace: 'nowrap' }}>
              #{rankMap[fix.homeTeam.id]} · #{rankMap[fix.awayTeam.id]}
            </span>
          )}
        </div>

        <TeamBlock
          name={fix.awayTeam.name}
          logo={fix.awayTeam.logo}
          dimmed={homeWon}
        />
      </div>

      {/* Date & venue */}
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
function TeamBlock({
  name,
  logo,
  dimmed = false,
}: {
  name: string;
  logo: string | null;
  dimmed?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.375rem',
        flex: 1,
        minWidth: 0,
      }}
    >
      {logo && (
        <img
          src={logo}
          alt=""
          style={{
            width: '2.25rem',
            height: '2.25rem',
            objectFit: 'contain',
            opacity: dimmed ? 0.45 : 1,
          }}
        />
      )}
      <span
        style={{
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: dimmed
            ? 'var(--cds-text-helper, #8d8d8d)'
            : 'var(--cds-text-primary, #f4f4f4)',
          textAlign: 'center',
          lineHeight: 1.3,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {name}
      </span>
    </div>
  );
}
