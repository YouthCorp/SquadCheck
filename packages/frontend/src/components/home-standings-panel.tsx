'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import type { Standing } from '@/lib/types';

interface HomeStandingsPanelProps {
  standingsMap: Record<number, Standing | null>;
  locale: Locale;
}

const LEAGUES = [
  { id: 39,  name: 'EPL' },
  { id: 140, name: 'La Liga' },
  { id: 135, name: 'Serie A' },
  { id: 78,  name: 'BL' },
  { id: 61,  name: 'L1' },
];

export function HomeStandingsPanel({ standingsMap, locale }: HomeStandingsPanelProps) {
  const [activeLeague, setActiveLeague] = useState(39);
  const standing = standingsMap[activeLeague];
  const top8 = standing?.entries?.slice(0, 8) ?? [];

  const sectionLabel: React.CSSProperties = {
    fontSize: '0.6875rem',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--cds-text-helper, #8d8d8d)',
  };

  return (
    <div style={{ background: 'var(--cds-layer-01, #262626)', border: '1px solid var(--cds-border-subtle-01, #393939)', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header + tabs */}
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--cds-border-subtle-01, #393939)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={sectionLabel}>{t(locale, 'standings_preview')}</span>
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

      {/* Table */}
      {top8.length === 0 ? (
        <div style={{ padding: '1rem', color: 'var(--cds-text-helper, #8d8d8d)', fontSize: '0.875rem' }}>
          {t(locale, 'no_standings')}
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ background: 'var(--cds-layer-02, #393939)' }}>
              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: 'var(--cds-text-helper, #8d8d8d)', fontWeight: 400, width: '2rem' }}>#</th>
              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--cds-text-helper, #8d8d8d)', fontWeight: 400 }}>{t(locale, 'team')}</th>
              <th style={{ padding: '0.5rem 0.5rem', textAlign: 'center', color: 'var(--cds-text-helper, #8d8d8d)', fontWeight: 400, width: '2rem' }}>{t(locale, 'played')}</th>
              <th style={{ padding: '0.5rem 0.5rem', textAlign: 'center', color: 'var(--cds-text-helper, #8d8d8d)', fontWeight: 400, width: '2.5rem' }}>{t(locale, 'goal_diff')}</th>
              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: 'var(--cds-text-helper, #8d8d8d)', fontWeight: 400, width: '2.5rem' }}>{t(locale, 'points')}</th>
            </tr>
          </thead>
          <tbody>
            {top8.map((entry, idx) => (
              <tr
                key={entry.team.id}
                style={{ borderBottom: '1px solid var(--cds-border-subtle-01, #393939)', background: idx % 2 === 1 ? 'var(--cds-layer-02, #393939)' : 'transparent' }}
              >
                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: 'var(--cds-text-helper, #8d8d8d)', fontFamily: 'var(--font-plex-mono, monospace)' }}>
                  {entry.rank}
                </td>
                <td style={{ padding: '0.5rem 0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    {entry.team.logo && (
                      <img src={entry.team.logo} alt="" width={16} height={16} style={{ objectFit: 'contain', flexShrink: 0 }} />
                    )}
                    <span style={{ color: 'var(--cds-text-primary, #f4f4f4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '9rem' }}>
                      {entry.team.code ?? entry.team.name}
                    </span>
                  </div>
                </td>
                <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center', color: 'var(--cds-text-secondary, #c6c6c6)', fontFamily: 'var(--font-plex-mono, monospace)' }}>
                  {entry.played}
                </td>
                <td style={{
                  padding: '0.5rem 0.5rem',
                  textAlign: 'center',
                  fontFamily: 'var(--font-plex-mono, monospace)',
                  color: entry.goalsDiff > 0 ? 'var(--sc-green, #42be65)' : entry.goalsDiff < 0 ? 'var(--sc-red, #fa4d56)' : 'var(--cds-text-secondary, #c6c6c6)',
                }}>
                  {entry.goalsDiff > 0 ? `+${entry.goalsDiff}` : entry.goalsDiff}
                </td>
                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 600, color: 'var(--cds-text-primary, #f4f4f4)', fontFamily: 'var(--font-plex-mono, monospace)' }}>
                  {entry.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Footer link */}
      <div style={{ padding: '0.625rem 1rem', borderTop: '1px solid var(--cds-border-subtle-01, #393939)' }}>
        <Link href={`/league/${activeLeague}`} style={{ fontSize: '0.75rem', color: 'var(--cds-interactive, #4589ff)', textDecoration: 'none' }}>
          {t(locale, 'view_full_standings')}
        </Link>
      </div>
    </div>
  );
}
