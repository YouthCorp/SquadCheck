'use client';

import { useState } from 'react';
import type { Locale } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import type { InjuryImpact } from '@/lib/types';
import { HomeInjuryCard } from './home-injury-card';

interface HomeInjuryWatchPanelProps {
  injuryMap: Record<number, InjuryImpact[]>;
  locale: Locale;
}

const LEAGUES = [
  { id: 39,  name: 'EPL' },
  { id: 140, name: 'La Liga' },
  { id: 135, name: 'Serie A' },
  { id: 78,  name: 'BL' },
  { id: 61,  name: 'L1' },
];

export function HomeInjuryWatchPanel({ injuryMap, locale }: HomeInjuryWatchPanelProps) {
  const [activeLeague, setActiveLeague] = useState(39);
  const impacts = injuryMap[activeLeague] ?? [];

  const sectionLabel: React.CSSProperties = {
    fontSize: '0.6875rem',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--cds-text-helper, #8d8d8d)',
  };

  return (
    <div style={{ marginBottom: '2rem' }}>
      {/* Section header */}
      <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <span style={sectionLabel}>{t(locale, 'injury_watch')}</span>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {LEAGUES.map((lg) => (
            <button
              key={lg.id}
              className={`sc-tab-btn${activeLeague === lg.id ? ' sc-tab-btn--active' : ''}`}
              onClick={() => setActiveLeague(lg.id)}
              style={{ fontSize: '0.6875rem', padding: '0.25rem 0.5rem' }}
            >
              {lg.name}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      {impacts.length === 0 ? (
        <div style={{ padding: '1.5rem', background: 'var(--cds-layer-01, #262626)', border: '1px solid var(--cds-border-subtle-01, #393939)', color: 'var(--cds-text-helper, #8d8d8d)', fontSize: '0.875rem' }}>
          {t(locale, 'no_injuries')}
        </div>
      ) : (
        <div className="sc-grid-injury-watch">
          {impacts.slice(0, 4).map((impact) => (
            <HomeInjuryCard key={impact.team.id} impact={impact} locale={locale} leagueId={activeLeague} />
          ))}
        </div>
      )}
    </div>
  );
}
