import { fetchApi } from '@/lib/api';
import Link from 'next/link';
import { getLocale } from '@/lib/locale';
import { t, type Locale } from '@/lib/i18n';
import { LEAGUE_NAMES } from '@/lib/constants';
import type { Fixture, InjuryImpact, PredictedLineup, Standing } from '@/lib/types';
import { formatRoundLabel, parseRoundNumber } from '@/lib/format';
import { ClientMatchDateTime } from '@/components/client-date';
import { InjuredPlayerCard } from '@/components/injured-player-card';
import { PitchLineup } from '@/components/pitch-lineup';

// ── Injury column component ───────────────────────────────────────────────────

function InjuryColumn({
  impact,
  locale,
  side,
}: {
  impact: InjuryImpact | null;
  locale: Locale;
  side: 'home' | 'away';
}) {
  const loc = locale;
  const team = impact?.team;
  const ss = impact?.severitySummary;
  const highImpact = impact?.injuredPlayers.filter(
    (p) => p.severity === 'critical' || p.severity === 'high'
  ) ?? [];
  const otherInjured = impact?.injuredPlayers.filter(
    (p) => p.severity === 'moderate' || p.severity === 'low'
  ) ?? [];
  const totalOut = (impact?.injuredPlayers.length ?? 0);

  return (
    <div>
      {/* Team header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.875rem 1rem',
          background: 'var(--cds-layer-02, #393939)',
          marginBottom: '1px',
        }}
      >
        {team?.logo && (
          <img
            src={team.logo}
            alt=""
            style={{ width: '1.75rem', height: '1.75rem', objectFit: 'contain', flexShrink: 0 }}
          />
        )}
        <span
          style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--cds-text-primary, #f4f4f4)',
          }}
        >
          {team?.name ?? '—'}
        </span>
      </div>

      {/* Power loss stats */}
      {impact && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1px',
            background: 'var(--cds-border-subtle-01, #393939)',
            marginBottom: '1px',
          }}
        >
          <div
            style={{
              background: 'var(--cds-layer-01, #262626)',
              padding: '0.875rem 1rem',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: '1.5rem',
                fontWeight: 300,
                color:
                  impact.powerLossPct >= 15
                    ? 'var(--sc-red)'
                    : impact.powerLossPct >= 8
                    ? 'var(--sc-orange)'
                    : 'var(--cds-text-primary, #f4f4f4)',
                fontFamily: 'var(--font-plex-mono, monospace)',
              }}
            >
              {impact.powerLossPct.toFixed(1)}%
            </div>
            <div className="sc-label" style={{ marginTop: '0.25rem' }}>
              {t(loc, 'power_loss')}
            </div>
          </div>
          <div
            style={{
              background: 'var(--cds-layer-01, #262626)',
              padding: '0.875rem 1rem',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: '1.5rem',
                fontWeight: 300,
                color:
                  totalOut >= 4
                    ? 'var(--sc-red)'
                    : totalOut >= 2
                    ? 'var(--sc-orange)'
                    : 'var(--cds-text-secondary, #c6c6c6)',
                fontFamily: 'var(--font-plex-mono, monospace)',
              }}
            >
              {totalOut}
            </div>
            <div className="sc-label" style={{ marginTop: '0.25rem' }}>
              {t(loc, 'players_out')}
            </div>
          </div>
        </div>
      )}

      {/* No injuries */}
      {impact && totalOut === 0 && (
        <div
          style={{
            padding: '1.5rem 1rem',
            background: 'var(--cds-layer-01, #262626)',
            color: 'var(--cds-text-helper, #8d8d8d)',
            fontSize: '0.875rem',
            textAlign: 'center',
          }}
        >
          {t(loc, 'no_injuries')}
        </div>
      )}

      {/* Key absences */}
      {highImpact.length > 0 && (
        <div>
          <div
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--cds-layer-02, #393939)',
              marginBottom: '1px',
            }}
          >
            <span className="sc-label" style={{ color: '#ff8389' }}>
              {t(loc, 'key_absences')}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1px',
              background: 'var(--cds-border-subtle-01, #393939)',
              marginBottom: '1px',
            }}
          >
            {highImpact.map((ip) => (
              <InjuredPlayerCard
                key={ip.player.id}
                ip={ip}
                locale={locale}
                variant="fixture"
                severity="high"
              />
            ))}
          </div>
        </div>
      )}

      {/* Other injuries */}
      {otherInjured.length > 0 && (
        <div>
          <div
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--cds-layer-02, #393939)',
              marginBottom: '1px',
            }}
          >
            <span className="sc-label">{t(loc, 'other_injuries')}</span>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1px',
              background: 'var(--cds-border-subtle-01, #393939)',
            }}
          >
            {otherInjured.map((ip) => (
              <InjuredPlayerCard
                key={ip.player.id}
                ip={ip}
                locale={locale}
                variant="fixture"
                severity="other"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Lineup column component ───────────────────────────────────────────────────


function LineupColumn({
  lineup,
  locale,
}: {
  lineup: PredictedLineup | null;
  locale: Locale;
}) {
  if (!lineup) {
    return (
      <div
        style={{
          background: 'var(--cds-layer-01, #262626)',
          padding: '2rem 1rem',
          textAlign: 'center',
          color: 'var(--cds-text-helper, #8d8d8d)',
          fontSize: '0.875rem',
        }}
      >
        {t(locale, 'lineup_no_data')}
      </div>
    );
  }

  return (
    <div>
      {/* Team header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.875rem 1rem',
          background: 'var(--cds-layer-02, #393939)',
          marginBottom: '1px',
        }}
      >
        {lineup.teamLogo && (
          <img
            src={lineup.teamLogo}
            alt=""
            style={{ width: '1.75rem', height: '1.75rem', objectFit: 'contain', flexShrink: 0 }}
          />
        )}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--cds-text-primary, #f4f4f4)',
            }}
          >
            {lineup.teamName}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.125rem' }}>
            <span className="sc-label">
              {t(locale, 'lineup_formation')}: {lineup.formation}
            </span>
            {lineup.formationSource === 'default' && (
              <span style={{ fontSize: '0.625rem', color: 'var(--cds-text-helper, #8d8d8d)' }}>
                ({t(locale, 'lineup_default_formation')})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Pitch visualization */}
      <div style={{ padding: '0.5rem', background: 'var(--cds-layer-01, #262626)' }}>
        <PitchLineup lineup={lineup} />
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function FixtureDetailPage({
  params,
}: {
  params: { leagueId: string; fixtureId: string };
}) {
  const leagueId = parseInt(params.leagueId);
  const fixtureId = parseInt(params.fixtureId);
  const locale = getLocale();
  const leagueName = LEAGUE_NAMES[leagueId] ?? `League ${leagueId}`;
  const fixturesBase = `/league/${leagueId}/fixtures`;

  let fixture: Fixture | null = null;
  let homeImpact: InjuryImpact | null = null;
  let awayImpact: InjuryImpact | null = null;
  let homeLineup: PredictedLineup | null = null;
  let awayLineup: PredictedLineup | null = null;
  let rankMap: Record<number, number> = {};

  try {
    fixture = await fetchApi<Fixture>(`/api/fixtures/${fixtureId}`);
  } catch {}

  if (fixture) {
    try {
      const [hi, ai, hl, al, standing] = await Promise.all([
        fetchApi<InjuryImpact>(`/api/analysis/injury-impact/${fixture.homeTeam.id}`),
        fetchApi<InjuryImpact>(`/api/analysis/injury-impact/${fixture.awayTeam.id}`),
        fetchApi<PredictedLineup>(`/api/analysis/predicted-lineup/${fixture.homeTeam.id}`).catch(() => null),
        fetchApi<PredictedLineup>(`/api/analysis/predicted-lineup/${fixture.awayTeam.id}`).catch(() => null),
        fetchApi<Standing>(`/api/standings?league=${leagueId}&season=2025`).catch(() => null),
      ]);
      homeImpact = hi; awayImpact = ai; homeLineup = hl; awayLineup = al;
      if (standing) {
        for (const e of standing.entries) rankMap[e.team.id] = e.rank;
      }
    } catch {}
  }

  if (!fixture) {
    return (
      <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
        <div
          style={{
            background: 'var(--cds-layer-01, #262626)',
            border: '1px solid var(--cds-border-subtle-01, #393939)',
            padding: '2rem',
            color: 'var(--cds-text-helper, #8d8d8d)',
            fontSize: '0.875rem',
          }}
        >
          Match not found.
        </div>
      </div>
    );
  }

  const roundNum = parseRoundNumber(fixture.round);
  const backUrl = roundNum !== null ? `${fixturesBase}?round=${roundNum}` : fixturesBase;

  return (
    <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
      {/* Back button */}
      <Link
        href={backUrl}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          fontSize: '0.8125rem',
          color: 'var(--cds-text-helper, #8d8d8d)',
          textDecoration: 'none',
          marginBottom: '1rem',
        }}
      >
        ← {t(locale, 'fixtures_title')}
      </Link>

      {/* Breadcrumb & Header */}
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
          <Link
            href={backUrl}
            style={{ color: 'var(--cds-text-helper, #8d8d8d)', textDecoration: 'none' }}
          >
            {t(locale, 'fixtures_title')}
          </Link>
          {' / '}
          {t(locale, 'match_detail')}
        </p>

        {/* Match title */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            marginTop: '0.5rem',
          }}
        >
          <Link
            href={`/team/${fixture.homeTeam.id}?league=${leagueId}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              flex: 1,
              minWidth: 0,
              textDecoration: 'none',
            }}
          >
            {fixture.homeTeam.logo && (
              <img
                src={fixture.homeTeam.logo}
                alt=""
                style={{ width: '2.5rem', height: '2.5rem', objectFit: 'contain', flexShrink: 0 }}
              />
            )}
            <div style={{ minWidth: 0 }}>
              <h1
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  color: 'var(--cds-text-primary, #f4f4f4)',
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {fixture.homeTeam.name}
              </h1>
              {rankMap[fixture.homeTeam.id] && (
                <span style={{ fontSize: '0.75rem', color: 'var(--cds-text-helper, #8d8d8d)', fontFamily: 'var(--font-plex-mono, monospace)' }}>
                  #{rankMap[fixture.homeTeam.id]}
                </span>
              )}
            </div>
          </Link>

          <div
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              color: 'var(--cds-text-helper, #8d8d8d)',
              flexShrink: 0,
              letterSpacing: '1px',
            }}
          >
            vs
          </div>

          <Link
            href={`/team/${fixture.awayTeam.id}?league=${leagueId}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              flex: 1,
              justifyContent: 'flex-end',
              minWidth: 0,
              textDecoration: 'none',
            }}
          >
            <div style={{ minWidth: 0, textAlign: 'right' }}>
              <h1
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  color: 'var(--cds-text-primary, #f4f4f4)',
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {fixture.awayTeam.name}
              </h1>
              {rankMap[fixture.awayTeam.id] && (
                <span style={{ fontSize: '0.75rem', color: 'var(--cds-text-helper, #8d8d8d)', fontFamily: 'var(--font-plex-mono, monospace)' }}>
                  #{rankMap[fixture.awayTeam.id]}
                </span>
              )}
            </div>
            {fixture.awayTeam.logo && (
              <img
                src={fixture.awayTeam.logo}
                alt=""
                style={{ width: '2.5rem', height: '2.5rem', objectFit: 'contain', flexShrink: 0 }}
              />
            )}
          </Link>
        </div>

        {/* Match meta */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            marginTop: '0.625rem',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--cds-interactive, #4589ff)',
              fontWeight: 600,
            }}
          >
            {formatRoundLabel(fixture.round, locale)}
          </span>
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--cds-text-secondary, #c6c6c6)',
              fontFamily: 'var(--font-plex-mono, monospace)',
            }}
          >
            <ClientMatchDateTime dateStr={fixture.date} locale={locale} />
          </span>
          {fixture.venueName && (
            <span style={{ fontSize: '0.75rem', color: 'var(--cds-text-helper, #8d8d8d)' }}>
              {fixture.venueName}
              {fixture.venueCity ? `, ${fixture.venueCity}` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Injury comparison section */}
      <div style={{ marginBottom: '2rem' }}>
        <div
          style={{
            padding: '0.75rem 1rem',
            background: 'var(--cds-layer-02, #393939)',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <span className="sc-label">{t(locale, 'injury_comparison')}</span>
        </div>

        <div className="sc-grid-2col">
          <InjuryColumn impact={homeImpact} locale={locale} side="home" />
          <InjuryColumn impact={awayImpact} locale={locale} side="away" />
        </div>
      </div>

      {/* Predicted lineups */}
      <div>
        <div
          style={{
            padding: '0.75rem 1rem',
            background: 'var(--cds-layer-02, #393939)',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <span className="sc-label">{t(locale, 'predicted_lineups')}</span>
        </div>
        <div className="sc-grid-2col">
          <LineupColumn lineup={homeLineup} locale={locale} />
          <LineupColumn lineup={awayLineup} locale={locale} />
        </div>
      </div>
    </div>
  );
}
