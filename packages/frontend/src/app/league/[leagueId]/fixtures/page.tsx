import { fetchApi } from '@/lib/api';
import Link from 'next/link';
import { getLocale } from '@/lib/locale';
import { t } from '@/lib/i18n';
import { LEAGUE_NAMES } from '@/lib/constants';
import type { Team, Fixture } from '@/lib/types';
import { parseRoundNumberForSort, formatMatchDate, formatRoundLabel } from '@/lib/format';

export default async function FixturesPage({
  params,
  searchParams,
}: {
  params: { leagueId: string };
  searchParams: { round?: string };
}) {
  const leagueId = parseInt(params.leagueId);
  const locale = getLocale();

  let fixtures: Fixture[] = [];
  try {
    fixtures = await fetchApi<Fixture[]>(`/api/fixtures/upcoming?league=${leagueId}&all=true`);
  } catch {}

  // Group by round, sorted by round number
  const roundMap = new Map<string, Fixture[]>();
  for (const fix of fixtures) {
    const key = fix.round ?? 'Unknown';
    if (!roundMap.has(key)) roundMap.set(key, []);
    roundMap.get(key)!.push(fix);
  }
  const sortedRounds = Array.from(roundMap.entries()).sort(
    ([a], [b]) => parseRoundNumberForSort(a) - parseRoundNumberForSort(b)
  );

  const leagueName = LEAGUE_NAMES[leagueId] ?? `League ${leagueId}`;
  const baseUrl = `/league/${leagueId}/fixtures`;

  // Determine current round index from query param (default: first round)
  const requestedRoundNum = searchParams.round ? parseInt(searchParams.round) : null;
  const currentIdx = requestedRoundNum !== null
    ? Math.max(0, sortedRounds.findIndex(([r]) => parseRoundNumberForSort(r) === requestedRoundNum))
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
          {t(locale, 'no_fixtures')}
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
                href={`${baseUrl}?round=${parseRoundNumberForSort(prevRound[0])}`}
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
                href={`${baseUrl}?round=${parseRoundNumberForSort(nextRound[0])}`}
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
                    {/* Home team */}
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
                      {fix.homeTeam.logo && (
                        <img
                          src={fix.homeTeam.logo}
                          alt=""
                          style={{ width: '2.25rem', height: '2.25rem', objectFit: 'contain' }}
                        />
                      )}
                      <span
                        style={{
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          color: 'var(--cds-text-primary, #f4f4f4)',
                          textAlign: 'center',
                          lineHeight: 1.3,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {fix.homeTeam.name}
                      </span>
                    </div>

                    {/* VS */}
                    <div
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--cds-text-helper, #8d8d8d)',
                        letterSpacing: '0.5px',
                        flexShrink: 0,
                        padding: '0 0.25rem',
                      }}
                    >
                      vs
                    </div>

                    {/* Away team */}
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
                      {fix.awayTeam.logo && (
                        <img
                          src={fix.awayTeam.logo}
                          alt=""
                          style={{ width: '2.25rem', height: '2.25rem', objectFit: 'contain' }}
                        />
                      )}
                      <span
                        style={{
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          color: 'var(--cds-text-primary, #f4f4f4)',
                          textAlign: 'center',
                          lineHeight: 1.3,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {fix.awayTeam.name}
                      </span>
                    </div>
                  </div>

                  {/* Date & venue */}
                  <div
                    style={{
                      borderTop: '1px solid var(--cds-border-subtle-01, #393939)',
                      paddingTop: '0.625rem',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--cds-text-secondary, #c6c6c6)',
                        fontFamily: 'var(--font-plex-mono, monospace)',
                      }}
                    >
                      {formatMatchDate(fix.date, locale)}
                    </div>
                    {fix.venueName && (
                      <div
                        style={{
                          fontSize: '0.6875rem',
                          color: 'var(--cds-text-helper, #8d8d8d)',
                          marginTop: '0.25rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {fix.venueName}
                      </div>
                    )}
                  </div>
                </div>
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
                    href={`${baseUrl}?round=${roundNum}`}
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
