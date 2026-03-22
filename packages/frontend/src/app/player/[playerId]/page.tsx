import { fetchApi } from '@/lib/api';
import Link from 'next/link';
import { getLocale } from '@/lib/locale';
import { t, tPos, tInjury } from '@/lib/i18n';
import { isDisciplinaryReason, fmtDate, fmtRound } from '@/lib/format';
import type { Metadata } from 'next';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

export async function generateMetadata({
  params,
}: {
  params: { playerId: string };
}): Promise<Metadata> {
  const playerId = parseInt(params.playerId);
  try {
    const [player, injuryData] = await Promise.all([
      fetchApi<Player>(`/api/players/${playerId}`),
      fetchApi<{ injuries: Injury[]; appearances: Appearance[] }>(`/api/players/${playerId}/injuries`).catch(() => null),
    ]);
    const pos = player.position ?? '';
    const nat = player.nationality ?? '';
    const injuries = injuryData?.injuries ?? [];
    const currentSeasonInjuries = injuries.filter((i) => i.season === 2025);
    const latestInjury = currentSeasonInjuries[currentSeasonInjuries.length - 1] ?? injuries[injuries.length - 1] ?? null;
    const totalMissed = currentSeasonInjuries.length;

    const title = `${player.name} Injury Update & History 2025/26`;
    let description: string;
    if (latestInjury && totalMissed > 0) {
      description = `${player.name}${pos ? ` (${pos})` : ''}${nat ? ` · ${nat}` : ''}: ${totalMissed} absence${totalMissed !== 1 ? 's' : ''} this season — latest: ${latestInjury.reason}. Full injury history, missed matches, and availability status.`;
    } else {
      description = `${player.name}${pos ? ` (${pos})` : ''}${nat ? ` · ${nat}` : ''} — full injury history, missed matches, and current availability on SquadCheck.`;
    }

    return {
      title,
      description,
      openGraph: { title: `${title} | SquadCheck`, description },
      alternates: { canonical: `/player/${playerId}` },
      keywords: [
        `${player.name} injury`,
        `${player.name} injured`,
        `${player.name} fitness update`,
        `${player.name} injury history`,
        `${player.name} availability`,
      ],
    };
  } catch {
    return { title: 'Player Injury Report' };
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
  leagueId: number;
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
    let cur: { reason: string; type: string; count: number; firstMissDate: Date; lastMissDate: Date; leagueId: number } | null = null;
    for (const inj of sorted) {
      if (inj.type !== 'Missing Fixture') {
        if (cur) { episodes.push(finalize(cur, sortedApps, false)); cur = null; }
        episodes.push({ reason: inj.reason, type: inj.type, missedCount: 0, ongoing: false, isDisciplinary: isDisciplinaryReason(inj.reason), injuredInMatch: null });
        continue;
      }
      const injDate = new Date(inj.fixtureDate);
      if (cur && cur.reason === inj.reason) {
        const returnedBetween = sortedApps.some(
          app => app.leagueId === cur!.leagueId && new Date(app.date) > cur!.lastMissDate && new Date(app.date) < injDate
        );
        if (returnedBetween) {
          episodes.push(finalize(cur, sortedApps, false));
          cur = { reason: inj.reason, type: 'Missing Fixture', count: 1, firstMissDate: injDate, lastMissDate: injDate, leagueId: inj.league.id };
        } else {
          cur.count++;
          cur.lastMissDate = injDate;
        }
      } else {
        if (cur) episodes.push(finalize(cur, sortedApps, false));
        cur = { reason: inj.reason, type: 'Missing Fixture', count: 1, firstMissDate: injDate, lastMissDate: injDate, leagueId: inj.league.id };
      }
    }
    if (cur) episodes.push(finalize(cur, sortedApps, true));
    result.set(season, episodes.reverse());
  });
  return result;
}

