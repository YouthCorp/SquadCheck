import { fetchApi } from '@/lib/api';
import Link from 'next/link';
import { getLocale } from '@/lib/locale';
import { t, tPos } from '@/lib/i18n';
import { isDisciplinaryReason, fmtDate, fmtRound } from '@/lib/format';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: { playerId: string };
}): Promise<Metadata> {
  const playerId = parseInt(params.playerId);
  try {
    const player = await fetchApi<Player>(`/api/players/${playerId}`);
    const title = player.name;
    const pos = player.position ?? '';
    const nat = player.nationality ?? '';
    const description = `${player.name}${pos ? ` (${pos})` : ''}${nat ? ` · ${nat}` : ''} — injury history, season stats, and recovery status across European leagues.`;
    return {
      title,
      description,
      openGraph: { title: `${player.name} | SquadCheck`, description },
      alternates: { canonical: `/player/${playerId}` },
    };
  } catch {
    return { title: 'Player Profile' };
  }
}

interface Player {
  id: number; name: string; firstName: string | null; lastName: string | null;
  nationality: string | null; birthDate: string | null; height: string | null;
  weight: string | null; photo: string | null; position: string | null;
  seasonStats: {
    appearances: number | null; minutes: number | null; rating: number | null;
    goalsTotal: number | null; assists: number | null; yellowCards: number | null; redCards: number | null;
    season: { year: number; league: { name: string; logo: string | null } };
  }[];
}

interface Injury {
  id: number; type: string; reason: string; fixtureDate: string; season: number;
  team: { id: number; name: string; logo: string | null };
  league: { id: number; name: string };
  fixture: {
    id: number; date: string; round: string | null;
    homeTeam: { id: number; name: string; logo: string | null } | null;
    awayTeam: { id: number; name: string; logo: string | null } | null;
    goalsHome: number | null; goalsAway: number | null;
  } | null;
}

interface Appearance {
  teamId: number; fixtureId: number; date: string; round: string | null; season: number;
  homeTeam: { id: number; name: string }; awayTeam: { id: number; name: string };
}

interface InjuryEpisode {
  reason: string; type: string; missedCount: number; ongoing: boolean;
  isDisciplinary: boolean;
  injuredInMatch: { date: string; round: string | null; opponentName: string; homeAway: 'H' | 'A' } | null;
}


function buildEpisodes(injuries: Injury[], appearances: Appearance[]): Map<number, InjuryEpisode[]> {
  const sortedApps = [...appearances].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const bySeason = new Map<number, Injury[]>();
  for (const inj of injuries) {
    if (!bySeason.has(inj.season)) bySeason.set(inj.season, []);
    bySeason.get(inj.season)!.push(inj);
  }
  const result = new Map<number, InjuryEpisode[]>();
  bySeason.forEach((seasonInjuries, season) => {
    const sorted = [...seasonInjuries].sort((a, b) => new Date(a.fixtureDate).getTime() - new Date(b.fixtureDate).getTime());
    const episodes: InjuryEpisode[] = [];
    let cur: { reason: string; type: string; count: number; firstMissDate: Date; lastMissDate: Date } | null = null;
    for (const inj of sorted) {
      if (inj.type !== 'Missing Fixture') {
        if (cur) { episodes.push(finalize(cur, sortedApps, false)); cur = null; }
        episodes.push({ reason: inj.reason, type: inj.type, missedCount: 0, ongoing: false, isDisciplinary: isDisciplinaryReason(inj.reason), injuredInMatch: null });
        continue;
      }
      const injDate = new Date(inj.fixtureDate);
      if (cur && cur.reason === inj.reason) {
        // Split into a new episode if the player appeared between the last miss and this miss
        // (i.e., they returned from the previous suspension/injury before this new one)
        const returnedBetween = sortedApps.some(
          app => new Date(app.date) > cur!.lastMissDate && new Date(app.date) < injDate
        );
        if (returnedBetween) {
          episodes.push(finalize(cur, sortedApps, false));
          cur = { reason: inj.reason, type: 'Missing Fixture', count: 1, firstMissDate: injDate, lastMissDate: injDate };
        } else {
          cur.count++;
          cur.lastMissDate = injDate;
        }
      } else {
        if (cur) episodes.push(finalize(cur, sortedApps, false));
        cur = { reason: inj.reason, type: 'Missing Fixture', count: 1, firstMissDate: injDate, lastMissDate: injDate };
      }
    }
    if (cur) episodes.push(finalize(cur, sortedApps, true));
    result.set(season, episodes.reverse());
  });
  return result;
}

