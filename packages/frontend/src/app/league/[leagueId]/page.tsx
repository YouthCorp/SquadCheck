import { fetchApi } from '@/lib/api';
import Link from 'next/link';
import { getLocale } from '@/lib/locale';
import { t } from '@/lib/i18n';
import { LEAGUE_NAMES } from '@/lib/constants';

interface StandingEntry {
  rank: number; points: number; played: number; wins: number; draws: number; losses: number;
  goalsFor: number; goalsAgainst: number; goalsDiff: number; form: string | null;
  team: { id: number; name: string; logo: string | null; code: string | null };
}
interface Standing { id: number; entries: StandingEntry[]; }

export default async function LeaguePage({ params }: { params: { leagueId: string } }) {
  const leagueId = parseInt(params.leagueId);
  const locale = getLocale();

  let standing: Standing | null = null;
  try { standing = await fetchApi<Standing>(`/api/standings?league=${leagueId}`); } catch {}

  const col: React.CSSProperties = {
    padding: '0.75rem 1rem',
    textAlign: 'left',
    whiteSpace: 'nowrap',
  };
  const colNum: React.CSSProperties = { ...col, textAlign: 'center' };

  return (
    <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--cds-border-subtle-01, #393939)' }}>
        <p className="sc-label">{t(locale, 'nav_leagues')}</p>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 300, color: 'var(--cds-text-primary, #f4f4f4)', margin: 0 }}>
          {LEAGUE_NAMES[leagueId] ?? `League ${leagueId}`}
        </h1>
      </div>

      {standing?.entries ? (
        <div className="cds--data-table-container sc-table-scroll">
          <table
            className="cds--data-table cds--data-table--zebra"
            style={{ width: '100%', borderCollapse: 'collapse' }}
          >
            <thead>
              <tr style={{ background: 'var(--cds-layer-02, #393939)' }}>
                {[
                  { label: '#', style: colNum },
                  { label: t(locale, 'team'), style: { ...col, minWidth: '10rem' } },
                  { label: t(locale, 'played'), style: colNum },
                  { label: t(locale, 'wins'), style: colNum },
                  { label: t(locale, 'draws'), style: colNum },
                  { label: t(locale, 'losses'), style: colNum },
                  { label: t(locale, 'goals_for'), style: colNum },
                  { label: t(locale, 'goals_against'), style: colNum },
                  { label: t(locale, 'goal_diff'), style: colNum },
                  { label: t(locale, 'points'), style: colNum },
                  { label: t(locale, 'form'), style: colNum },
                ].map((h) => (
                  <th
                    key={h.label}
                    style={{
                      ...h.style,
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      letterSpacing: '0.32px',
                      textTransform: 'uppercase',
                      color: 'var(--cds-text-secondary, #c6c6c6)',
                      borderBottom: '1px solid var(--cds-border-strong-01, #6f6f6f)',
                    }}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {standing.entries.map((entry, idx) => (
                <tr
                  key={entry.team.id}
                  className="sc-row-hover"
                  style={{
                    background: idx % 2 === 0 ? 'var(--cds-layer-01, #262626)' : 'var(--cds-layer-accent-01, #2e2e2e)',
                    borderBottom: '1px solid var(--cds-border-subtle-01, #393939)',
                  }}
                >
                  <td style={{ ...colNum, color: 'var(--cds-text-helper, #8d8d8d)', fontSize: '0.8125rem', fontWeight: 600 }}>
                    {entry.rank}
                  </td>
                  <td style={col}>
                    <Link href={`/team/${entry.team.id}?league=${leagueId}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      {entry.team.logo && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '1.25rem', height: '1.25rem', flexShrink: 0 }}>
                          <img src={entry.team.logo} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        </span>
                      )}
                      <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--cds-text-primary, #f4f4f4)' }}>
                        {entry.team.name}
                      </span>
                    </Link>
                  </td>
                  {[entry.played, entry.wins, entry.draws, entry.losses, entry.goalsFor, entry.goalsAgainst].map((v, i) => (
                    <td key={i} style={{ ...colNum, fontSize: '0.875rem', color: 'var(--cds-text-secondary, #c6c6c6)', fontFamily: 'var(--font-plex-mono, monospace)' }}>
                      {v}
                    </td>
                  ))}
                  <td style={{ ...colNum, fontSize: '0.875rem', fontFamily: 'var(--font-plex-mono, monospace)', fontWeight: 600 }}>
                    <span style={{ color: entry.goalsDiff > 0 ? 'var(--sc-green)' : entry.goalsDiff < 0 ? 'var(--sc-red)' : 'var(--cds-text-secondary)' }}>
                      {entry.goalsDiff > 0 ? '+' : ''}{entry.goalsDiff}
                    </span>
                  </td>
                  <td style={{ ...colNum, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--cds-text-primary, #f4f4f4)', fontFamily: 'var(--font-plex-mono, monospace)' }}>
                    {entry.points}
                  </td>
                  <td style={colNum}>
                    {entry.form && (
                      <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                        {entry.form.split('').map((c, i) => (
                          <span
                            key={i}
                            className={c === 'W' ? 'sc-form-w' : c === 'D' ? 'sc-form-d' : 'sc-form-l'}
                            style={{ width: '1.125rem', height: '1.125rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ background: 'var(--cds-layer-01, #262626)', border: '1px solid var(--cds-border-subtle-01, #393939)', padding: '2rem', color: 'var(--cds-text-helper, #8d8d8d)', fontSize: '0.875rem' }}>
          {t(locale, 'no_standings')}
        </div>
      )}
    </div>
  );
}