function finalize(raw: { reason: string; type: string; count: number; firstMissDate: Date; lastMissDate: Date; leagueId: number }, apps: Appearance[], isLast: boolean): InjuryEpisode {
  let match: InjuryEpisode['injuredInMatch'] = null;
  // Use all competitions to find last appearance before injury — cross-competition recovery counts
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
    return (
      <div className="max-w-[56rem] mx-auto px-4 py-8 text-sm text-muted-foreground">
        {t(locale, 'player_not_found')}
      </div>
    );
  }

  const episodesBySeason = buildEpisodes(injuries, appearances);
  const sortedSeasons = Array.from(episodesBySeason.keys()).sort((a, b) => b - a);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://squadcheck.xyz';
  const currentTeam = injuries[0]?.team ?? null;
  const personJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: player.name,
    ...(player.position ? { jobTitle: player.position } : {}),
    ...(player.nationality ? { nationality: { '@type': 'Country', name: player.nationality } } : {}),
    ...(player.birthDate ? { birthDate: player.birthDate } : {}),
    ...(player.photo ? { image: player.photo } : {}),
    url: `${siteUrl}/player/${playerId}`,
    ...(currentTeam ? {
      memberOf: {
        '@type': 'SportsTeam',
        name: currentTeam.name,
        sport: 'Association Football',
        url: `${siteUrl}/team/${currentTeam.id}`,
      },
    } : {}),
  };

  return (
    <div className="max-w-[56rem] mx-auto">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />
      {/* Back button */}
      {backTeamId && (
        <Link
          href={`/team/${backTeamId}${backLeagueId ? `?league=${backLeagueId}` : ''}`}
          className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground no-underline hover:text-foreground transition-colors mb-4"
        >
          ← {t(locale, 'squad')}
        </Link>
      )}

      {/* Player header */}
      <div className="flex items-center gap-5 mb-6 pb-5 border-b border-border">
        <Avatar className="w-20 h-20 shrink-0">
          {player.photo && <AvatarImage src={player.photo} alt="" />}
          <AvatarFallback className="text-2xl">{player.name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-3xl font-light text-foreground m-0">{player.name}</h1>
          <p className="text-xs text-muted-foreground/60 mt-0.5 mb-0 tracking-wide uppercase">Injury Report</p>
          <div className="flex gap-4 mt-1.5 flex-wrap">
            {[tPos(locale, player.position), player.nationality, player.birthDate && fmtDate(player.birthDate), player.height]
              .filter(Boolean)
              .map((v, i) => (
                <span key={i} className="text-xs text-muted-foreground">{v}</span>
              ))}
          </div>
        </div>
      </div>

      {/* Season stats */}
      {player.seasonStats.length > 0 && (
        <Card className="mb-6 p-0 gap-0">
          <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
            <span className="text-[0.6875rem] font-semibold tracking-wider uppercase text-muted-foreground">
              {t(locale, 'season_stats')}
            </span>
          </div>
          <Table className="text-[0.8125rem]">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {[
                  { l: t(locale, 'season'), align: 'left' as const },
                  { l: t(locale, 'league'), align: 'left' as const },
                  { l: t(locale, 'app'), align: 'center' as const },
                  { l: t(locale, 'min'), align: 'center' as const },
                  { l: t(locale, 'rating'), align: 'center' as const },
                  { l: t(locale, 'goals'), align: 'center' as const },
                  { l: t(locale, 'assists'), align: 'center' as const },
                  { l: t(locale, 'yellow_cards'), align: 'center' as const },
                  { l: t(locale, 'red_cards'), align: 'center' as const },
                ].map((h) => (
                  <TableHead
                    key={h.l}
                    className={cn(
                      'py-2.5 text-[0.6875rem] font-semibold tracking-wider uppercase text-muted-foreground border-b border-border',
                      h.align === 'center' ? 'px-3 text-center' : 'px-4 text-left'
                    )}
                  >
                    {h.l}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {player.seasonStats.map((s, i) => (
                <TableRow
                  key={i}
                  className={cn(
                    'border-border hover:bg-accent/50',
                    i % 2 === 1 ? 'bg-muted/20' : ''
                  )}
                >
                  <TableCell className="px-4 py-2.5 font-mono text-sm text-foreground font-semibold">
                    {s.season.year}/{(s.season.year + 1).toString().slice(2)}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-sm text-foreground/70">{s.season.league.name}</TableCell>
                  <TableCell className="px-3 py-2.5 text-center font-mono text-foreground/80">{s.appearances ?? '—'}</TableCell>
                  <TableCell className="px-3 py-2.5 text-center font-mono text-foreground/80">{s.minutes ?? '—'}</TableCell>
                  <TableCell className="px-3 py-2.5 text-center font-mono">
                    {s.rating ? (
                      <span className={
                        s.rating >= 7 ? 'text-[var(--sc-green)]' :
                        s.rating >= 6.5 ? 'text-[var(--sc-yellow)]' : 'text-foreground/80'
                      }>{s.rating.toFixed(2)}</span>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-center font-mono text-foreground/80">{s.goalsTotal ?? '—'}</TableCell>
                  <TableCell className="px-3 py-2.5 text-center font-mono text-foreground/80">{s.assists ?? '—'}</TableCell>
                  <TableCell className="px-3 py-2.5 text-center font-mono text-[var(--sc-yellow)]">{s.yellowCards ?? '—'}</TableCell>
                  <TableCell className="px-3 py-2.5 text-center font-mono text-[var(--sc-red)]">{s.redCards ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Injury history */}
      {sortedSeasons.length > 0 && (
        <Card className="p-0 gap-0">
          <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
            <h2 className="text-[0.6875rem] font-semibold tracking-wider uppercase text-muted-foreground m-0">
              {t(locale, 'injury_history')}
            </h2>
          </div>
          <div>
            {sortedSeasons.map((yr, si) => {
              const episodes = episodesBySeason.get(yr)!;
              const issueLabel = episodes.length === 1 ? t(locale, 'issue_singular') : t(locale, 'issue_plural');
              return (
                <div
                  key={yr}
                  className={cn(si < sortedSeasons.length - 1 ? 'border-b border-border' : '')}
                >
                  <div className="px-4 py-2 bg-muted/20 flex justify-between items-center border-b border-border">
                    <span className="text-xs font-semibold text-foreground/70">
                      {yr}/{(yr + 1).toString().slice(2)} {t(locale, 'season')}
                    </span>
                    <span className="text-[0.6875rem] text-muted-foreground">
                      {episodes.length} {issueLabel}
                    </span>
                  </div>

                  {episodes.map((ep, i) => {
                    const isMissed = ep.type === 'Missing Fixture';
                    const match = ep.injuredInMatch;
                    const missedLabel = ep.missedCount === 1 ? t(locale, 'match_missed_singular') : t(locale, 'match_missed_plural');

                    const badgeVariant = !isMissed ? 'moderate' as const
                      : ep.isDisciplinary ? 'high' as const
                      : 'critical' as const;

                    const statusLabelText = !isMissed
                      ? t(locale, 'status_doubtful')
                      : ep.isDisciplinary
                        ? t(locale, 'status_suspended')
                        : t(locale, 'status_out');

                    const matchContextLabel = ep.isDisciplinary
                      ? t(locale, 'disciplinary_in_match')
                      : t(locale, 'injury_in_match');

                    return (
                      <div
                        key={i}
                        className={cn(
                          'flex items-center justify-between px-4 py-3',
                          i < episodes.length - 1 ? 'border-b border-border' : ''
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <Badge variant={badgeVariant} className="mt-0.5 shrink-0">
                            {statusLabelText}
                          </Badge>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-foreground">{tInjury(locale, ep.reason)}</span>
                              {isMissed && ep.missedCount > 0 && (
                                <Badge variant="info" className="text-[0.6rem]">
                                  {ep.missedCount} {missedLabel}{ep.ongoing ? ` · ${t(locale, 'ongoing')}` : ''}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {match ? (
                                <span>{matchContextLabel}: {fmtRound(match.round)} · vs {match.opponentName} ({match.homeAway})</span>
                              ) : isMissed ? (
                                <span>{t(locale, 'injured_before_season')}</span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        {match && (
                          <div className="text-xs text-muted-foreground shrink-0 ml-4 font-mono">
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
        </Card>
      )}
    </div>
  );
}
