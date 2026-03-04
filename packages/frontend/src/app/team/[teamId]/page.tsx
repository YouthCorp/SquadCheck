import { fetchApi } from '@/lib/api';
import Link from 'next/link';
import { getLocale } from '@/lib/locale';
import { t, tPos } from '@/lib/i18n';
import type { Team, InjuryImpact } from '@/lib/types';
import { InjuredPlayerCard } from '@/components/injured-player-card';
interface PlayerEntry {
  player: { id: number; name: string; photo: string | null; position: string | null; nationality: string | null };
  minutes: number | null; rating: number | null; goalsTotal: number | null; assists: number | null; appearances: number | null;
}


const backLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.375rem',
  fontSize: '0.8125rem',
  color: 'var(--cds-text-helper, #8d8d8d)',
  textDecoration: 'none',
  marginBottom: '1rem',
  transition: 'color 0.1s',
};

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: { teamId: string };
  searchParams: { league?: string };
}) {
  const teamId = parseInt(params.teamId);
  const locale = getLocale();
  const backLeagueId = searchParams.league ? parseInt(searchParams.league) : null;

  let impact: InjuryImpact | null = null;
  let players: PlayerEntry[] = [];
  try {
    [impact, players] = await Promise.all([
      fetchApi<InjuryImpact>(`/api/analysis/injury-impact/${teamId}`),
      fetchApi<PlayerEntry[]>(`/api/teams/${teamId}/players`),
    ]);
  } catch {}

  const team = impact?.team;
  const ss = impact?.severitySummary;
  const highImpact = impact?.injuredPlayers.filter(p => p.severity === 'critical' || p.severity === 'high') ?? [];
  const otherInjured = impact?.injuredPlayers.filter(p => p.severity === 'moderate' || p.severity === 'low') ?? [];

  const tile: React.CSSProperties = { background: 'var(--cds-layer-01, #262626)', border: '1px solid var(--cds-border-subtle-01, #393939)', padding: '1.25rem 1rem', marginBottom: '1px' };
  const col: React.CSSProperties = { padding: '0.625rem 1rem', textAlign: 'left' };
  const colC: React.CSSProperties = { ...col, textAlign: 'center' };

  return (
    <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
      {/* Back button */}
      {backLeagueId && (
        <Link href={`/league/${backLeagueId}`} style={backLinkStyle}>
          ← {t(locale, 'nav_standings')}
        </Link>
      )}

      {/* Team header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--cds-border-subtle-01, #393939)' }}>
        {team?.logo && (
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '3.5rem', height: '3.5rem', flexShrink: 0 }}>
            <img src={team.logo} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </span>
        )}
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 300, color: 'var(--cds-text-primary, #f4f4f4)', margin: 0 }}>
            {team?.name ?? `Team ${teamId}`}
          </h1>
          {team?.country && (
            <p style={{ fontSize: '0.75rem', color: 'var(--cds-text-helper, #8d8d8d)', margin: '0.25rem 0 0', letterSpacing: '0.32px' }}>
              {team.country}{team.founded ? ` · ${t(locale, 'founded')} ${team.founded}` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Injury status overview */}
      {impact && (
        <div style={{ marginBottom: '1px' }}>
          <div style={{ ...tile, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 }}>
            <div className="sc-label">{t(locale, 'injury_status')}</div>
            <span style={{ fontSize: '0.75rem', color: 'var(--cds-text-helper, #8d8d8d)' }}>
              {impact.season}/{impact.season + 1} {t(locale, 'season')}
            </span>
          </div>
          <div className="sc-grid-4col">
            <div style={{ background: 'var(--cds-layer-01, #262626)', padding: '1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 300, color: 'var(--cds-text-primary, #f4f4f4)', fontFamily: 'var(--font-plex-mono, monospace)' }}>{impact.injuredPlayers.length}</div>
              <div className="sc-label" style={{ marginTop: '0.25rem' }}>{t(locale, 'players_out')}</div>
            </div>
            {ss && ss.critical + ss.high > 0 && (
              <div style={{ background: 'var(--cds-layer-01, #262626)', padding: '1.25rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 300, color: 'var(--sc-red)', fontFamily: 'var(--font-plex-mono, monospace)' }}>{ss.critical + ss.high}</div>
                <div className="sc-label" style={{ marginTop: '0.25rem' }}>{t(locale, 'key_players')}</div>
              </div>
            )}
            {ss && ss.moderate > 0 && (
              <div style={{ background: 'var(--cds-layer-01, #262626)', padding: '1.25rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 300, color: 'var(--sc-yellow)', fontFamily: 'var(--font-plex-mono, monospace)' }}>{ss.moderate}</div>
                <div className="sc-label" style={{ marginTop: '0.25rem' }}>{t(locale, 'moderate')}</div>
              </div>
            )}
            {ss && ss.low > 0 && (
              <div style={{ background: 'var(--cds-layer-01, #262626)', padding: '1.25rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 300, color: 'var(--cds-text-secondary, #c6c6c6)', fontFamily: 'var(--font-plex-mono, monospace)' }}>{ss.low}</div>
                <div className="sc-label" style={{ marginTop: '0.25rem' }}>{t(locale, 'low_impact')}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Key injuries */}
      {highImpact.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1px', padding: '0.75rem 1rem', background: 'var(--cds-layer-02, #393939)' }}>
            <span className="sc-label" style={{ color: '#ff8389' }}>{t(locale, 'key_absences')}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--cds-border-subtle-01, #393939)' }}>
            {highImpact.map((ip) => (
              <InjuredPlayerCard
                key={ip.player.id}
                ip={ip}
                locale={locale}
                variant="team"
                severity="high"
                playerLinkSuffix={`?team=${teamId}${backLeagueId ? `&league=${backLeagueId}` : ''}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other injuries */}
      {otherInjured.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ padding: '0.75rem 1rem', background: 'var(--cds-layer-02, #393939)', marginBottom: '1px' }}>
            <span className="sc-label">{t(locale, 'other_injuries')}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--cds-border-subtle-01, #393939)' }}>
            {otherInjured.map((ip) => (
              <InjuredPlayerCard
                key={ip.player.id}
                ip={ip}
                locale={locale}
                variant="team"
                severity="other"
                playerLinkSuffix={`?team=${teamId}${backLeagueId ? `&league=${backLeagueId}` : ''}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Squad table */}
      {players.length > 0 && (
        <div>
          <div style={{ padding: '0.75rem 1rem', background: 'var(--cds-layer-02, #393939)', marginBottom: '1px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="sc-label">{t(locale, 'squad')}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--cds-text-helper, #8d8d8d)' }}>{impact?.season} {t(locale, 'season')}</span>
          </div>
          <div className="sc-table-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--cds-layer-01, #262626)' }}>
            <thead>
              <tr style={{ background: 'var(--cds-layer-02, #393939)' }}>
                {[
                  { l: t(locale, 'player'), s: col },
                  { l: t(locale, 'position'), s: colC },
                  { l: t(locale, 'app'), s: colC },
                  { l: t(locale, 'min'), s: colC },
                  { l: t(locale, 'rating'), s: colC },
                  { l: t(locale, 'goals'), s: colC },
                  { l: t(locale, 'assists'), s: colC },
                ].map((h) => (
                  <th key={h.l} style={{ ...h.s, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.32px', textTransform: 'uppercase', color: 'var(--cds-text-secondary, #c6c6c6)', borderBottom: '1px solid var(--cds-border-strong-01, #6f6f6f)' }}>{h.l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.slice(0, 30).map((p, idx) => (
                <tr key={p.player.id} style={{ borderBottom: '1px solid var(--cds-border-subtle-01, #393939)', background: idx % 2 === 0 ? 'var(--cds-layer-01, #262626)' : 'var(--cds-layer-accent-01, #2e2e2e)' }}>
                  <td style={col}>
                    <Link href={`/player/${p.player.id}?team=${teamId}${backLeagueId ? `&league=${backLeagueId}` : ''}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {p.player.photo && <img src={p.player.photo} alt="" style={{ width: '1.5rem', height: '1.5rem', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />}
                      <span style={{ fontSize: '0.875rem', color: 'var(--cds-text-primary, #f4f4f4)' }}>{p.player.name}</span>
                    </Link>
                  </td>
                  <td style={{ ...colC, fontSize: '0.75rem', color: 'var(--cds-text-helper, #8d8d8d)' }}>{tPos(locale, p.player.position)}</td>
                  <td style={{ ...colC, fontSize: '0.875rem', color: 'var(--cds-text-secondary, #c6c6c6)', fontFamily: 'var(--font-plex-mono, monospace)' }}>{p.appearances ?? '—'}</td>
                  <td style={{ ...colC, fontSize: '0.875rem', color: 'var(--cds-text-secondary, #c6c6c6)', fontFamily: 'var(--font-plex-mono, monospace)' }}>{p.minutes ?? '—'}</td>
                  <td style={{ ...colC, fontFamily: 'var(--font-plex-mono, monospace)', fontSize: '0.875rem' }}>
                    {p.rating ? (
                      <span style={{ color: p.rating >= 7 ? 'var(--sc-green)' : p.rating >= 6.5 ? 'var(--sc-yellow)' : 'var(--cds-text-secondary)' }}>{p.rating.toFixed(2)}</span>
                    ) : '—'}
                  </td>
                  <td style={{ ...colC, fontSize: '0.875rem', color: 'var(--cds-text-secondary, #c6c6c6)', fontFamily: 'var(--font-plex-mono, monospace)' }}>{p.goalsTotal ?? '—'}</td>
                  <td style={{ ...colC, fontSize: '0.875rem', color: 'var(--cds-text-secondary, #c6c6c6)', fontFamily: 'var(--font-plex-mono, monospace)' }}>{p.assists ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