function finalize(raw: { reason: string; type: string; count: number; firstMissDate: Date; lastMissDate: Date }, apps: Appearance[], isLast: boolean): InjuryEpisode {
  let match: InjuryEpisode['injuredInMatch'] = null;
  for (let i = apps.length - 1; i >= 0; i--) {
    const app = apps[i];
    if (new Date(app.date).getTime() < raw.firstMissDate.getTime()) {
      const isHome = app.homeTeam.id === app.teamId;
      match = { date: app.date, round: app.round, opponentName: isHome ? app.awayTeam.name : app.homeTeam.name, homeAway: isHome ? 'H' : 'A' };
      break;
    }
  }
  const hasReturnedAfter = isLast ? apps.some(app => new Date(app.date) > raw.lastMissDate) : false;
  return { reason: raw.reason, type: raw.type, missedCount: raw.count, ongoing: isLast && !hasReturnedAfter, isDisciplinary: isDisciplinaryReason(raw.reason), injuredInMatch: match };
}

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: { playerId: string };
  searchParams: { team?: string; league?: string };
}) {
  const playerId = parseInt(params.playerId);
  const locale = getLocale();
  const backTeamId = searchParams.team ? parseInt(searchParams.team) : null;
  const backLeagueId = searchParams.league ? parseInt(searchParams.league) : null;

  let player: Player | null = null;
  let injuries: Injury[] = [];
  let appearances: Appearance[] = [];

  try {
    const [pd, id_] = await Promise.all([
      fetchApi<Player>(`/api/players/${playerId}`),
      fetchApi<{ injuries: Injury[]; appearances: Appearance[] }>(`/api/players/${playerId}/injuries`),
    ]);
    player = pd;
    if (Array.isArray(id_)) { injuries = id_ as unknown as Injury[]; }
    else { injuries = id_.injuries ?? []; appearances = id_.appearances ?? []; }
  } catch {}

  if (!player) {
    return <div style={{ color: 'var(--cds-text-helper, #8d8d8d)', padding: '2rem' }}>{t(locale, 'player_not_found')}</div>;
  }

  const episodesBySeason = buildEpisodes(injuries, appearances);
  const sortedSeasons = Array.from(episodesBySeason.keys()).sort((a, b) => b - a);

  const col: React.CSSProperties = { padding: '0.625rem 1rem', textAlign: 'left' };
  const colC: React.CSSProperties = { ...col, textAlign: 'center' };

  return (
    <div style={{ maxWidth: '56rem', margin: '0 auto' }}>
      {/* Back button */}
      {backTeamId && (
        <Link
          href={`/team/${backTeamId}${backLeagueId ? `?league=${backLeagueId}` : ''}`}
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
          ← {t(locale, 'squad')}
        </Link>
      )}

      {/* Player header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--cds-border-subtle-01, #393939)' }}>
        {player.photo && <img src={player.photo} alt="" style={{ width: '5rem', height: '5rem', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--cds-border-subtle-01, #393939)' }} />}
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 300, color: 'var(--cds-text-primary, #f4f4f4)', margin: 0 }}>{player.name}</h1>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.375rem' }}>
            {[tPos(locale, player.position), player.nationality, player.birthDate && fmtDate(player.birthDate), player.height].filter(Boolean).map((v, i) => (
              <span key={i} style={{ fontSize: '0.75rem', color: 'var(--cds-text-helper, #8d8d8d)' }}>{v}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Season stats */}
      {player.seasonStats.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ padding: '0.75rem 1rem', background: 'var(--cds-layer-02, #393939)', marginBottom: '1px' }}>
            <span className="sc-label">{t(locale, 'season_stats')}</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--cds-layer-01, #262626)' }}>
            <thead>
              <tr style={{ background: 'var(--cds-layer-02, #393939)' }}>
                {[
                  { l: t(locale, 'season'), s: col },
                  { l: t(locale, 'league'), s: col },
                  { l: t(locale, 'app'), s: colC },
                  { l: t(locale, 'min'), s: colC },
                  { l: t(locale, 'rating'), s: colC },
                  { l: t(locale, 'goals'), s: colC },
                  { l: t(locale, 'assists'), s: colC },
                  { l: t(locale, 'yellow_cards'), s: colC },
                  { l: t(locale, 'red_cards'), s: colC },
                ].map((h) => (
                  <th key={h.l} style={{ ...h.s, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.32px', textTransform: 'uppercase', color: 'var(--cds-text-secondary, #c6c6c6)', borderBottom: '1px solid var(--cds-border-strong-01, #6f6f6f)' }}>{h.l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {player.seasonStats.map((s, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--cds-border-subtle-01, #393939)', background: i % 2 === 0 ? 'var(--cds-layer-01, #262626)' : 'var(--cds-layer-accent-01, #2e2e2e)' }}>
                  <td style={{ ...col, fontFamily: 'var(--font-plex-mono, monospace)', fontSize: '0.875rem', color: 'var(--cds-text-primary, #f4f4f4)', fontWeight: 600 }}>{s.season.year}/{(s.season.year + 1).toString().slice(2)}</td>
                  <td style={{ ...col, fontSize: '0.875rem', color: 'var(--cds-text-secondary, #c6c6c6)' }}>{s.season.league.name}</td>
                  {[s.appearances, s.minutes].map((v, j) => (
                    <td key={j} style={{ ...colC, fontFamily: 'var(--font-plex-mono, monospace)', fontSize: '0.875rem', color: 'var(--cds-text-secondary, #c6c6c6)' }}>{v ?? '—'}</td>
                  ))}
                  <td style={{ ...colC, fontFamily: 'var(--font-plex-mono, monospace)', fontSize: '0.875rem' }}>
                    {s.rating ? <span style={{ color: s.rating >= 7 ? 'var(--sc-green)' : s.rating >= 6.5 ? 'var(--sc-yellow)' : 'var(--cds-text-secondary)' }}>{s.rating.toFixed(2)}</span> : '—'}
                  </td>
                  {[s.goalsTotal, s.assists].map((v, j) => (
                    <td key={j} style={{ ...colC, fontFamily: 'var(--font-plex-mono, monospace)', fontSize: '0.875rem', color: 'var(--cds-text-secondary, #c6c6c6)' }}>{v ?? '—'}</td>
                  ))}
                  <td style={{ ...colC, fontFamily: 'var(--font-plex-mono, monospace)', fontSize: '0.875rem', color: 'var(--sc-yellow)' }}>{s.yellowCards ?? '—'}</td>
                  <td style={{ ...colC, fontFamily: 'var(--font-plex-mono, monospace)', fontSize: '0.875rem', color: 'var(--sc-red)' }}>{s.redCards ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Injury history */}
      {sortedSeasons.length > 0 && (
        <div>
          <div style={{ padding: '0.75rem 1rem', background: 'var(--cds-layer-02, #393939)', marginBottom: '1px' }}>
            <span className="sc-label">{t(locale, 'injury_history')}</span>
          </div>
          <div style={{ background: 'var(--cds-layer-01, #262626)', border: '1px solid var(--cds-border-subtle-01, #393939)' }}>
            {sortedSeasons.map((yr, si) => {
              const episodes = episodesBySeason.get(yr)!;
              const issueLabel = episodes.length === 1 ? t(locale, 'issue_singular') : t(locale, 'issue_plural');
              return (
                <div key={yr} style={{ borderBottom: si < sortedSeasons.length - 1 ? '1px solid var(--cds-border-subtle-01, #393939)' : 'none' }}>
                  {/* Season sub-header */}
                  <div style={{ padding: '0.5rem 1rem', background: 'var(--cds-layer-02, #393939)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--cds-text-secondary, #c6c6c6)' }}>
                      {yr}/{(yr + 1).toString().slice(2)} {t(locale, 'season')}
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--cds-text-helper, #8d8d8d)' }}>
                      {episodes.length} {issueLabel}
                    </span>
                  </div>
                  {/* Episode rows */}
                  {episodes.map((ep, i) => {
                    const isMissed = ep.type === 'Missing Fixture';
                    const match = ep.injuredInMatch;
                    const missedLabel = ep.missedCount === 1 ? t(locale, 'match_missed_singular') : t(locale, 'match_missed_plural');
                    // Disciplinary absences (red card, suspension) get an orange badge; injuries get red
                    const statusTag = !isMissed
                      ? 'sc-tag--yellow'
                      : ep.isDisciplinary
                        ? 'sc-tag--orange'
                        : 'sc-tag--red';
                    const statusLabel = !isMissed
                      ? t(locale, 'status_doubtful')
                      : ep.isDisciplinary
                        ? t(locale, 'status_suspended')
                        : t(locale, 'status_out');
                    const matchContextLabel = ep.isDisciplinary
                      ? t(locale, 'disciplinary_in_match')
                      : t(locale, 'injury_in_match');
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: i < episodes.length - 1 ? '1px solid var(--cds-border-subtle-01, #393939)' : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                          <span className={`sc-tag ${statusTag}`} style={{ marginTop: '1px', flexShrink: 0 }}>
                            {statusLabel}
                          </span>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--cds-text-primary, #f4f4f4)' }}>{ep.reason}</span>
                              {isMissed && ep.missedCount > 0 && (
                                <span className="sc-tag sc-tag--gray">
                                  {ep.missedCount} {missedLabel}{ep.ongoing ? ` · ${t(locale, 'ongoing')}` : ''}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-helper, #8d8d8d)', marginTop: '0.25rem' }}>
                              {match ? (
                                <span>{matchContextLabel}: {fmtRound(match.round)} · vs {match.opponentName} ({match.homeAway})</span>
                              ) : isMissed ? (
                                <span>{t(locale, 'injured_before_season')}</span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        {match && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-helper, #8d8d8d)', flexShrink: 0, marginLeft: '1rem', fontFamily: 'var(--font-plex-mono, monospace)' }}>
                            {fmtDate(match.date)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
