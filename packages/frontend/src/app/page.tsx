import Link from 'next/link';
import { getLocale } from '@/lib/locale';
import { t } from '@/lib/i18n';

const leagues = [
  { id: 39,  name: 'Premier League', countryKey: 'country_england' as const, flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 140, name: 'La Liga',        countryKey: 'country_spain' as const,   flag: '🇪🇸' },
  { id: 135, name: 'Serie A',        countryKey: 'country_italy' as const,   flag: '🇮🇹' },
  { id: 78,  name: 'Bundesliga',     countryKey: 'country_germany' as const, flag: '🇩🇪' },
  { id: 61,  name: 'Ligue 1',        countryKey: 'country_france' as const,  flag: '🇫🇷' },
];

const steps = [
  { titleKey: 'step1_title', descKey: 'step1_desc' } as const,
  { titleKey: 'step2_title', descKey: 'step2_desc' } as const,
  { titleKey: 'step3_title', descKey: 'step3_desc' } as const,
];

export default function Home() {
  const locale = getLocale();

  return (
    <div style={{ maxWidth: '64rem', margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: '2rem', borderBottom: '1px solid var(--cds-border-subtle-01, #393939)', paddingBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 300, color: 'var(--cds-text-primary, #f4f4f4)', margin: 0, letterSpacing: '-0.5px' }}>
          <span style={{ color: 'var(--cds-interactive, #4589ff)', fontWeight: 600 }}>Squad</span>Check
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary, #c6c6c6)', marginTop: '0.5rem', lineHeight: 1.5 }}>
          {t(locale, 'home_subtitle')}
        </p>
      </div>

      {/* League tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1px', background: 'var(--cds-border-subtle-01, #393939)', marginBottom: '2rem' }}>
        {leagues.map((league) => (
          <Link key={league.id} href={`/league/${league.id}`} style={{ textDecoration: 'none' }}>
            <div
              className="sc-tile-hover"
              style={{
                padding: '1.25rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.875rem',
                height: '100%',
              }}
            >
              <span style={{ fontSize: '2rem', lineHeight: 1 }}>{league.flag}</span>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--cds-text-primary, #f4f4f4)' }}>
                  {league.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-helper, #8d8d8d)', marginTop: '2px' }}>
                  {t(locale, league.countryKey)}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* How it works */}
      <div style={{ background: 'var(--cds-layer-01, #262626)', border: '1px solid var(--cds-border-subtle-01, #393939)', padding: '1.5rem' }}>
        <div className="sc-label" style={{ marginBottom: '1rem' }}>{t(locale, 'how_it_works')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
          {steps.map((s) => (
            <div key={s.titleKey}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--cds-interactive, #4589ff)', marginBottom: '0.375rem' }}>
                {t(locale, s.titleKey)}
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--cds-text-secondary, #c6c6c6)', lineHeight: 1.5, margin: 0 }}>
                {t(locale, s.descKey)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
