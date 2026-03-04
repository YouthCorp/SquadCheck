import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import type { FixtureWithLeague } from '@/lib/types';
import { LEAGUE_API_ID_BY_NAME } from '@/lib/constants';

interface HomeFixturesListProps {
  fixtures: FixtureWithLeague[];
  locale: Locale;
}

function formatDate(dateStr: string, locale: Locale): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-GB', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function HomeFixturesList({ fixtures, locale }: HomeFixturesListProps) {
  const sectionLabel: React.CSSProperties = {
    fontSize: '0.6875rem',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--cds-text-helper, #8d8d8d)',
    marginBottom: '0.75rem',
  };

  return (
    <div style={{ background: 'var(--cds-layer-01, #262626)', border: '1px solid var(--cds-border-subtle-01, #393939)', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--cds-border-subtle-01, #393939)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={sectionLabel}>{t(locale, 'upcoming_fixtures')}</span>
        <Link href="/league/39/fixtures" style={{ fontSize: '0.75rem', color: 'var(--cds-interactive, #4589ff)', textDecoration: 'none' }}>
          {t(locale, 'view_all_fixtures')}
        </Link>
      </div>

      {fixtures.length === 0 ? (
        <div style={{ padding: '1.5rem 1rem', color: 'var(--cds-text-helper, #8d8d8d)', fontSize: '0.875rem' }}>
          {t(locale, 'no_fixtures')}
        </div>
      ) : (
        <div>
          {fixtures.map((fix) => {
            const leagueName = fix.league?.name ?? '';
            const apiId = LEAGUE_API_ID_BY_NAME[leagueName];
            const href = apiId ? `/league/${apiId}/fixtures/${fix.id}` : '#';

            return (
              <Link key={fix.id} href={href} style={{ textDecoration: 'none', display: 'block' }}>
                <div
                  className="sc-tile-hover"
                  style={{
                    padding: '0.625rem 1rem',
                    borderBottom: '1px solid var(--cds-border-subtle-01, #393939)',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: '0.5rem',
                    alignItems: 'center',
                  }}
                >
                  {/* Teams */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', minWidth: 0 }}>
                    {fix.homeTeam.logo && (
                      <img src={fix.homeTeam.logo} alt="" width={16} height={16} style={{ objectFit: 'contain', flexShrink: 0 }} />
                    )}
                    <span style={{ fontSize: '0.8125rem', color: 'var(--cds-text-primary, #f4f4f4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '7rem' }}>
                      {fix.homeTeam.name}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--cds-text-helper, #8d8d8d)', flexShrink: 0 }}>vs</span>
                    {fix.awayTeam.logo && (
                      <img src={fix.awayTeam.logo} alt="" width={16} height={16} style={{ objectFit: 'contain', flexShrink: 0 }} />
                    )}
                    <span style={{ fontSize: '0.8125rem', color: 'var(--cds-text-primary, #f4f4f4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '7rem' }}>
                      {fix.awayTeam.name}
                    </span>
                  </div>

                  {/* Date */}
                  <span style={{ fontSize: '0.75rem', color: 'var(--cds-text-helper, #8d8d8d)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {formatDate(fix.date, locale)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
